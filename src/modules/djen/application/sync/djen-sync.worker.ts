import type { PoolClient } from 'pg';
import type {
  CapturarPaginaDjenCommand,
  CapturarPaginaDjenCommandHandler
} from '../capturar-pagina-djen.command';
import type { DjenSyncConfig } from './djen-sync.config';
import type { DjenSyncRepositoryPort, DjenSyncRunType } from '../../infrastructure/djen-sync.repository';

const DJEN_API_URL = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const MAX_PAGINAS_POR_JANELA = 10_000;
const MAX_TENTATIVAS = 3;

type CaptureHandler = Pick<CapturarPaginaDjenCommandHandler, 'execute'>;

export function adicionarDias(data: string, dias: number): string {
  const resultado = new Date(`${data}T00:00:00.000Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

export function dataAtualDeBrasilia(agora: Date): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(agora);
  const valores = Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

function erroPodeSerRetentado(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const statusHttp = /DJEN respondeu com HTTP (\d+)/.exec(error.message)?.[1];
  if (statusHttp) {
    const status = Number(statusHttp);
    return status === 429 || status >= 500;
  }

  if (typeof error === 'object' && error !== null && 'isAxiosError' in error) {
    const axiosError = error as { response?: unknown };
    return !axiosError.response;
  }
  return false;
}

function esperar(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Coordena sincronizações incrementais e backfill sem depender de requisições HTTP do front. */
export class DjenSyncWorker {
  constructor(
    private readonly repository: DjenSyncRepositoryPort,
    private readonly capturarPagina: CaptureHandler,
    private readonly config: DjenSyncConfig,
    private readonly agora: () => Date = () => new Date()
  ) {}

  async executarCiclo(): Promise<void> {
    const lock = await this.repository.tentarAdquirirLock(this.config.numeroOab, this.config.ufOab);
    if (!lock) {
      console.log(`Sincronização DJEN da OAB ${this.config.numeroOab}/${this.config.ufOab} já está em execução.`);
      return;
    }

    try {
      const advogadoId = await this.repository.buscarAdvogadoId(this.config.numeroOab, this.config.ufOab);
      let checkpoint = await this.repository.inicializarCheckpoint(
        this.config.numeroOab,
        this.config.ufOab,
        this.config.dataInicioBackfill
      );
      const hoje = dataAtualDeBrasilia(this.agora());
      if (this.config.dataInicioBackfill > hoje) {
        throw new Error('DJEN_SYNC_DATA_INICIO_BACKFILL não pode estar no futuro.');
      }

      const primeiraDataIncremental = adicionarDias(hoje, 1 - this.config.diasLookback);
      for (let data = primeiraDataIncremental; data <= hoje; data = adicionarDias(data, 1)) {
        await this.sincronizarJanela('INCREMENTAL', data, data, advogadoId);
      }

      const ultimaDataBackfill = adicionarDias(primeiraDataIncremental, -1);
      for (let dia = 0; dia < this.config.diasBackfillPorCiclo; dia++) {
        const data = checkpoint.proximaDataBackfill;
        if (data > ultimaDataBackfill) break;
        const proximaData = adicionarDias(data, 1);
        await this.sincronizarJanela('BACKFILL', data, data, advogadoId, proximaData);
        checkpoint = { proximaDataBackfill: proximaData };
      }
    } finally {
      await this.repository.liberarLock(lock, this.config.numeroOab, this.config.ufOab);
    }
  }

  private async sincronizarJanela(
    tipo: DjenSyncRunType,
    dataInicio: string,
    dataFim: string,
    advogadoId: string,
    proximaDataBackfill?: string
  ): Promise<void> {
    const execucaoId = await this.repository.iniciarExecucao(
      this.config.numeroOab,
      this.config.ufOab,
      tipo,
      dataInicio,
      dataFim
    );
    let paginas = 0;
    let itensRecebidos = 0;

    try {
      for (let pagina = 1; pagina <= MAX_PAGINAS_POR_JANELA; pagina++) {
        const filtros = new URLSearchParams({
          numeroOab: this.config.numeroOab,
          ufOab: this.config.ufOab,
          pagina: String(pagina),
          itensPorPagina: '100',
          dataDisponibilizacaoInicio: dataInicio,
          dataDisponibilizacaoFim: dataFim
        });
        const command: CapturarPaginaDjenCommand = {
          url: `${DJEN_API_URL}?${filtros.toString()}`,
          filtros,
          advogadoId
        };
        const response = await this.capturarComRetry(command);
        if (!Array.isArray(response.items)) {
          throw new Error(`Resposta DJEN inválida na janela ${dataInicio}: items não é uma lista.`);
        }

        const itensDaPagina = response.items.length;
        const total = typeof response.count === 'number' && Number.isSafeInteger(response.count)
          ? response.count
          : undefined;
        paginas++;
        itensRecebidos += itensDaPagina;

        if (itensDaPagina === 0) {
          if (total !== undefined && total > (pagina - 1) * 100) {
            throw new Error(`Paginação DJEN terminou antes do total informado na janela ${dataInicio}.`);
          }
          break;
        }
        if (itensDaPagina < 100) {
          if (total !== undefined && pagina * 100 < total) {
            throw new Error(`Página incompleta antes do total informado na janela ${dataInicio}.`);
          }
          break;
        }
        if (total !== undefined && pagina * 100 >= total) break;
        if (pagina === MAX_PAGINAS_POR_JANELA) {
          throw new Error(`Limite de páginas por janela excedido em ${dataInicio}.`);
        }
      }

      await this.repository.concluirExecucao(
        execucaoId,
        tipo,
        paginas,
        itensRecebidos,
        proximaDataBackfill
      );
      console.log(
        `DJEN ${tipo.toLowerCase()} ${dataInicio}: ${paginas} páginas, ${itensRecebidos} itens recebidos.`
      );
    } catch (error) {
      try {
        await this.repository.registrarFalha(execucaoId, error);
      } catch (persistenciaErro) {
        console.error('Falha ao registrar execução DJEN com erro:', persistenciaErro);
      }
      throw error;
    }
  }

  private async capturarComRetry(command: CapturarPaginaDjenCommand): Promise<Record<string, unknown>> {
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      try {
        return await this.capturarPagina.execute(command);
      } catch (error) {
        if (tentativa === MAX_TENTATIVAS || !erroPodeSerRetentado(error)) throw error;
        await esperar(1000 * 2 ** (tentativa - 1));
      }
    }
    throw new Error('A captura DJEN terminou sem resposta.');
  }
}
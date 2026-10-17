import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { test } from 'node:test';
import type { CapturarPaginaDjenCommand } from '../capturar-pagina-djen.command';
import type { DjenSyncConfig } from './djen-sync.config';
import { adicionarDias, DjenSyncWorker } from './djen-sync.worker';
import type {
  DjenSyncCheckpoint,
  DjenSyncRepositoryPort,
  DjenSyncRunType
} from '../../infrastructure/djen-sync.repository';

interface RecordedRun {
  id: string;
  tipo: DjenSyncRunType;
  dataInicio: string;
  dataFim: string;
  paginas?: number;
  itens?: number;
  proximaDataBackfill?: string;
  erro?: unknown;
}

class FakeDjenSyncRepository implements DjenSyncRepositoryPort {
  readonly execucoes: RecordedRun[] = [];
  checkpoint?: DjenSyncCheckpoint;
  lockLiberado = false;

  async buscarAdvogadoId(): Promise<string> {
    return 'advogado-id';
  }

  async inicializarCheckpoint(
    _numeroOab: string,
    _ufOab: string,
    dataInicioBackfill: string
  ): Promise<DjenSyncCheckpoint> {
    this.checkpoint ??= { proximaDataBackfill: dataInicioBackfill };
    return this.checkpoint;
  }

  async tentarAdquirirLock(): Promise<PoolClient> {
    return {} as PoolClient;
  }

  async liberarLock(): Promise<void> {
    this.lockLiberado = true;
  }

  async iniciarExecucao(
    _numeroOab: string,
    _ufOab: string,
    tipo: DjenSyncRunType,
    dataInicio: string,
    dataFim: string
  ): Promise<string> {
    const id = String(this.execucoes.length + 1);
    this.execucoes.push({ id, tipo, dataInicio, dataFim });
    return id;
  }

  async concluirExecucao(
    execucaoId: string,
    _tipo: DjenSyncRunType,
    paginas: number,
    itens: number,
    proximaDataBackfill?: string
  ): Promise<void> {
    const execucao = this.execucoes.find(item => item.id === execucaoId);
    assert.ok(execucao);
    execucao.paginas = paginas;
    execucao.itens = itens;
    if (proximaDataBackfill) {
      execucao.proximaDataBackfill = proximaDataBackfill;
      this.checkpoint = { proximaDataBackfill };
    }
  }

  async registrarFalha(execucaoId: string, error: unknown): Promise<void> {
    const execucao = this.execucoes.find(item => item.id === execucaoId);
    if (execucao) execucao.erro = error;
  }
}

const baseConfig: DjenSyncConfig = {
  numeroOab: '69161',
  ufOab: 'PR',
  dataInicioBackfill: '2026-10-17',
  diasLookback: 1,
  diasBackfillPorCiclo: 1,
  intervaloMinutos: 60
};

test('percorre todas as páginas de 100 itens antes de concluir uma janela', async () => {
  const repository = new FakeDjenSyncRepository();
  const paginasSolicitadas: string[] = [];
  const capturarPagina = {
    async execute(command: CapturarPaginaDjenCommand): Promise<Record<string, unknown>> {
      const pagina = command.filtros.get('pagina') ?? '';
      paginasSolicitadas.push(pagina);
      const tamanho = pagina === '1' ? 100 : 50;
      return { count: 150, items: Array.from({ length: tamanho }, () => ({})) };
    }
  };
  const worker = new DjenSyncWorker(
    repository,
    capturarPagina,
    baseConfig,
    () => new Date('2026-10-17T16:00:00.000Z')
  );

  await worker.executarCiclo();

  assert.deepEqual(paginasSolicitadas, ['1', '2']);
  const [execucao] = repository.execucoes;
  assert.ok(execucao);
  assert.equal(execucao.paginas, 2);
  assert.equal(execucao.itens, 150);
  assert.equal(execucao.erro, undefined);
  assert.equal(repository.lockLiberado, true);
});

test('prioriza o período recente e avança o backfill somente após concluir o dia', async () => {
  const repository = new FakeDjenSyncRepository();
  repository.checkpoint = { proximaDataBackfill: '2026-10-13' };
  const janelas: Array<{ inicio: string; fim: string }> = [];
  const capturarPagina = {
    async execute(command: CapturarPaginaDjenCommand): Promise<Record<string, unknown>> {
      janelas.push({
        inicio: command.filtros.get('dataDisponibilizacaoInicio') ?? '',
        fim: command.filtros.get('dataDisponibilizacaoFim') ?? ''
      });
      return { count: 0, items: [] };
    }
  };
  const worker = new DjenSyncWorker(
    repository,
    capturarPagina,
    { ...baseConfig, dataInicioBackfill: '2026-10-13', diasLookback: 2 },
    () => new Date('2026-10-17T16:00:00.000Z')
  );

  await worker.executarCiclo();

  assert.deepEqual(
    repository.execucoes.map(({ tipo, dataInicio }) => `${tipo}:${dataInicio}`),
    ['INCREMENTAL:2026-10-16', 'INCREMENTAL:2026-10-17', 'BACKFILL:2026-10-13']
  );
  assert.deepEqual(janelas.map(({ inicio, fim }) => [inicio, fim]), [
    ['2026-10-16', '2026-10-16'],
    ['2026-10-17', '2026-10-17'],
    ['2026-10-13', '2026-10-13']
  ]);
  assert.equal(repository.checkpoint?.proximaDataBackfill, '2026-10-14');
  assert.equal(adicionarDias('2026-10-17', 1), '2026-10-18');
});

test('mantém o checkpoint no mesmo dia quando uma janela de backfill falha', async () => {
  const repository = new FakeDjenSyncRepository();
  repository.checkpoint = { proximaDataBackfill: '2026-10-13' };
  const capturarPagina = {
    async execute(command: CapturarPaginaDjenCommand): Promise<Record<string, unknown>> {
      if (command.filtros.get('dataDisponibilizacaoInicio') === '2026-10-13') {
        throw new Error('falha simulada de captura');
      }
      return { count: 0, items: [] };
    }
  };
  const worker = new DjenSyncWorker(
    repository,
    capturarPagina,
    { ...baseConfig, dataInicioBackfill: '2026-10-13' },
    () => new Date('2026-10-17T16:00:00.000Z')
  );

  await assert.rejects(worker.executarCiclo(), /falha simulada de captura/);

  assert.equal(repository.checkpoint?.proximaDataBackfill, '2026-10-13');
  const execucaoBackfill = repository.execucoes.find(item => item.tipo === 'BACKFILL');
  assert.match(String(execucaoBackfill?.erro), /falha simulada de captura/);
  assert.equal(repository.lockLiberado, true);
});
import { pool } from '../../database';
import { AtualizarStatusCommandHandler } from './application/atualizar-status.command';
import { CapturarPaginaDjenCommandHandler } from './application/capturar-pagina-djen.command';
import { ConsultarPublicacoesQueryHandler } from './application/consultar-publicacoes.query';

/** Fachada dos casos de uso DJEN; mantém a interface pública consumida pelo controller. */
export class DjenService {
  private readonly consultarPublicacoes: ConsultarPublicacoesQueryHandler;
  private readonly capturarPagina: CapturarPaginaDjenCommandHandler;
  private readonly atualizarStatusCommandHandler: AtualizarStatusCommandHandler;

  constructor() {
    this.consultarPublicacoes = new ConsultarPublicacoesQueryHandler(pool);
    this.capturarPagina = new CapturarPaginaDjenCommandHandler(pool);
    this.atualizarStatusCommandHandler = new AtualizarStatusCommandHandler(pool);
  }

  async consultarDjen(filtros: URLSearchParams): Promise<Record<string, unknown>> {
    if (!filtros.has('numeroOab')) filtros.set('numeroOab', '69161');
    if (!filtros.has('ufOab')) filtros.set('ufOab', 'PR');
    if (!filtros.has('pagina')) filtros.set('pagina', '1');
    if (!filtros.has('itensPorPagina')) filtros.set('itensPorPagina', '10');

    const consulta = await this.consultarPublicacoes.execute(filtros);
    if (consulta.respostaCacheada) return consulta.respostaCacheada;
    return this.capturarPagina.execute({
      url: consulta.url,
      filtros,
      advogadoId: consulta.advogadoId
    });
  }

  atualizarStatus(id: string, status: string) {
    return this.atualizarStatusCommandHandler.execute({ intimacaoId: id, status });
  }

  async sincronizarRecentes(opcoes?: {
    numeroOab?: string;
    ufOab?: string;
    dias?: number;
  }): Promise<{
    numeroOab: string;
    ufOab: string;
    dataInicio: string;
    dataFim: string;
    totalComunicacoesEncontradas: number;
  }> {
    const numeroOab = opcoes?.numeroOab?.trim() || '69161';
    const ufOab = (opcoes?.ufOab?.trim() || 'PR').toUpperCase();
    const dias = Math.max(1, Math.min(30, opcoes?.dias ?? 7));

    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setUTCDate(inicio.getUTCDate() - dias);
    const dataFim = hoje.toISOString().slice(0, 10);
    const dataInicio = inicio.toISOString().slice(0, 10);

    const filtros = new URLSearchParams({
      numeroOab,
      ufOab,
      dataDisponibilizacaoInicio: dataInicio,
      dataDisponibilizacaoFim: dataFim,
      pagina: '1',
      itensPorPagina: '100'
    });

    const consulta = await this.consultarPublicacoes.execute(filtros);
    const resultado = await this.capturarPagina.execute({
      url: consulta.url,
      filtros,
      advogadoId: consulta.advogadoId
    });

    const count = typeof resultado.count === 'number'
      ? resultado.count
      : Array.isArray(resultado.items)
        ? resultado.items.length
        : 0;

    return {
      numeroOab,
      ufOab,
      dataInicio,
      dataFim,
      totalComunicacoesEncontradas: count
    };
  }
}
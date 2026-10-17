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
}
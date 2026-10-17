import { mapearPublicacao, type PublicacaoDto } from './publicacao.dto';
import { listarTribunaisMapeados, homepageTribunal } from './tribunal-links';
import type {
  DjenReadFilters,
  DjenReadRepositoryPort,
  ProcessoResumoRow
} from '../infrastructure/djen-read.repository';

export interface DjenReadQuery {
  numeroOab?: string;
  ufOab?: string;
  pagina?: string;
  itensPorPagina?: string;
  numeroProcesso?: string;
  tribunal?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export class DjenReadValidationError extends Error {}

function positiveInteger(value: string | undefined, fallback: number, name: string, max: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new DjenReadValidationError(`${name} deve ser um inteiro entre 1 e ${max}.`);
  }
  return parsed;
}

function validDate(value: string | undefined, name: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DjenReadValidationError(`${name} deve usar o formato YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new DjenReadValidationError(`${name} não é uma data válida.`);
  }
  return value;
}

function filtersFrom(query: DjenReadQuery): DjenReadFilters {
  const numeroOab = query.numeroOab?.trim() || '69161';
  const ufOab = (query.ufOab?.trim() || 'PR').toUpperCase();
  if (!/^[0-9A-Za-z.-]{1,30}$/.test(numeroOab)) {
    throw new DjenReadValidationError('numeroOab tem formato inválido.');
  }
  if (!/^[A-Z]{2}$/.test(ufOab)) {
    throw new DjenReadValidationError('ufOab deve conter duas letras.');
  }
  const dataInicio = validDate(query.dataInicio, 'dataInicio');
  const dataFim = validDate(query.dataFim, 'dataFim');
  if (dataInicio && dataFim && dataInicio > dataFim) {
    throw new DjenReadValidationError('dataInicio não pode ser posterior a dataFim.');
  }
  return {
    numeroOab,
    ufOab,
    ...(query.numeroProcesso?.trim() ? { numeroProcesso: query.numeroProcesso.trim() } : {}),
    ...(query.tribunal?.trim() ? { tribunal: query.tribunal.trim().toUpperCase() } : {}),
    ...(query.status?.trim() ? { status: query.status.trim().toUpperCase() } : {}),
    ...(dataInicio ? { dataInicio } : {}),
    ...(dataFim ? { dataFim } : {})
  };
}

function processoResumo(row: ProcessoResumoRow) {
  return {
    id: row.id,
    numeroProcesso: row.numero_cnj,
    tribunal: row.tribunal,
    homepageTribunal: homepageTribunal(row.tribunal),
    orgaoJulgador: row.orgao_julgador,
    quantidadePublicacoes: row.quantidade_publicacoes,
    ultimaPublicacao: row.ultima_publicacao_id
      ? {
          id: row.ultima_publicacao_id,
          data: row.ultima_data_publicacao,
          tipoComunicacao: row.ultima_tipo,
          statusLeitura: row.ultimo_status
        }
      : null
  };
}

export class DjenReadService {
  constructor(private readonly repository: DjenReadRepositoryPort) {}

  async listarProcessos(query: DjenReadQuery) {
    const filters = filtersFrom(query);
    const pagina = positiveInteger(query.pagina, 1, 'pagina', 1_000_000);
    const itensPorPagina = positiveInteger(query.itensPorPagina, 25, 'itensPorPagina', 100);
    const result = await this.repository.listarProcessos(filters, pagina, itensPorPagina);
    return {
      items: result.items.map(processoResumo),
      pagination: {
        page: pagina,
        pageSize: itensPorPagina,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / itensPorPagina)
      }
    };
  }

  async listarPublicacoesDoProcesso(processoId: string, query: DjenReadQuery) {
    const filters = filtersFrom(query);
    const pagina = positiveInteger(query.pagina, 1, 'pagina', 1_000_000);
    const itensPorPagina = positiveInteger(query.itensPorPagina, 25, 'itensPorPagina', 100);
    const result = await this.repository.listarPublicacoesDoProcesso(
      processoId,
      filters,
      pagina,
      itensPorPagina
    );
    return paginatedPublications(result.items.map(mapearPublicacao), result.total, pagina, itensPorPagina);
  }

  async listarPublicacoes(query: DjenReadQuery) {
    const filters = filtersFrom(query);
    const pagina = positiveInteger(query.pagina, 1, 'pagina', 1_000_000);
    const itensPorPagina = positiveInteger(query.itensPorPagina, 25, 'itensPorPagina', 100);
    const result = await this.repository.listarPublicacoes(filters, pagina, itensPorPagina);
    return paginatedPublications(result.items.map(mapearPublicacao), result.total, pagina, itensPorPagina);
  }

  async dashboard(query: DjenReadQuery) {
    const filters = filtersFrom(query);
    const [contagens, recentes] = await Promise.all([
      this.repository.contarDashboard(filters),
      this.repository.listarPublicacoes(filters, 1, 10)
    ]);
    return {
      contagens,
      ultimasPublicacoes: recentes.items.map(mapearPublicacao)
    };
  }

  listarTribunais(): Array<{ sigla: string; homepage: string }> {
    return listarTribunaisMapeados();
  }
}

function paginatedPublications(
  items: PublicacaoDto[],
  total: number,
  pagina: number,
  itensPorPagina: number
) {
  return {
    items,
    pagination: {
      page: pagina,
      pageSize: itensPorPagina,
      totalItems: total,
      totalPages: Math.ceil(total / itensPorPagina)
    }
  };
}
import type { Pool } from 'pg';
import type { PublicacaoRow } from '../application/publicacao.dto';

export interface DjenReadFilters {
  numeroOab: string;
  ufOab: string;
  numeroProcesso?: string;
  tribunal?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface ProcessoResumoRow {
  id: string;
  numero_cnj: string;
  tribunal: string | null;
  orgao_julgador: string | null;
  quantidade_publicacoes: number;
  ultima_data_publicacao: string | null;
  ultima_publicacao_id: string | null;
  ultimo_status: string | null;
  ultima_tipo: string | null;
}

export interface PaginatedRows<T> {
  total: number;
  items: T[];
}

export interface DashboardCounts {
  totalPublicacoes: number;
  totalProcessos: number;
  porStatus: Record<string, number>;
}

export interface DjenReadRepositoryPort {
  listarProcessos(filters: DjenReadFilters, pagina: number, itensPorPagina: number): Promise<PaginatedRows<ProcessoResumoRow>>;
  listarPublicacoesDoProcesso(
    processoId: string,
    filters: Pick<DjenReadFilters, 'numeroOab' | 'ufOab'>,
    pagina: number,
    itensPorPagina: number
  ): Promise<PaginatedRows<PublicacaoRow>>;
  listarPublicacoes(filters: DjenReadFilters, pagina: number, itensPorPagina: number): Promise<PaginatedRows<PublicacaoRow>>;
  contarDashboard(filters: Pick<DjenReadFilters, 'numeroOab' | 'ufOab'>): Promise<DashboardCounts>;
}

export class DjenReadRepository implements DjenReadRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async listarProcessos(
    filters: DjenReadFilters,
    pagina: number,
    itensPorPagina: number
  ): Promise<PaginatedRows<ProcessoResumoRow>> {
    const values = [filters.numeroOab, filters.ufOab, filters.numeroProcesso ?? null, filters.tribunal ?? null];
    const where = `
      a.numero_oab = $1 AND a.uf_oab = $2
      AND ($3::text IS NULL OR p.numero_cnj ILIKE '%' || $3 || '%')
      AND ($4::text IS NULL OR p.tribunal = $4)`;
    const [countResult, itemsResult] = await Promise.all([
      this.pool.query<{ total: string }>(
        `SELECT COUNT(DISTINCT p.id)::text AS total
         FROM processos p
         JOIN intimacoes i ON i.processo_id = p.id
         JOIN advogados a ON a.id = i.advogado_id
         WHERE ${where}`,
        values
      ),
      this.pool.query<ProcessoResumoRow>(
        `SELECT p.id::text AS id,
                p.numero_cnj,
                p.tribunal,
                p.orgao_julgador,
                COUNT(i.id)::int AS quantidade_publicacoes,
                MAX(COALESCE(i.data_publicacao, i.data_disponibilizacao))::text AS ultima_data_publicacao,
                (ARRAY_AGG(i.id::text ORDER BY COALESCE(i.data_publicacao, i.data_disponibilizacao) DESC NULLS LAST, i.id DESC))[1] AS ultima_publicacao_id,
                (ARRAY_AGG(i.status_leitura ORDER BY COALESCE(i.data_publicacao, i.data_disponibilizacao) DESC NULLS LAST, i.id DESC))[1] AS ultimo_status,
                (ARRAY_AGG(COALESCE(i.dados_djen->>'tipoComunicacao', i.dados_djen->>'tipo_comunicacao') ORDER BY COALESCE(i.data_publicacao, i.data_disponibilizacao) DESC NULLS LAST, i.id DESC))[1] AS ultima_tipo,
         FROM processos p
         JOIN intimacoes i ON i.processo_id = p.id
         JOIN advogados a ON a.id = i.advogado_id
         WHERE ${where}
         GROUP BY p.id, p.numero_cnj, p.tribunal, p.orgao_julgador
         ORDER BY MAX(COALESCE(i.data_publicacao, i.data_disponibilizacao)) DESC NULLS LAST,
                  p.numero_cnj
         LIMIT $5 OFFSET $6`,
        [...values, itensPorPagina, (pagina - 1) * itensPorPagina]
      )
    ]);

    return {
      total: Number(countResult.rows[0]?.total ?? 0),
      items: itemsResult.rows
    };
  }

  async listarPublicacoesDoProcesso(
    processoId: string,
    filters: Pick<DjenReadFilters, 'numeroOab' | 'ufOab'>,
    pagina: number,
    itensPorPagina: number
  ): Promise<PaginatedRows<PublicacaoRow>> {
    const values = [processoId, filters.numeroOab, filters.ufOab];
    const where = `i.processo_id = $1::uuid AND a.numero_oab = $2 AND a.uf_oab = $3`;
    const [countResult, itemsResult] = await Promise.all([
      this.pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM intimacoes i
         JOIN advogados a ON a.id = i.advogado_id
         WHERE ${where}`,
        values
      ),
      this.pool.query<PublicacaoRow>(
        `SELECT i.id::text AS id,
                i.processo_id::text AS processo_id,
                p.numero_cnj,
                p.tribunal,
                p.orgao_julgador,
                i.data_disponibilizacao::text AS data_disponibilizacao,
                i.data_publicacao::text AS data_publicacao,
                i.teor_comunicacao,
                i.status_leitura,
                i.dados_djen
         FROM intimacoes i
         JOIN processos p ON p.id = i.processo_id
         JOIN advogados a ON a.id = i.advogado_id
         WHERE ${where}
         ORDER BY COALESCE(i.data_publicacao, i.data_disponibilizacao) DESC NULLS LAST, i.id DESC
         LIMIT $4 OFFSET $5`,
        [...values, itensPorPagina, (pagina - 1) * itensPorPagina]
      )
    ]);
    return { total: Number(countResult.rows[0]?.total ?? 0), items: itemsResult.rows };
  }

  async listarPublicacoes(
    filters: DjenReadFilters,
    pagina: number,
    itensPorPagina: number
  ): Promise<PaginatedRows<PublicacaoRow>> {
    const values = [
      filters.numeroOab,
      filters.ufOab,
      filters.status ?? null,
      filters.tribunal ?? null,
      filters.dataInicio ?? null,
      filters.dataFim ?? null
    ];
    const where = `
      a.numero_oab = $1 AND a.uf_oab = $2
      AND ($3::text IS NULL OR i.status_leitura = $3)
      AND ($4::text IS NULL OR p.tribunal = $4)
      AND ($5::date IS NULL OR i.data_disponibilizacao >= $5::date)
      AND ($6::date IS NULL OR i.data_disponibilizacao <= $6::date)`;
    const [countResult, itemsResult] = await Promise.all([
      this.pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM intimacoes i
         JOIN processos p ON p.id = i.processo_id
         JOIN advogados a ON a.id = i.advogado_id
         WHERE ${where}`,
        values
      ),
      this.pool.query<PublicacaoRow>(
        `SELECT i.id::text AS id,
                i.processo_id::text AS processo_id,
                p.numero_cnj,
                p.tribunal,
                p.orgao_julgador,
                i.data_disponibilizacao::text AS data_disponibilizacao,
                i.data_publicacao::text AS data_publicacao,
                i.teor_comunicacao,
                i.status_leitura,
                i.dados_djen
         FROM intimacoes i
         JOIN processos p ON p.id = i.processo_id
         JOIN advogados a ON a.id = i.advogado_id
         WHERE ${where}
         ORDER BY COALESCE(i.data_publicacao, i.data_disponibilizacao) DESC NULLS LAST, i.id DESC
         LIMIT $7 OFFSET $8`,
        [...values, itensPorPagina, (pagina - 1) * itensPorPagina]
      )
    ]);
    return { total: Number(countResult.rows[0]?.total ?? 0), items: itemsResult.rows };
  }

  async contarDashboard(filters: Pick<DjenReadFilters, 'numeroOab' | 'ufOab'>): Promise<DashboardCounts> {
    const result = await this.pool.query<{
      total: string;
      total_processos: string;
      status_leitura: string | null;
      quantidade: string | null;
    }>(
      `WITH base AS (
         SELECT i.processo_id, i.status_leitura
         FROM intimacoes i
         JOIN advogados a ON a.id = i.advogado_id
         WHERE a.numero_oab = $1 AND a.uf_oab = $2
       ), totais AS (
         SELECT COUNT(*)::text AS total,
                COUNT(DISTINCT processo_id)::text AS total_processos
         FROM base
       ), statuses AS (
         SELECT status_leitura, COUNT(*)::text AS quantidade
         FROM base
         GROUP BY status_leitura
       )
       SELECT totais.total, totais.total_processos,
              statuses.status_leitura, statuses.quantidade
       FROM totais
       LEFT JOIN statuses ON TRUE`,
      [filters.numeroOab, filters.ufOab]
    );
    const porStatus: Record<string, number> = {};
    for (const row of result.rows) {
      if (row.status_leitura) porStatus[row.status_leitura] = Number(row.quantidade ?? 0);
    }
    return {
      totalPublicacoes: Number(result.rows[0]?.total ?? 0),
      totalProcessos: Number(result.rows[0]?.total_processos ?? 0),
      porStatus
    };
  }
}
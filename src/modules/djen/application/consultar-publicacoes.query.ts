import type { Pool } from 'pg';
import { parseOfficialDjenResponse } from '../official-response';
import { DJEN_CACHE_TTL_SECONDS, respostaPodeSerCacheadaIndefinidamente } from '../djen-cache';

export interface ConsultaPublicacoesResult {
  advogadoId: string;
  url: string;
  respostaCacheada: Record<string, unknown> | null;
}

/** Lê o advogado e uma resposta já persistida; não altera o banco. */
export class ConsultarPublicacoesQueryHandler {
  constructor(private readonly pool: Pool) {}

  async execute(filtros: URLSearchParams): Promise<ConsultaPublicacoesResult> {
    const numeroOab = filtros.get('numeroOab') ?? '';
    const uf = filtros.get('ufOab') ?? '';
    const advogado = await this.pool.query(
      'SELECT id FROM advogados WHERE numero_oab = $1 AND uf_oab = $2',
      [numeroOab, uf]
    );

    if (advogado.rows.length === 0) {
      throw new Error(`Advogado com a OAB ${numeroOab}/${uf} não encontrado.`);
    }

    const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?${filtros.toString()}`;
    const cachePermanente = respostaPodeSerCacheadaIndefinidamente(filtros);
    const cached = await this.pool.query<{ corpo_original: Buffer }>(
      `SELECT r.corpo_original
       FROM djen_respostas AS r
       JOIN djen_resposta_chaves AS k ON k.resposta_id = r.id
       JOIN djen_respostas_processamento AS p ON p.resposta_id = r.id
       WHERE k.url_solicitada = $1
         AND r.status_http BETWEEN 200 AND 299
         AND p.status = 'COMPLETO'
         AND ($2::boolean OR r.consultado_em >= clock_timestamp() - ($3 * INTERVAL '1 second'))
       ORDER BY r.consultado_em DESC, r.id DESC
       LIMIT 1`,
      [url, cachePermanente, DJEN_CACHE_TTL_SECONDS]
    );

    return {
      advogadoId: String(advogado.rows[0].id),
      url,
      respostaCacheada: cached.rows[0]
        ? parseOfficialDjenResponse(cached.rows[0].corpo_original).json
        : null
    };
  }
}
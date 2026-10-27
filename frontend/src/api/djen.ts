import type {
  BuscaParams,
  ComunicacaoResponse,
  Tribunal,
} from '../types/comunicacao'

// A API do DJEN tem CORS aberto (Access-Control-Allow-Origin: *),
// então chamamos diretamente sem precisar de proxy.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
const OFICIAL_DJEN_URL = 'https://comunicaapi.pje.jus.br'

// ─── Erros tipados ────────────────────────────────────────────────────────────

export class DjenError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly isRateLimit = false,
  ) {
    super(message)
    this.name = 'DjenError'
  }
}

// ─── Helper interno ───────────────────────────────────────────────────────────

async function djenFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value)
      }
    })
  }

  const response = await fetch(url.toString())

  if (response.status === 429) {
    throw new DjenError(
      'Limite de requisições atingido. Aguarde 1 minuto e tente novamente.',
      429,
      true,
    )
  }

  if (!response.ok) {
    // Tenta extrair a mensagem da resposta da API antes de lançar o erro
    let apiMessage: string | null = null
    try {
      const body = await response.json() as { message?: string; status?: string }
      if (body.message) apiMessage = body.message
    } catch {
      // ignora erro de parse
    }

    throw new DjenError(
      apiMessage ?? `Erro ao consultar a API (${response.status})`,
      response.status,
    )
  }

  return response.json() as Promise<T>
}

// ─── Endpoints públicos ───────────────────────────────────────────────────────

/**
 * Busca comunicações processuais com os filtros fornecidos.
 * Pelo menos um dos campos textuais ou siglaTribunal deve ser preenchido.
 */
export async function buscarComunicacoes(
  params: BuscaParams,
): Promise<ComunicacaoResponse> {
  const query: Record<string, string> = {}

  if (params.numeroOab)                  query.numeroOab                  = params.numeroOab
  if (params.ufOab)                      query.ufOab                      = params.ufOab
  if (params.nomeAdvogado)               query.nomeAdvogado               = params.nomeAdvogado
  if (params.nomeParte)                  query.nomeParte                  = params.nomeParte
  if (params.numeroProcesso)             query.numeroProcesso             = params.numeroProcesso
  if (params.dataDisponibilizacaoInicio) query.dataDisponibilizacaoInicio = params.dataDisponibilizacaoInicio
  if (params.dataDisponibilizacaoFim)    query.dataDisponibilizacaoFim    = params.dataDisponibilizacaoFim
  if (params.siglaTribunal)              query.siglaTribunal              = params.siglaTribunal
  if (params.meio)                       query.meio                       = params.meio
  if (params.numeroComunicacao != null)  query.numeroComunicacao          = String(params.numeroComunicacao)
  if (params.orgaoId != null)            query.orgaoId                    = String(params.orgaoId)
  if (params.pagina != null)             query.pagina                     = String(params.pagina)

  // A API aceita apenas 5 ou 100 — default 100 para resultados completos
  query.itensPorPagina = String(params.itensPorPagina ?? 100)

  return djenFetch<ComunicacaoResponse>('/api/v1/comunicacao', query)
}

/**
 * Retorna a lista de tribunais com datas de último envio.
 */
export async function buscarTribunais(): Promise<Tribunal[]> {
  return djenFetch<Tribunal[]>('/api/v1/comunicacao/tribunal')
}

/**
 * Retorna a URL de uma certidão de comunicação pelo hash.
 */
export function urlCertidao(hash: string): string {
  return `${OFICIAL_DJEN_URL}/api/v1/comunicacao/${hash}/certidao`
}

// ─── Atalhos de período ───────────────────────────────────────────────────────

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function periodoHoje(): { inicio: string; fim: string } {
  const hoje = toISODate(new Date())
  return { inicio: hoje, fim: hoje }
}

export function periodoUltimosDias(dias: number): { inicio: string; fim: string } {
  const fim = new Date()
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - dias)
  return { inicio: toISODate(inicio), fim: toISODate(fim) }
}

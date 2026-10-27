// ─── Destinatários ───────────────────────────────────────────────────────────

export type PoloDestinatario = 'A' | 'P' | 'T' | 'D'

export interface Destinatario {
  nome: string
  polo: PoloDestinatario
  comunicacao_id?: number
}

export interface Advogado {
  id: number
  nome: string
  numero_oab: string
  uf_oab: string
}

export interface DestinatarioAdvogado {
  id: number | string
  comunicacao_id: number | string
  advogado_id: number
  created_at: string
  updated_at: string
  advogado: Advogado
}

// ─── Comunicação ─────────────────────────────────────────────────────────────

export type TipoComunicacao =
  | 'Citação'
  | 'Intimação'
  | 'Edital'
  | 'Pauta de julgamento'
  | 'Lista de distribuição'
  | 'Ata de sessão'

export type MeioComunicacao = 'D' | 'E'

export interface Comunicacao {
  id: number
  data_disponibilizacao: string
  datadisponibilizacao: string
  siglaTribunal: string
  tipoComunicacao: TipoComunicacao | string
  nomeOrgao: string
  idOrgao: number
  texto: string
  numero_processo: string
  numeroprocessocommascara: string
  meio: MeioComunicacao
  meiocompleto: string
  link: string
  tipoDocumento: string
  nomeClasse: string
  codigoClasse: string
  numeroComunicacao: number
  ativo: boolean
  hash: string
  status: string
  motivo_cancelamento: string | null
  data_cancelamento: string | null
  destinatarios: Destinatario[]
  destinatarioadvogados: DestinatarioAdvogado[]
}

// ─── Resposta da API ─────────────────────────────────────────────────────────

export interface ComunicacaoResponse {
  status: string
  message: string
  count: number
  items: Comunicacao[]
}

// ─── Tribunais ───────────────────────────────────────────────────────────────

export interface Tribunal {
  id: number
  nome: string
  sigla: string
  jurisdicao: string
  endereco?: string
  telefone?: string
}

// ─── Parâmetros de busca ─────────────────────────────────────────────────────

export interface BuscaParams {
  numeroOab?: string
  ufOab?: string
  nomeAdvogado?: string
  nomeParte?: string
  numeroProcesso?: string
  dataDisponibilizacaoInicio?: string
  dataDisponibilizacaoFim?: string
  siglaTribunal?: string
  numeroComunicacao?: number
  pagina?: number
  itensPorPagina?: 5 | 100
  orgaoId?: number
  meio?: MeioComunicacao
}

// ─── Helpers de UI ───────────────────────────────────────────────────────────

export const TIPO_COMUNICACAO_LABEL: Record<string, string> = {
  Citação: 'Citação',
  Intimação: 'Intimação',
  Edital: 'Edital',
  'Pauta de julgamento': 'Pauta',
  'Lista de distribuição': 'Lista',
  'Ata de sessão': 'Ata',
}

export const POLO_LABEL: Record<PoloDestinatario, string> = {
  A: 'Ativo',
  P: 'Passivo',
  T: 'Terceiro',
  D: 'Outro',
}

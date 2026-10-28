import type {
  BuscaParams,
  ComunicacaoResponse,
  Tribunal,
} from '../types/comunicacao'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin)
const OFICIAL_DJEN_URL = 'https://comunicaapi.pje.jus.br'
const TOKEN_STORAGE_KEY = 'ghfs_adv_saas_token'

export type UserRole = 'MASTER' | 'ADMIN_DEV' | 'ADVOGADO'

export interface UsuarioSessao {
  id: string
  nome: string
  email: string
  role: UserRole
  ativo: boolean
  escritorio: {
    id: string | null
    nome: string | null
    slug: string | null
    plano: string | null
  }
  oab: {
    numero: string
    uf: string
  }
  ultimoLoginEm: string | null
}

export interface PublicacaoLocalDto {
  id: string
  processoId: string
  numeroProcesso: string
  tribunal: string | null
  homepageTribunal: string | null
  linkInteiroTeor: string | null
  nomeOrgao: string | null
  nomeClasse: string | null
  tipoComunicacao: string
  dataDisponibilizacao: string | null
  dataPublicacao: string | null
  texto: string
  partes: Array<{ nome: string; polo: string | null }>
  hash: string | null
  statusLeitura: string
  textoParaCopiar: string
  estimativaPrazoFinal: {
    status: 'CALCULADA_POR_PRAZO_EXPRESSO' | 'REGRA_LEGAL_PENDENTE' | 'SEM_DATA_PUBLICACAO'
    dataFinal: string | null
    diasUteis: number | null
    mensagem: string
  }
}

export interface DashboardLocalResponse {
  contagens: {
    totalPublicacoes: number
    totalProcessos: number
    porStatus: Record<string, number>
  }
  ultimasPublicacoes: PublicacaoLocalDto[]
}

export interface ProcessoResumoDto {
  id: string
  numeroProcesso: string
  numeroProcessoFormatado?: string
  nomeClasse?: string | null
  tituloPartes?: string | null
  partes?: Array<{ nome: string; polo: string | null }>
  tribunal: string | null
  homepageTribunal: string | null
  orgaoJulgador: string | null
  quantidadePublicacoes: number
  ultimaPublicacao: {
    id: string
    data: string | null
    tipoComunicacao: string | null
    statusLeitura: string | null
  } | null
}

export interface PaginatedResult<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export interface SaasAdminOverview {
  usuarios: UsuarioSessao[]
  escritorios: Array<{
    id: string
    nome: string
    slug: string
    plano: string
    ativo: boolean
    totalProcessos: number
    totalUsuarios: number
  }>
}

// ─── Token Storage ────────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

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

// ─── Helper interno autenticado ───────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: {
    method?: string
    params?: Record<string, string>
    body?: unknown
  },
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)

  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value)
      }
    })
  }

  const headers: Record<string, string> = {}
  const token = getStoredToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url.toString(), {
    method: options?.method ?? 'GET',
    headers,
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  })

  if (response.status === 429) {
    throw new DjenError(
      'Limite de requisições atingido. Aguarde 1 minuto e tente novamente.',
      429,
      true,
    )
  }

  if (!response.ok) {
    let apiMessage: string | null = null
    try {
      const body = await response.json() as { message?: string; error?: string }
      apiMessage = body.error ?? body.message ?? null
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

// ─── Auth SaaS ────────────────────────────────────────────────────────────────

export async function loginSaas(email: string, senha: string): Promise<{ token: string; usuario: UsuarioSessao }> {
  const result = await apiFetch<{ token: string; usuario: UsuarioSessao }>('/api/v1/auth/login', {
    method: 'POST',
    body: { email, senha },
  })
  setStoredToken(result.token)
  return result
}

export async function buscarSessaoAtual(): Promise<{ usuario: UsuarioSessao }> {
  return apiFetch<{ usuario: UsuarioSessao }>('/api/v1/auth/me')
}

export async function buscarAdminOverview(): Promise<SaasAdminOverview> {
  return apiFetch<SaasAdminOverview>('/api/v1/auth/usuarios')
}

// ─── Endpoints de Controladoria Local (PostgreSQL) ────────────────────────────

export async function buscarDashboardLocal(numeroOab = '69161', ufOab = 'PR'): Promise<DashboardLocalResponse> {
  return apiFetch<DashboardLocalResponse>('/api/v1/publicacoes/dashboard', {
    params: { numeroOab, ufOab },
  })
}

export async function buscarPublicacoesLocais(params: {
  numeroOab?: string
  ufOab?: string
  status?: string
  tribunal?: string
  dataInicio?: string
  dataFim?: string
  pagina?: number
  itensPorPagina?: number
}): Promise<PaginatedResult<PublicacaoLocalDto>> {
  const query: Record<string, string> = {}
  if (params.numeroOab) query.numeroOab = params.numeroOab
  if (params.ufOab) query.ufOab = params.ufOab
  if (params.status) query.status = params.status
  if (params.tribunal) query.tribunal = params.tribunal
  if (params.dataInicio) query.dataInicio = params.dataInicio
  if (params.dataFim) query.dataFim = params.dataFim
  if (params.pagina != null) query.pagina = String(params.pagina)
  if (params.itensPorPagina != null) query.itensPorPagina = String(params.itensPorPagina)

  return apiFetch<PaginatedResult<PublicacaoLocalDto>>('/api/v1/publicacoes', { params: query })
}

export async function buscarProcessosLocais(params: {
  numeroOab?: string
  ufOab?: string
  numeroProcesso?: string
  tribunal?: string
  pagina?: number
  itensPorPagina?: number
}): Promise<PaginatedResult<ProcessoResumoDto>> {
  const query: Record<string, string> = {}
  if (params.numeroOab) query.numeroOab = params.numeroOab
  if (params.ufOab) query.ufOab = params.ufOab
  if (params.numeroProcesso) query.numeroProcesso = params.numeroProcesso
  if (params.tribunal) query.tribunal = params.tribunal
  if (params.pagina != null) query.pagina = String(params.pagina)
  if (params.itensPorPagina != null) query.itensPorPagina = String(params.itensPorPagina)

  return apiFetch<PaginatedResult<ProcessoResumoDto>>('/api/v1/processos', { params: query })
}

export async function buscarPublicacoesDoProcessoLocal(
  processoId: string,
  pagina = 1,
): Promise<PaginatedResult<PublicacaoLocalDto>> {
  return apiFetch<PaginatedResult<PublicacaoLocalDto>>(`/api/v1/processos/${processoId}/publicacoes`, {
    params: { pagina: String(pagina), itensPorPagina: '50' },
  })
}

export async function baixarZipCertidoesDoProcesso(
  processoId: string,
  numeroProcessoFormatado?: string,
): Promise<void> {
  const url = `${BASE_URL}/api/v1/processos/${processoId}/certidoes-zip`
  const token = getStoredToken()
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    throw new DjenError(`Falha ao gerar pacote de certidões (${response.status})`, response.status)
  }
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeName = (numeroProcessoFormatado ?? processoId).replace(/[^0-9A-Za-z.-]/g, '_')
  link.href = blobUrl
  link.download = `Certidoes_Processo_${safeName}.zip`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(blobUrl)
}

export async function atualizarStatusPublicacao(id: string, status: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/v1/publicacoes/${id}/status`, {
    method: 'PATCH',
    body: { status },
  })
}

export async function sincronizarDjenAgora(dias = 14): Promise<{
  numeroOab: string
  ufOab: string
  dataInicio: string
  dataFim: string
  totalComunicacoesEncontradas: number
}> {
  return apiFetch('/api/v1/publicacoes/sincronizar', {
    method: 'POST',
    body: { dias },
  })
}

// ─── Endpoints DJEN Ao Vivo ───────────────────────────────────────────────────

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

  query.itensPorPagina = String(params.itensPorPagina ?? 100)

  return apiFetch<ComunicacaoResponse>('/api/v1/comunicacao', { params: query })
}

export async function buscarTribunais(): Promise<Tribunal[]> {
  return apiFetch<Tribunal[]>('/api/v1/comunicacao/tribunal')
}

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

// ─── Módulo Operacional · Triagem WhatsApp & Dossiê ───────────────────────────

export type TipoCasoJuridico =
  | 'NAO_CLASSIFICADO'
  | 'RCV_BANCARIO'
  | 'ECOMMERCE_ML'
  | 'CIVEL_CONSUMIDOR'
  | 'TRIBUTARIO'
  | 'TRABALHISTA'
  | 'PENAL'
  | 'GERAL'

export interface ClienteTriagemResumo {
  id: string
  nome: string
  telefone: string
  origem: 'LEAD' | 'ANTIGO' | 'NOVO'
  tipoCaso: TipoCasoJuridico
  status: 'INCOMPLETO' | 'PRONTO_PROCURACAO' | 'COMPLETO'
  checklistRecebidos: number
  checklistTotal: number
  faltando: string[]
  resumoContexto: string
  totalMensagens: number
  totalDocumentos: number
  updatedAt: string
}

export interface MensagemDossie {
  id: string
  whatsappMessageId: string
  direcao: 'ENTRADA' | 'SAIDA'
  tipo: 'text' | 'audio' | 'image' | 'document' | 'video' | 'sticker' | 'outro'
  enviadaEm: string
  texto: string
  transcricao?: string
  transcricaoEstado?: string
  explicacaoContextual?: string
  midia?: {
    id: string
    tipoDoc: string
    mediaKind: string
    mimeType: string | null
    nomeArquivo: string
    estado: string
    caminhoLocal?: string | null
    resumoOcr?: string | null
  }
}

export interface DossieClienteCompleto {
  cliente: ClienteTriagemResumo
  pastaFisicaRelativa?: string
  checklist: Array<{
    key: string
    label: string
    obrigatorio: boolean
    descricao: string
    recebido: boolean
  }>
  mensagens: MensagemDossie[]
}

export interface ConfiguracaoWhatsappTenant {
  escritorioId: string | null
  escritorioNome: string
  whatsappWabaId?: string
  whatsappPhoneNumberId: string
  whatsappDisplayPhone: string
  tokenConfiguradoNoServidor?: boolean
  metaSubscribed?: boolean
  verifyToken: string
  hmacAtivo: boolean
  webhookPath: string
  totalEventosRecebidos?: number
  ultimoWebhookEm?: string | null
}

export async function buscarClientesOperacional(): Promise<{ items: ClienteTriagemResumo[] }> {
  return apiFetch<{ items: ClienteTriagemResumo[] }>('/api/v1/operacional/clientes')
}

export async function buscarDossieCliente(clienteId: string): Promise<DossieClienteCompleto> {
  return apiFetch<DossieClienteCompleto>(`/api/v1/operacional/clientes/${clienteId}/dossie`)
}

export async function atualizarChecklistCliente(
  clienteId: string,
  payload: {
    tipoCaso?: TipoCasoJuridico
    itemKey?: string
    recebido?: boolean
    status?: 'INCOMPLETO' | 'PRONTO_PROCURACAO' | 'COMPLETO'
    resumoContexto?: string
  },
): Promise<DossieClienteCompleto> {
  return apiFetch<DossieClienteCompleto>(`/api/v1/operacional/clientes/${clienteId}/checklist`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function buscarConfiguracaoWhatsapp(): Promise<ConfiguracaoWhatsappTenant> {
  return apiFetch<ConfiguracaoWhatsappTenant>('/api/v1/operacional/config')
}

export async function salvarConfiguracaoWhatsapp(payload: {
  whatsappWabaId?: string
  whatsappPhoneNumberId: string
  whatsappDisplayPhone?: string
  accessToken?: string
}): Promise<ConfiguracaoWhatsappTenant> {
  return apiFetch<ConfiguracaoWhatsappTenant>('/api/v1/operacional/config', {
    method: 'PUT',
    body: payload,
  })
}

export function urlMidiaOperacional(documentoId: string, download = false): string {
  const token = getStoredToken() ?? ''
  const qs = new URLSearchParams()
  if (token) qs.set('token', token)
  if (download) qs.set('download', '1')
  return `${BASE_URL}/api/v1/operacional/midia/${documentoId}?${qs.toString()}`
}

export async function baixarZipPastaCliente(clienteId: string, nomeCliente: string): Promise<void> {
  const url = `${BASE_URL}/api/v1/operacional/clientes/${clienteId}/pasta-zip`
  const token = getStoredToken()
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    throw new DjenError(`Falha ao baixar pasta do cliente (${response.status})`, response.status)
  }
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeName = nomeCliente.replace(/[^0-9A-Za-z._-]/g, '_')
  link.href = blobUrl
  link.download = `Pasta_Cliente_${safeName}.zip`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(blobUrl)
}

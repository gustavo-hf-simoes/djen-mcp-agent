import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarBlank,
  CheckCircle,
  Clock,
  Copy,
  Check,
  FilePdf,
  Buildings,
  Gavel,
  ArrowSquareOut,
  CaretDown,
} from '@phosphor-icons/react'
import {
  buscarDashboardLocal,
  buscarPublicacoesLocais,
  atualizarStatusPublicacao,
  urlCertidao,
  type DashboardLocalResponse,
  type PublicacaoLocalDto,
} from '../api/djen'
import { Pagination } from './Pagination'
import { LoadingState } from './LoadingState'
import { EmptyState } from './EmptyState'

interface ControladoriaPanelProps {
  refreshTrigger: number
}

const STATUS_OPTIONS = [
  { value: 'PENDENTE',       label: 'Pendente Triagem', color: '#e09f3e' },
  { value: 'EM_ANALISE',     label: 'Em Análise IA',    color: '#60a5fa' },
  { value: 'MINUTA_PRONTA',  label: 'Minuta Pronta',    color: '#a78bfa' },
  { value: 'CONCLUIDA',      label: 'Concluída',        color: '#4ade80' },
]

export function ControladoriaPanel({ refreshTrigger }: ControladoriaPanelProps) {
  const [dashboard, setDashboard] = useState<DashboardLocalResponse | null>(null)
  const [items, setItems] = useState<PublicacaoLocalDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [tribunalFilter, setTribunalFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const carregarDados = useCallback(async (paginaAtual: number, statusAtual: string, tribunalAtual: string) => {
    setLoading(true)
    try {
      const [dashRes, pubRes] = await Promise.all([
        buscarDashboardLocal(),
        buscarPublicacoesLocais({
          pagina: paginaAtual,
          itensPorPagina: 20,
          ...(statusAtual ? { status: statusAtual } : {}),
          ...(tribunalAtual ? { tribunal: tribunalAtual } : {}),
        }),
      ])
      setDashboard(dashRes)
      setItems(pubRes.items)
      setTotal(pubRes.pagination.totalItems)
    } catch (err) {
      console.error('Erro ao carregar Controladoria:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregarDados(page, statusFilter, tribunalFilter)
  }, [carregarDados, page, statusFilter, tribunalFilter, refreshTrigger])

  async function handleStatusChange(id: string, novoStatus: string) {
    try {
      await atualizarStatusPublicacao(id, novoStatus)
      setItems(prev => prev.map(item => (item.id === id ? { ...item, statusLeitura: novoStatus } : item)))
      const dashRes = await buscarDashboardLocal()
      setDashboard(dashRes)
    } catch (err) {
      console.error('Falha ao atualizar status:', err)
    }
  }

  async function copiarContextoIa(pub: PublicacaoLocalDto) {
    await navigator.clipboard.writeText(pub.textoParaCopiar)
    setCopiedId(pub.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const pendentesCount = dashboard?.contagens.porStatus?.['PENDENTE'] ?? 0
  const concluidasCount =
    (dashboard?.contagens.porStatus?.['CONCLUIDA'] ?? 0) +
    (dashboard?.contagens.porStatus?.['LIDA'] ?? 0) +
    (dashboard?.contagens.porStatus?.['LIDO'] ?? 0)

  return (
    <div className="space-y-6">
      {/* KPIs da Controladoria */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            titulo: 'Processos Monitorados',
            valor: dashboard?.contagens.totalProcessos ?? 0,
            subtitulo: 'Pastas CNJ ativas no banco',
            cor: '#60a5fa',
          },
          {
            titulo: 'Total de Publicações',
            valor: dashboard?.contagens.totalPublicacoes ?? 0,
            subtitulo: 'Auditadas com SHA-256',
            cor: '#a1a1aa',
          },
          {
            titulo: 'Pendentes de Providência',
            valor: pendentesCount,
            subtitulo: 'Aguardando controladoria / IA',
            cor: '#e09f3e',
          },
          {
            titulo: 'Tratadas / Concluídas',
            valor: concluidasCount,
            subtitulo: 'Prazos conferidos',
            cor: '#4ade80',
          },
        ].map(kpi => (
          <div
            key={kpi.titulo}
            className="p-5 rounded-2xl"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-edge)',
            }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--color-ink-faint)' }}>
              {kpi.titulo}
            </p>
            <p className="text-2xl font-bold mt-1 font-mono" style={{ color: kpi.cor }}>
              {kpi.valor.toLocaleString('pt-BR')}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-ink-faint)' }}>
              {kpi.subtitulo}
            </p>
          </div>
        ))}
      </div>

      {/* Barra de Filtros da Controladoria */}
      <div
        className="p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold mr-1" style={{ color: 'var(--color-ink-muted)' }}>
            Status na Controladoria:
          </span>
          <button
            type="button"
            onClick={() => { setStatusFilter(''); setPage(1) }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: statusFilter === '' ? 'var(--color-accent)' : 'var(--color-surface-overlay)',
              color: statusFilter === '' ? 'var(--color-accent-on)' : 'var(--color-ink-muted)',
            }}
          >
            Todas
          </button>
          {STATUS_OPTIONS.map(st => (
            <button
              key={st.value}
              type="button"
              onClick={() => { setStatusFilter(st.value); setPage(1) }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: statusFilter === st.value ? `${st.color}25` : 'var(--color-surface-overlay)',
                color: statusFilter === st.value ? st.color : 'var(--color-ink-muted)',
                border: statusFilter === st.value ? `1px solid ${st.color}60` : '1px solid transparent',
              }}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filtrar Tribunal (ex: TJSP, TJPR)..."
            value={tribunalFilter}
            onChange={e => { setTribunalFilter(e.target.value.toUpperCase()); setPage(1) }}
            className="h-9 px-3 rounded-lg text-xs font-mono outline-none"
            style={{
              background: 'var(--color-surface-input)',
              border: '1px solid var(--color-edge)',
              color: 'var(--color-ink)',
            }}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState variant="no-results" />
      ) : (
        <div className="space-y-3">
          {items.map(pub => {
            const isExpanded = expandedId === pub.id
            const prazo = pub.estimativaPrazoFinal
            const temPrazoCalculado = prazo.status === 'CALCULADA_POR_PRAZO_EXPRESSO' && prazo.dataFinal
            const statusObj = STATUS_OPTIONS.find(s => s.value === pub.statusLeitura) ?? {
              value: pub.statusLeitura,
              label: pub.statusLeitura,
              color: '#e09f3e',
            }

            return (
              <motion.article
                key={pub.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-edge)',
                }}
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(224,159,62,0.12)',
                          color: '#e09f3e',
                          border: '1px solid rgba(224,159,62,0.25)',
                        }}
                      >
                        {pub.tipoComunicacao}
                      </span>
                      {pub.tribunal && (
                        <span
                          className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: 'var(--color-surface-overlay)',
                            color: 'var(--color-ink-muted)',
                            border: '1px solid var(--color-edge-subtle)',
                          }}
                        >
                          {pub.tribunal}
                        </span>
                      )}

                      {/* Badge de Prazo da Controladoria */}
                      {temPrazoCalculado ? (
                        <span
                          className="flex items-center gap-1.5 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(248,113,113,0.12)',
                            color: '#f87171',
                            border: '1px solid rgba(248,113,113,0.3)',
                          }}
                        >
                          <Clock size={12} weight="bold" />
                          Prazo Estimado ({prazo.diasUteis}d úteis): {prazo.dataFinal}
                        </span>
                      ) : (
                        <span
                          className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full"
                          style={{
                            background: 'var(--color-surface-overlay)',
                            color: 'var(--color-ink-faint)',
                          }}
                        >
                          <CalendarBlank size={12} />
                          Disp: {pub.dataDisponibilizacao ?? '—'} · Pub: {pub.dataPublicacao ?? '—'}
                        </span>
                      )}
                    </div>

                    {/* Seletor de Status da Tarefa */}
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} weight="bold" style={{ color: statusObj.color }} />
                      <select
                        value={pub.statusLeitura}
                        onChange={e => void handleStatusChange(pub.id, e.target.value)}
                        className="h-8 px-2.5 rounded-lg text-xs font-semibold outline-none cursor-pointer"
                        style={{
                          background: `${statusObj.color}18`,
                          color: statusObj.color,
                          border: `1px solid ${statusObj.color}40`,
                        }}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option
                            key={opt.value}
                            value={opt.value}
                            style={{ background: '#18181b', color: '#f4f4f5' }}
                          >
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Número CNJ + Órgão */}
                  <div>
                    <p className="font-mono text-sm font-bold" style={{ color: 'var(--color-ink)' }}>
                      {pub.numeroProcesso}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--color-ink-faint)' }}>
                      {pub.nomeOrgao && (
                        <span className="flex items-center gap-1">
                          <Buildings size={12} />
                          {pub.nomeOrgao}
                        </span>
                      )}
                      {pub.nomeClasse && (
                        <span className="flex items-center gap-1">
                          · <Gavel size={12} /> {pub.nomeClasse}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Texto Limpo */}
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-ink-muted)' }}>
                    {isExpanded ? pub.texto : pub.texto.slice(0, 320)}
                    {!isExpanded && pub.texto.length > 320 ? ' …' : ''}
                  </p>
                </div>

                {/* Rodapé de Ações Rápidas */}
                <div
                  className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
                  style={{
                    borderTop: '1px solid var(--color-edge-subtle)',
                    background: 'var(--color-surface-overlay)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    {pub.texto.length > 320 && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : pub.id)}
                        className="flex items-center gap-1 text-xs font-medium"
                        style={{ color: 'var(--color-ink-faint)' }}
                      >
                        <CaretDown size={12} className={isExpanded ? 'rotate-180' : ''} />
                        {isExpanded ? 'Recolher teor' : 'Ler teor completo'}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copiarContextoIa(pub)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: 'var(--color-surface-raised)',
                        color: copiedId === pub.id ? '#4ade80' : 'var(--color-ink)',
                        border: '1px solid var(--color-edge)',
                      }}
                    >
                      {copiedId === pub.id ? <Check size={13} weight="bold" /> : <Copy size={13} />}
                      {copiedId === pub.id ? 'Copiado p/ IA!' : 'Copiar Contexto p/ IA'}
                    </button>

                    {pub.hash && (
                      <a
                        href={urlCertidao(pub.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                        style={{ color: 'var(--color-ink-muted)' }}
                      >
                        <FilePdf size={13} />
                        Certidão
                      </a>
                    )}

                    {pub.linkInteiroTeor && (
                      <a
                        href={pub.linkInteiroTeor}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        Abrir Tribunal
                        <ArrowSquareOut size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </motion.article>
            )
          })}

          <Pagination
            currentPage={page}
            totalItems={total}
            itemsPerPage={20}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}

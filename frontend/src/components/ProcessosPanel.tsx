import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderSimple,
  CaretDown,
  Buildings,
  ArrowSquareOut,
  MagnifyingGlass,
  DownloadSimple,
  FilePdf,
  Copy,
  Check,
  Users,
  Gavel,
} from '@phosphor-icons/react'
import {
  buscarProcessosLocais,
  buscarPublicacoesDoProcessoLocal,
  baixarZipCertidoesDoProcesso,
  urlCertidao,
  type ProcessoResumoDto,
  type PublicacaoLocalDto,
} from '../api/djen'
import { Pagination } from './Pagination'
import { LoadingState } from './LoadingState'
import { EmptyState } from './EmptyState'

interface ProcessosPanelProps {
  refreshTrigger: number
}

const TIPO_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  'Intimação':             { bg: 'rgba(224,159,62,0.12)', color: '#e09f3e', border: 'rgba(224,159,62,0.25)' },
  'Citação':               { bg: 'rgba(248,113,113,0.10)', color: '#f87171', border: 'rgba(248,113,113,0.22)' },
  'Edital':                { bg: 'rgba(74,222,128,0.10)',  color: '#4ade80', border: 'rgba(74,222,128,0.22)' },
  'Pauta de julgamento':   { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: 'rgba(167,139,250,0.28)' },
  'Lista de distribuição': { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: 'rgba(167,139,250,0.28)' },
  'Ata de sessão':         { bg: 'rgba(113,113,122,0.12)', color: '#a1a1aa', border: 'rgba(113,113,122,0.25)' },
}

function TipoBadge({ tipo }: { tipo: string }) {
  const s = TIPO_STYLE[tipo] ?? { bg: 'rgba(82,82,91,0.15)', color: '#d4d4d8', border: 'rgba(82,82,91,0.3)' }
  return (
    <span
      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {tipo}
    </span>
  )
}

function formatCnjFallback(numero: string): string {
  const d = numero.replace(/\D/g, '')
  if (d.length === 20) {
    return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`
  }
  return numero
}

export function ProcessosPanel({ refreshTrigger }: ProcessosPanelProps) {
  const [processos, setProcessos] = useState<ProcessoResumoDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [buscaCnj, setBuscaCnj] = useState('')
  const [loading, setLoading] = useState(true)
  const [openProcessoId, setOpenProcessoId] = useState<string | null>(null)
  const [historicoMap, setHistoricoMap] = useState<Record<string, PublicacaoLocalDto[]>>({})
  const [loadingProcessoId, setLoadingProcessoId] = useState<string | null>(null)
  const [downloadingZipId, setDownloadingZipId] = useState<string | null>(null)
  const [copiedPubId, setCopiedPubId] = useState<string | null>(null)

  const carregarProcessos = useCallback(async (pagina: number, filtroCnj: string) => {
    setLoading(true)
    try {
      const res = await buscarProcessosLocais({
        pagina,
        itensPorPagina: 25,
        ...(filtroCnj.trim() ? { numeroProcesso: filtroCnj.trim() } : {}),
      })
      setProcessos(res.items)
      setTotal(res.pagination.totalItems)
    } catch (err) {
      console.error('Erro ao listar processos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregarProcessos(page, buscaCnj)
  }, [carregarProcessos, page, buscaCnj, refreshTrigger])

  async function toggleProcesso(id: string) {
    if (openProcessoId === id) {
      setOpenProcessoId(null)
      return
    }
    setOpenProcessoId(id)
    if (!historicoMap[id]) {
      setLoadingProcessoId(id)
      try {
        const res = await buscarPublicacoesDoProcessoLocal(id)
        setHistoricoMap(prev => ({ ...prev, [id]: res.items }))
      } catch (err) {
        console.error('Erro ao buscar histórico do processo:', err)
      } finally {
        setLoadingProcessoId(null)
      }
    }
  }

  async function handleDownloadAllCertidoes(e: React.MouseEvent, proc: ProcessoResumoDto) {
    e.stopPropagation()
    setDownloadingZipId(proc.id)
    try {
      const cnj = proc.numeroProcessoFormatado ?? formatCnjFallback(proc.numeroProcesso)
      await baixarZipCertidoesDoProcesso(proc.id, cnj)
    } catch (err) {
      console.error('Erro ao baixar pacote de certidões:', err)
    } finally {
      setDownloadingZipId(null)
    }
  }

  async function copiarTexto(pub: PublicacaoLocalDto) {
    await navigator.clipboard.writeText(pub.textoParaCopiar)
    setCopiedPubId(pub.id)
    setTimeout(() => setCopiedPubId(null), 2000)
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho e Busca */}
      <div
        className="p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
      >
        <div>
          <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>
            Pastas de Clientes & Processos ({total.toLocaleString('pt-BR')} processos)
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
            Agrupamento automático por processo CNJ com partes envolvidas, linha do tempo e download em lote de todas as certidões.
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <MagnifyingGlass
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-ink-faint)' }}
          />
          <input
            type="text"
            placeholder="Filtrar por número CNJ..."
            value={buscaCnj}
            onChange={e => { setBuscaCnj(e.target.value); setPage(1) }}
            className="w-full h-10 pl-9 pr-3 rounded-xl text-xs font-mono outline-none"
            style={{
              background: 'var(--color-surface-input)',
              border: '1px solid var(--color-edge)',
              color: 'var(--color-ink)',
            }}
          />
        </div>
      </div>

      {/* Paginação no Topo */}
      {!loading && processos.length > 0 && (
        <Pagination
          currentPage={page}
          totalItems={total}
          itemsPerPage={25}
          onPageChange={setPage}
        />
      )}

      {loading ? (
        <LoadingState />
      ) : processos.length === 0 ? (
        <EmptyState variant="no-results" />
      ) : (
        <div className="space-y-3">
          {processos.map(proc => {
            const isOpen = openProcessoId === proc.id
            const publicacoes = historicoMap[proc.id] ?? []
            const numeroCnjMask = proc.numeroProcessoFormatado ?? formatCnjFallback(proc.numeroProcesso)
            const isDownloading = downloadingZipId === proc.id

            return (
              <div
                key={proc.id}
                className="rounded-2xl overflow-hidden transition-all"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
              >
                {/* Cabeçalho da Pasta do Processo */}
                <div
                  onClick={() => void toggleProcesso(proc.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') void toggleProcesso(proc.id) }}
                  className="w-full p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-left cursor-pointer"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: 'rgba(224,159,62,0.12)',
                        color: 'var(--color-accent)',
                        border: '1px solid rgba(224,159,62,0.25)',
                      }}
                    >
                      <FolderSimple size={20} weight="bold" />
                    </div>

                    <div className="min-w-0 space-y-1.5">
                      {/* Nome do Cliente / Partes em Destaque */}
                      {proc.tituloPartes ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Users size={13} style={{ color: 'var(--color-accent)' }} className="shrink-0" />
                          <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>
                            {proc.tituloPartes}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>
                          Processo {numeroCnjMask}
                        </span>
                      )}

                      {/* Número CNJ Formatado + Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md"
                          style={{
                            background: 'var(--color-surface-overlay)',
                            color: 'var(--color-ink)',
                            border: '1px solid var(--color-edge-subtle)',
                          }}
                        >
                          {numeroCnjMask}
                        </span>

                        {proc.tribunal && (
                          <span
                            className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{
                              background: 'var(--color-surface-overlay)',
                              color: 'var(--color-ink-muted)',
                              border: '1px solid var(--color-edge-subtle)',
                            }}
                          >
                            {proc.tribunal}
                          </span>
                        )}

                        {proc.ultimaPublicacao?.tipoComunicacao && (
                          <TipoBadge tipo={proc.ultimaPublicacao.tipoComunicacao} />
                        )}

                        <span
                          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(96,165,250,0.12)',
                            color: '#60a5fa',
                            border: '1px solid rgba(96,165,250,0.25)',
                          }}
                        >
                          {proc.quantidadePublicacoes} publicaç{proc.quantidadePublicacoes === 1 ? 'ão' : 'ões'}
                        </span>
                      </div>

                      {/* Órgão Julgador + Classe */}
                      <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                        <span className="flex items-center gap-1">
                          <Buildings size={12} style={{ color: 'var(--color-ink-faint)' }} />
                          {proc.orgaoJulgador ?? 'Órgão julgador não informado'}
                        </span>
                        {proc.nomeClasse && (
                          <span className="flex items-center gap-1">
                            · <Gavel size={12} style={{ color: 'var(--color-ink-faint)' }} /> {proc.nomeClasse}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações Rápidas da Pasta (Baixar Todas as Certidões + Expandir) */}
                  <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={e => void handleDownloadAllCertidoes(e, proc)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                      style={{
                        background: 'rgba(224,159,62,0.14)',
                        color: 'var(--color-accent)',
                        border: '1px solid rgba(224,159,62,0.3)',
                      }}
                    >
                      <DownloadSimple size={14} weight="bold" />
                      {isDownloading
                        ? 'Empacotando PDFs...'
                        : `Baixar Todas Certidões (${proc.quantidadePublicacoes})`}
                    </button>

                    <div className="flex items-center gap-2">
                      {proc.ultimaPublicacao?.data && (
                        <span className="font-mono text-xs hidden sm:inline" style={{ color: 'var(--color-ink-muted)' }}>
                          {proc.ultimaPublicacao.data}
                        </span>
                      )}
                      <CaretDown
                        size={16}
                        className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        style={{ color: 'var(--color-ink-muted)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Conteúdo Expandido: Linha do Tempo de Comunicações do Processo */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                      style={{
                        borderTop: '1px solid var(--color-edge-subtle)',
                        background: 'var(--color-surface-overlay)',
                      }}
                    >
                      <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>
                            Histórico de Decisões e Comunicações ({publicacoes.length})
                          </span>
                          {proc.homepageTribunal && (
                            <a
                              href={proc.homepageTribunal}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs font-semibold"
                              style={{ color: 'var(--color-accent)' }}
                            >
                              Acessar Portal do {proc.tribunal}
                              <ArrowSquareOut size={13} />
                            </a>
                          )}
                        </div>

                        {loadingProcessoId === proc.id ? (
                          <p className="text-xs py-4" style={{ color: 'var(--color-ink-muted)' }}>
                            Carregando comunicações do processo...
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {publicacoes.map(pub => (
                              <div
                                key={pub.id}
                                className="p-4 rounded-xl space-y-3"
                                style={{
                                  background: 'var(--color-surface-raised)',
                                  border: '1px solid var(--color-edge)',
                                }}
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <TipoBadge tipo={pub.tipoComunicacao} />
                                    <span className="font-mono text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                                      Disponibilizado em {pub.dataDisponibilizacao ?? '—'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void copiarTexto(pub)}
                                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                                      style={{
                                        background: 'var(--color-surface-overlay)',
                                        color: copiedPubId === pub.id ? '#4ade80' : 'var(--color-ink)',
                                        border: '1px solid var(--color-edge)',
                                      }}
                                    >
                                      {copiedPubId === pub.id ? <Check size={12} weight="bold" /> : <Copy size={12} />}
                                      {copiedPubId === pub.id ? 'Copiado!' : 'Copiar p/ IA'}
                                    </button>

                                    {pub.hash && (
                                      <a
                                        href={urlCertidao(pub.hash)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                                        style={{
                                          background: 'rgba(224,159,62,0.12)',
                                          color: 'var(--color-accent)',
                                          border: '1px solid rgba(224,159,62,0.25)',
                                        }}
                                      >
                                        <FilePdf size={13} />
                                        Certidão PDF
                                      </a>
                                    )}
                                  </div>
                                </div>

                                {/* Partes desta comunicação */}
                                {pub.partes.length > 0 && (
                                  <div className="flex items-center gap-2 flex-wrap pt-1">
                                    {pub.partes.map((pt, idx) => (
                                      <span
                                        key={idx}
                                        className="text-xs px-2 py-0.5 rounded-md flex items-center gap-1.5"
                                        style={{
                                          background: 'var(--color-surface-overlay)',
                                          color: 'var(--color-ink)',
                                          border: '1px solid var(--color-edge-subtle)',
                                        }}
                                      >
                                        {pt.polo && (
                                          <strong
                                            style={{
                                              color: pt.polo === 'A' ? '#60a5fa' : pt.polo === 'P' ? '#f87171' : '#e09f3e',
                                            }}
                                          >
                                            [{pt.polo}]
                                          </strong>
                                        )}
                                        {pt.nome}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Texto com Contraste Legível */}
                                <p
                                  className="text-sm leading-relaxed whitespace-pre-line"
                                  style={{ color: 'var(--color-ink)' }}
                                >
                                  {pub.texto}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          <Pagination
            currentPage={page}
            totalItems={total}
            itemsPerPage={25}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}

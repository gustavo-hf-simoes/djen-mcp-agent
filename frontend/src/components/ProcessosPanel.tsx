import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderSimple,
  CaretDown,
  Buildings,
  ArrowSquareOut,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import {
  buscarProcessosLocais,
  buscarPublicacoesDoProcessoLocal,
  type ProcessoResumoDto,
  type PublicacaoLocalDto,
} from '../api/djen'
import { Pagination } from './Pagination'
import { LoadingState } from './LoadingState'
import { EmptyState } from './EmptyState'

interface ProcessosPanelProps {
  refreshTrigger: number
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

  return (
    <div className="space-y-5">
      <div
        className="p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
      >
        <div>
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>
            Pastas Digitais de Processos ({total.toLocaleString('pt-BR')} processos únicos)
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-ink-faint)' }}>
            Clique em um processo CNJ para abrir toda a linha do tempo de intimações e decisões arquivadas.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <MagnifyingGlass
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-ink-faint)' }}
          />
          <input
            type="text"
            placeholder="Buscar número CNJ..."
            value={buscaCnj}
            onChange={e => { setBuscaCnj(e.target.value); setPage(1) }}
            className="w-full h-9 pl-8 pr-3 rounded-lg text-xs font-mono outline-none"
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
      ) : processos.length === 0 ? (
        <EmptyState variant="no-results" />
      ) : (
        <div className="space-y-2.5">
          {processos.map(proc => {
            const isOpen = openProcessoId === proc.id
            const publicacoes = historicoMap[proc.id] ?? []

            return (
              <div
                key={proc.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
              >
                <button
                  type="button"
                  onClick={() => void toggleProcesso(proc.id)}
                  className="w-full p-4 flex items-center justify-between gap-4 text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: 'rgba(224,159,62,0.12)',
                        color: 'var(--color-accent)',
                        border: '1px solid rgba(224,159,62,0.25)',
                      }}
                    >
                      <FolderSimple size={18} weight="bold" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold" style={{ color: 'var(--color-ink)' }}>
                          {proc.numeroProcesso}
                        </span>
                        {proc.tribunal && (
                          <span
                            className="font-mono text-[11px] px-2 py-0.5 rounded-full"
                            style={{
                              background: 'var(--color-surface-overlay)',
                              color: 'var(--color-ink-muted)',
                            }}
                          >
                            {proc.tribunal}
                          </span>
                        )}
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(96,165,250,0.12)',
                            color: '#60a5fa',
                          }}
                        >
                          {proc.quantidadePublicacoes} publicaç{proc.quantidadePublicacoes === 1 ? 'ão' : 'ões'}
                        </span>
                      </div>
                      <p className="text-xs truncate mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-ink-faint)' }}>
                        <Buildings size={12} />
                        {proc.orgaoJulgador ?? 'Órgão julgador não informado'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {proc.ultimaPublicacao && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[11px] font-mono" style={{ color: 'var(--color-ink-muted)' }}>
                          Última: {proc.ultimaPublicacao.data ?? '—'}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>
                          {proc.ultimaPublicacao.tipoComunicacao ?? 'Publicação'} · {proc.ultimaPublicacao.statusLeitura}
                        </p>
                      </div>
                    )}
                    <CaretDown
                      size={15}
                      className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--color-ink-faint)' }}
                    />
                  </div>
                </button>

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
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold" style={{ color: 'var(--color-ink-muted)' }}>
                            Linha do Tempo do Processo
                          </span>
                          {proc.homepageTribunal && (
                            <a
                              href={proc.homepageTribunal}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs font-semibold"
                              style={{ color: 'var(--color-accent)' }}
                            >
                              Portal do Tribunal ({proc.tribunal})
                              <ArrowSquareOut size={12} />
                            </a>
                          )}
                        </div>

                        {loadingProcessoId === proc.id ? (
                          <p className="text-xs py-3" style={{ color: 'var(--color-ink-faint)' }}>
                            Carregando histórico de comunicações...
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {publicacoes.map(pub => (
                              <div
                                key={pub.id}
                                className="p-3.5 rounded-xl space-y-1.5"
                                style={{
                                  background: 'var(--color-surface-raised)',
                                  border: '1px solid var(--color-edge)',
                                }}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>
                                    {pub.tipoComunicacao}
                                  </span>
                                  <span className="font-mono" style={{ color: 'var(--color-ink-faint)' }}>
                                    Disp: {pub.dataDisponibilizacao} · Status: {pub.statusLeitura}
                                  </span>
                                </div>
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>
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

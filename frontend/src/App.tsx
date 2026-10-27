import { useState, useCallback, useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Warning, Timer } from '@phosphor-icons/react'

import { Layout } from './components/Layout'
import { FilterPanel, type FilterValues } from './components/FilterPanel'
import { ResultCard } from './components/ResultCard'
import { LoadingState } from './components/LoadingState'
import { EmptyState } from './components/EmptyState'
import { Pagination } from './components/Pagination'

import { buscarComunicacoes, DjenError } from './api/djen'
import type { BuscaParams, Comunicacao } from './types/comunicacao'

const OAB_NUMERO   = '69161'
const OAB_UF       = 'PR'
const ITEMS_PER_PAGE = 100

// ─── Banner de erro ───────────────────────────────────────────────────────────

function ErrorBanner({ message, isRateLimit, status }: { message: string; isRateLimit: boolean; status?: number }) {
  // 503 / manutenção → aviso âmbar; outros erros → vermelho
  const isWarning = isRateLimit || status === 503 || status === 502 || status === 504

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-3 p-4 rounded-xl text-sm"
      style={{
        background: isWarning ? 'rgba(224,159,62,0.08)' : 'rgba(239,68,68,0.08)',
        border:     isWarning ? '1px solid rgba(224,159,62,0.2)' : '1px solid rgba(239,68,68,0.2)',
        color:      isWarning ? '#e09f3e' : '#f87171',
      }}
    >
      <div className="shrink-0 mt-0.5">
        {isWarning
          ? <Timer size={17} weight="bold" />
          : <Warning size={17} weight="bold" />
        }
      </div>
      <div>
        <p className="font-semibold mb-0.5 text-sm">
          {isRateLimit
            ? 'Limite de requisições atingido'
            : status === 503
            ? 'Sistema temporariamente indisponível'
            : 'Erro ao buscar comunicações'
          }
        </p>
        <p className="text-xs opacity-75">{message}</p>
      </div>
    </motion.div>
  )
}

// ─── Cabeçalho dos resultados ─────────────────────────────────────────────────

function ResultsHeader({ total, filtered, hasClientFilter, siglaTribunal }: {
  total: number
  filtered: number
  hasClientFilter: boolean
  siglaTribunal?: string
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-ink)' }}>
          {hasClientFilter ? (
            <>
              {filtered.toLocaleString('pt-BR')} comunicaç{filtered !== 1 ? 'ões' : 'ão'}
              {' '}
              <span style={{ color: 'var(--color-ink-faint)', fontWeight: 400 }}>
                de {total.toLocaleString('pt-BR')} carregadas
              </span>
            </>
          ) : (
            <>{total.toLocaleString('pt-BR')} comunicaç{total !== 1 ? 'ões' : 'ão'}</>
          )}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>
          OAB {OAB_NUMERO}/{OAB_UF}{siglaTribunal ? ` · ${siglaTribunal}` : ''}
        </p>
      </div>
      {total >= 10000 && (
        <span className="text-xs px-2 py-1 rounded-lg"
          style={{
            color: 'var(--color-accent)',
            background: 'var(--color-accent-dim)',
            border: '1px solid rgba(224,159,62,0.2)',
          }}>
          Limitado a 10.000 — use filtros de data
        </span>
      )}
    </motion.div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

type AppStatus = 'loading' | 'success' | 'error'

export function App() {
  const [status, setStatus]             = useState<AppStatus>('loading')
  const [errorMsg, setErrorMsg]         = useState('')
  const [isRateLimit, setIsRateLimit]   = useState(false)
  const [errorStatus, setErrorStatus]   = useState<number | undefined>()
  const [allItems, setAllItems]         = useState<Comunicacao[]>([])
  const [total, setTotal]               = useState(0)
  const [currentPage, setCurrentPage]   = useState(1)
  const [lastApiParams, setLastApiParams] = useState<BuscaParams>({})
  const [clientFilters, setClientFilters] = useState<Pick<FilterValues, 'tipoComunicacao' | 'textoBusca'>>({
    tipoComunicacao: '',
    textoBusca: '',
  })

  const executeSearch = useCallback(async (apiParams: BuscaParams, page: number) => {
    setStatus('loading')
    setErrorMsg('')
    setIsRateLimit(false)
    setErrorStatus(undefined)
    try {
      const response = await buscarComunicacoes({
        ...apiParams,
        numeroOab: OAB_NUMERO,
        ufOab: OAB_UF,
        pagina: page,
        itensPorPagina: ITEMS_PER_PAGE,
      })
      setAllItems(response.items ?? [])
      setTotal(response.count ?? 0)
      setCurrentPage(page)
      setLastApiParams(apiParams)
      setStatus('success')
    } catch (err) {
      if (err instanceof DjenError) {
        setErrorMsg(err.message)
        setIsRateLimit(err.isRateLimit)
        setErrorStatus(err.status)
      } else {
        setErrorMsg('Ocorreu um erro inesperado. Tente novamente.')
        setErrorStatus(undefined)
      }
      setStatus('error')
    }
  }, [])

  // Carrega automaticamente ao abrir
  useEffect(() => { void executeSearch({}, 1) }, [executeSearch])

  // Tribunais presentes nos dados carregados — derivado, nunca fixo
  const tribunaisDisponiveis = useMemo(() => {
    const siglas = Array.from(new Set(allItems.map(i => i.siglaTribunal).filter(Boolean)))
    return siglas.sort()
  }, [allItems])

  // Filtros client-side
  const filteredItems = useMemo(() => {
    let items = allItems
    if (clientFilters.tipoComunicacao) {
      items = items.filter(i => i.tipoComunicacao === clientFilters.tipoComunicacao)
    }
    if (clientFilters.textoBusca.trim()) {
      const q = clientFilters.textoBusca.trim().toLowerCase()
      items = items.filter(i =>
        i.texto?.toLowerCase().includes(q) ||
        i.numero_processo?.toLowerCase().includes(q) ||
        i.numeroprocessocommascara?.toLowerCase().includes(q) ||
        i.nomeOrgao?.toLowerCase().includes(q) ||
        i.nomeClasse?.toLowerCase().includes(q)
      )
    }
    return items
  }, [allItems, clientFilters])

  function handleFilter(apiParams: BuscaParams, cf: Pick<FilterValues, 'tipoComunicacao' | 'textoBusca'>) {
    setClientFilters(cf)
    const apiChanged =
      apiParams.siglaTribunal              !== lastApiParams.siglaTribunal ||
      apiParams.dataDisponibilizacaoInicio !== lastApiParams.dataDisponibilizacaoInicio ||
      apiParams.dataDisponibilizacaoFim    !== lastApiParams.dataDisponibilizacaoFim
    if (apiChanged) void executeSearch(apiParams, 1)
  }

  function handlePageChange(page: number) {
    void executeSearch(lastApiParams, page)
    document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const hasClientFilter = Boolean(clientFilters.tipoComunicacao || clientFilters.textoBusca)
  const isLoading = status === 'loading'

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 lg:items-start">

        {/* Painel de filtros */}
        <div className="w-full lg:w-60 lg:sticky lg:top-20 shrink-0">
          <FilterPanel loading={isLoading} tribunais={tribunaisDisponiveis} onFilter={handleFilter} />
        </div>

        {/* Resultados */}
        <div id="resultados" className="flex-1 min-w-0 space-y-4">

          <AnimatePresence>
            {status === 'error' && (
              <ErrorBanner message={errorMsg} isRateLimit={isRateLimit} status={errorStatus} />
            )}
          </AnimatePresence>

          {isLoading && <LoadingState />}

          {status === 'success' && (
            <div className="space-y-4">
              <ResultsHeader
                total={total}
                filtered={filteredItems.length}
                hasClientFilter={hasClientFilter}
                siglaTribunal={lastApiParams.siglaTribunal}
              />

              {filteredItems.length === 0
                ? <EmptyState variant="no-results" />
                : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${currentPage}-${clientFilters.tipoComunicacao}-${clientFilters.textoBusca}`}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2"
                    >
                      {filteredItems.map((c, i) => (
                        <ResultCard key={c.id} comunicacao={c} index={i} />
                      ))}
                    </motion.div>
                  </AnimatePresence>
                )
              }

              {!hasClientFilter && filteredItems.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalItems={total}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={handlePageChange}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

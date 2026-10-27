import { useState, useCallback, useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Warning, Timer } from '@phosphor-icons/react'

import { Layout } from './components/Layout'
import type { ActiveTab } from './components/Header'
import { LoginScreen } from './components/LoginScreen'
import { ControladoriaPanel } from './components/ControladoriaPanel'
import { ProcessosPanel } from './components/ProcessosPanel'
import { SaasAdminPanel } from './components/SaasAdminPanel'
import { FilterPanel, type FilterValues } from './components/FilterPanel'
import { ResultCard } from './components/ResultCard'
import { LoadingState } from './components/LoadingState'
import { EmptyState } from './components/EmptyState'
import { Pagination } from './components/Pagination'

import {
  buscarComunicacoes,
  buscarSessaoAtual,
  sincronizarDjenAgora,
  getStoredToken,
  setStoredToken,
  DjenError,
  type UsuarioSessao,
} from './api/djen'
import type { BuscaParams, Comunicacao } from './types/comunicacao'

const ITEMS_PER_PAGE = 100

// ─── Banner de erro ───────────────────────────────────────────────────────────

function ErrorBanner({ message, isRateLimit, status }: { message: string; isRateLimit: boolean; status?: number }) {
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

function ResultsHeader({ total, filtered, hasClientFilter, siglaTribunal, oabNumero, oabUf }: {
  total: number
  filtered: number
  hasClientFilter: boolean
  siglaTribunal?: string
  oabNumero: string
  oabUf: string
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
          OAB {oabNumero}/{oabUf}{siglaTribunal ? ` · ${siglaTribunal}` : ''}
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
  const [usuario, setUsuario]           = useState<UsuarioSessao | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [activeTab, setActiveTab]       = useState<ActiveTab>('controladoria')
  const [syncing, setSyncing]           = useState(false)
  const [syncMessage, setSyncMessage]   = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

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

  // Restaura sessão ao abrir
  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setCheckingAuth(false)
      return
    }
    buscarSessaoAtual()
      .then(res => setUsuario(res.usuario))
      .catch(() => setStoredToken(null))
      .finally(() => setCheckingAuth(false))
  }, [])

  const executeSearch = useCallback(async (apiParams: BuscaParams, page: number, oabNumero = '69161', oabUf = 'PR') => {
    setStatus('loading')
    setErrorMsg('')
    setIsRateLimit(false)
    setErrorStatus(undefined)
    try {
      const response = await buscarComunicacoes({
        ...apiParams,
        numeroOab: oabNumero,
        ufOab: oabUf,
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
        if (err.status === 401) {
          setStoredToken(null)
          setUsuario(null)
          return
        }
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

  useEffect(() => {
    if (usuario && activeTab === 'djen_live') {
      void executeSearch({}, 1, usuario.oab.numero, usuario.oab.uf)
    }
  }, [usuario, activeTab, executeSearch])

  async function handleSyncNow() {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await sincronizarDjenAgora(14)
      setSyncMessage(
        `Sincronização DJEN concluída (${res.dataInicio} a ${res.dataFim}): ${res.totalComunicacoesEncontradas} comunicações verificadas e persistidas.`
      )
      setRefreshTrigger(v => v + 1)
    } catch (err) {
      if (err instanceof DjenError) {
        setSyncMessage(`Aviso na sincronização: ${err.message}`)
      } else {
        setSyncMessage('Não foi possível sincronizar agora.')
      }
    } finally {
      setSyncing(false)
    }
  }

  function handleLogout() {
    setStoredToken(null)
    setUsuario(null)
  }

  const tribunaisDisponiveis = useMemo(() => {
    const siglas = Array.from(new Set(allItems.map(i => i.siglaTribunal).filter(Boolean)))
    return siglas.sort()
  }, [allItems])

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
    if (apiChanged && usuario) void executeSearch(apiParams, 1, usuario.oab.numero, usuario.oab.uf)
  }

  function handlePageChange(page: number) {
    if (usuario) void executeSearch(lastApiParams, page, usuario.oab.numero, usuario.oab.uf)
    document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (checkingAuth) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
        <LoadingState />
      </div>
    )
  }

  if (!usuario) {
    return <LoginScreen onSuccess={setUsuario} />
  }

  const hasClientFilter = Boolean(clientFilters.tipoComunicacao || clientFilters.textoBusca)
  const isLoading = status === 'loading'

  return (
    <Layout
      usuario={usuario}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onSyncNow={() => void handleSyncNow()}
      syncing={syncing}
      onLogout={handleLogout}
    >
      {syncMessage && (
        <div
          className="mb-6 p-3.5 rounded-xl text-xs font-medium flex items-center justify-between"
          style={{
            background: 'rgba(224,159,62,0.12)',
            border: '1px solid rgba(224,159,62,0.3)',
            color: 'var(--color-accent)',
          }}
        >
          <span>{syncMessage}</span>
          <button type="button" onClick={() => setSyncMessage(null)} className="text-xs underline ml-4">
            Fechar
          </button>
        </div>
      )}

      {activeTab === 'controladoria' && (
        <ControladoriaPanel refreshTrigger={refreshTrigger} />
      )}

      {activeTab === 'processos' && (
        <ProcessosPanel refreshTrigger={refreshTrigger} />
      )}

      {activeTab === 'saas_admin' && (
        <SaasAdminPanel usuarioLogado={usuario} />
      )}

      {activeTab === 'djen_live' && (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 lg:items-start">
          <div className="w-full lg:w-60 lg:sticky lg:top-28 shrink-0">
            <FilterPanel loading={isLoading} tribunais={tribunaisDisponiveis} onFilter={handleFilter} />
          </div>

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
                  oabNumero={usuario.oab.numero}
                  oabUf={usuario.oab.uf}
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
      )}
    </Layout>
  )
}

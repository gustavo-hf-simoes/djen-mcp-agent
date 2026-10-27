import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlass,
  ArrowCounterClockwise,
  CaretDown,
  Funnel,
  CalendarBlank,
  Buildings,
} from '@phosphor-icons/react'
import type { BuscaParams } from '../types/comunicacao'
import { periodoHoje, periodoUltimosDias } from '../api/djen'

const TIPOS = [
  { label: 'Intimação' },
  { label: 'Lista de distribuição' },
  { label: 'Ata de sessão' },
]

const PERIODOS = [
  { label: 'Hoje', fn: () => periodoHoje() },
  { label: '7d',   fn: () => periodoUltimosDias(7) },
  { label: '30d',  fn: () => periodoUltimosDias(30) },
  { label: '90d',  fn: () => periodoUltimosDias(90) },
]

export interface FilterValues {
  siglaTribunal: string
  dataInicio: string
  dataFim: string
  tipoComunicacao: string
  textoBusca: string
}

interface FilterPanelProps {
  loading: boolean
  tribunais: string[]
  onFilter: (apiParams: BuscaParams, clientFilters: Pick<FilterValues, 'tipoComunicacao' | 'textoBusca'>) => void
}

export function FilterPanel({ loading, tribunais, onFilter }: FilterPanelProps) {
  const [siglaTribunal, setSiglaTribunal]     = useState('')
  const [dataInicio, setDataInicio]           = useState('')
  const [dataFim, setDataFim]                 = useState('')
  const [tipoComunicacao, setTipoComunicacao] = useState('')
  const [textoBusca, setTextoBusca]           = useState('')
  const [activePeriod, setActivePeriod]       = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen]         = useState(false)

  function aplicarPeriodo(label: string, fn: () => { inicio: string; fim: string }) {
    const { inicio, fim } = fn()
    setDataInicio(inicio)
    setDataFim(fim)
    setActivePeriod(label)
  }

  const temFiltro = Boolean(siglaTribunal || dataInicio || dataFim || tipoComunicacao || textoBusca)

  function limpar() {
    setSiglaTribunal(''); setDataInicio(''); setDataFim('')
    setTipoComunicacao(''); setTextoBusca(''); setActivePeriod(null)
    onFilter({}, { tipoComunicacao: '', textoBusca: '' })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const apiParams: BuscaParams = {}
    if (siglaTribunal) apiParams.siglaTribunal              = siglaTribunal
    if (dataInicio)    apiParams.dataDisponibilizacaoInicio = dataInicio
    if (dataFim)       apiParams.dataDisponibilizacaoFim    = dataFim
    onFilter(apiParams, { tipoComunicacao, textoBusca })
  }

  const inputCls = 'w-full h-10 px-3 rounded-lg text-sm outline-none transition-all duration-150 placeholder:opacity-40'

  return (
    <form onSubmit={handleSubmit}>
      {/* ── Card container ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}>

        {/* Cabeçalho do card */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--color-edge-subtle)' }}>
          <div>
            <div className="flex items-center gap-2">
              <Funnel size={13} weight="bold" style={{ color: 'var(--color-accent)' }} />
              <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-ink)' }}>
                Filtros
              </span>
            </div>
            {/* <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>
              OAB 69.161 · PR
            </p> */}
          </div>
          {temFiltro && (
            <button type="button" onClick={limpar}
              className="flex items-center gap-1 text-xs transition-colors duration-150"
              style={{ color: 'var(--color-ink-faint)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink-faint)')}>
              <ArrowCounterClockwise size={12} weight="bold" />
              Limpar
            </button>
          )}
        </div>

        <div className="p-5 space-y-5">

          {/* Busca livre */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-ink-faint)' }}>
              Busca no texto
            </label>
            <div className="relative">
              <MagnifyingGlass size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-ink-faint)' }} />
              <input type="text" placeholder="Processo, palavra-chave..."
                value={textoBusca} onChange={e => setTextoBusca(e.target.value)}
                className={inputCls + ' pl-8 focus:ring-2 focus:ring-accent/20 focus:border-accent'}
                style={{ background: 'var(--color-surface-input)', border: '1px solid var(--color-edge)', color: 'var(--color-ink)' }} />
            </div>
            <p className="text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>
              Filtra nos resultados carregados
            </p>
          </div>

          {/* Tipo de comunicação */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-ink-faint)' }}>
              Tipo
            </label>
            <div className="relative">
              <select
                value={tipoComunicacao}
                onChange={e => setTipoComunicacao(e.target.value)}
                className="w-full h-10 pl-3 pr-8 rounded-lg text-sm appearance-none outline-none cursor-pointer transition-all duration-150 focus:ring-2 focus:ring-accent/20 focus:border-accent"
                style={{ background: 'var(--color-surface-input)', border: '1px solid var(--color-edge)', color: 'var(--color-ink)' }}
              >
                <option value="">Todos os tipos</option>
                {TIPOS.map(({ label }) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
              <CaretDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-ink-faint)' }} />
            </div>
          </div>

          {/* Filtros avançados — toggle */}
          <div>
            <button type="button" onClick={() => setFiltersOpen(v => !v)}
              className="flex items-center gap-2 text-xs font-medium transition-colors duration-150"
              style={{ color: 'var(--color-ink-faint)' }}>
              <Buildings size={12} weight="bold" />
              Tribunal e período
              <CaretDown size={11}
                className={`transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {filtersOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-4">

                    {/* Tribunal select */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--color-ink-faint)' }}>
                        Tribunal
                      </label>
                      <div className="relative">
                        <select
                          value={siglaTribunal}
                          onChange={e => setSiglaTribunal(e.target.value)}
                          className="w-full h-10 pl-3 pr-8 rounded-lg text-sm appearance-none outline-none cursor-pointer transition-all duration-150 focus:ring-2 focus:ring-accent/20 focus:border-accent"
                          style={{ background: 'var(--color-surface-input)', border: '1px solid var(--color-edge)', color: 'var(--color-ink)' }}
                        >
                          <option value="">Todos os tribunais</option>
                          {tribunais.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <CaretDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ color: 'var(--color-ink-faint)' }} />
                      </div>
                    </div>

                    {/* Atalhos de período */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--color-ink-faint)' }}>
                        <CalendarBlank size={11} weight="bold" />
                        Período
                        {activePeriod && (
                          <span className="normal-case font-bold" style={{ color: 'var(--color-accent)' }}>
                            — {activePeriod}
                          </span>
                        )}
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {PERIODOS.map(({ label, fn }) => {
                          const active = activePeriod === label
                          return (
                            <button key={label} type="button"
                              onClick={() => aplicarPeriodo(label, fn)}
                              className="text-xs py-2 rounded-lg font-medium transition-all duration-150 active:scale-[0.97]"
                              style={{
                                background: active ? 'var(--color-accent)' : 'var(--color-surface-overlay)',
                                border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-edge)'}`,
                                color: active ? 'var(--color-accent-on)' : 'var(--color-ink-muted)',
                              }}>
                              {label}
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex flex-col gap-2">
                        {[
                          { label: 'De',  val: dataInicio, set: (v: string) => { setDataInicio(v); setActivePeriod(null) } },
                          { label: 'Até', val: dataFim,    set: (v: string) => { setDataFim(v);   setActivePeriod(null) } },
                        ].map(({ label, val, set }) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wider w-6 shrink-0"
                              style={{ color: 'var(--color-ink-faint)' }}>{label}</span>
                            <input type="date" value={val} onChange={e => set(e.target.value)}
                              className="flex-1 h-9 pl-3 pr-2 rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-accent/20 focus:border-accent"
                              style={{ background: 'var(--color-surface-input)', border: '1px solid var(--color-edge)', color: 'var(--color-ink)', colorScheme: 'dark' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Botão */}
        <div className="px-5 pb-5">
          <button type="submit" disabled={loading}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold tracking-tight
              transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-on)',
              boxShadow: '0 2px 14px rgba(224,159,62,0.2)',
            }}>
            {loading
              ? <span className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
              : <><MagnifyingGlass size={15} weight="bold" /> Aplicar filtros</>
            }
          </button>
        </div>
      </div>
    </form>
  )
}

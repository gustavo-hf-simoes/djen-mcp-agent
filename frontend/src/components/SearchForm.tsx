import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlass,
  IdentificationCard,
  Gavel,
  User,
  Buildings,
  CalendarBlank,
  CaretDown,
  X,
  Funnel,
} from '@phosphor-icons/react'
import type { BuscaParams, MeioComunicacao, Tribunal } from '../types/comunicacao'
import { buscarTribunais, periodoHoje, periodoUltimosDias } from '../api/djen'

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]

const PERIODOS = [
  { label: 'Hoje', fn: () => periodoHoje() },
  { label: '7 dias', fn: () => periodoUltimosDias(7) },
  { label: '30 dias', fn: () => periodoUltimosDias(30) },
  { label: '90 dias', fn: () => periodoUltimosDias(90) },
]

interface SearchFormProps {
  onSearch: (params: BuscaParams) => void
  loading: boolean
}

export function SearchForm({ onSearch, loading }: SearchFormProps) {
  // Campos principais — pré-preenchidos com as credenciais do advogado
  const [numeroOab, setNumeroOab] = useState('69161')
  const [ufOab, setUfOab] = useState('PR')
  const [nomeAdvogado, setNomeAdvogado] = useState('')
  const [nomeParte, setNomeParte] = useState('')
  const [numeroProcesso, setNumeroProcesso] = useState('')

  // Filtros
  const [siglaTribunal, setSiglaTribunal] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [meio, setMeio] = useState<MeioComunicacao | ''>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activePeriod, setActivePeriod] = useState<string | null>(null)

  // Tribunais para o select
  const [tribunais, setTribunais] = useState<Tribunal[]>([])

  useEffect(() => {
    buscarTribunais()
      .then(setTribunais)
      .catch(() => { /* falha silenciosa no carregamento dos tribunais */ })
  }, [])

  function aplicarPeriodo(label: string, fn: () => { inicio: string; fim: string }) {
    const { inicio, fim } = fn()
    setDataInicio(inicio)
    setDataFim(fim)
    setActivePeriod(label)
  }

  function limparFiltros() {
    setSiglaTribunal('')
    setDataInicio('')
    setDataFim('')
    setMeio('')
    setActivePeriod(null)
  }

  function temFiltroAtivo() {
    return Boolean(siglaTribunal || dataInicio || dataFim || meio)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const params: BuscaParams = {}
    if (numeroOab)      params.numeroOab      = numeroOab
    if (ufOab)          params.ufOab          = ufOab
    if (nomeAdvogado)   params.nomeAdvogado   = nomeAdvogado
    if (nomeParte)      params.nomeParte      = nomeParte
    if (numeroProcesso) params.numeroProcesso = numeroProcesso
    if (siglaTribunal)  params.siglaTribunal  = siglaTribunal
    if (dataInicio)     params.dataDisponibilizacaoInicio = dataInicio
    if (dataFim)        params.dataDisponibilizacaoFim    = dataFim
    if (meio)           params.meio = meio

    onSearch(params)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] overflow-hidden">

        {/* ── Cabeçalho do formulário ── */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
            Buscar comunicações
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Use a OAB, número do processo ou nome para encontrar intimações e citações.
          </p>
        </div>

        <div className="p-6 space-y-5">

          {/* ── Bloco OAB ── */}
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
              <IdentificationCard size={13} weight="bold" />
              OAB do advogado
            </legend>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Ex: 123456"
                  value={numeroOab}
                  onChange={e => setNumeroOab(e.target.value)}
                  className="w-full h-10 pl-3 pr-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400
                    focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                />
              </div>
              <div className="w-28">
                <select
                  value={ufOab}
                  onChange={e => setUfOab(e.target.value)}
                  className="w-full h-10 pl-3 pr-7 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900
                    focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">UF</option>
                  {UFS.map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {/* ── Separador ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-100" />
            <span className="text-xs text-zinc-400">ou busque por</span>
            <div className="flex-1 h-px bg-zinc-100" />
          </div>

          {/* ── Outros campos ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <User size={13} weight="bold" />
                Nome do advogado
              </label>
              <input
                type="text"
                placeholder="Nome completo ou parcial"
                value={nomeAdvogado}
                onChange={e => setNomeAdvogado(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400
                  focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <User size={13} weight="bold" />
                Nome da parte
              </label>
              <input
                type="text"
                placeholder="Nome da parte"
                value={nomeParte}
                onChange={e => setNomeParte(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400
                  focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <Gavel size={13} weight="bold" />
                Número do processo
              </label>
              <input
                type="text"
                placeholder="0000000-00.0000.0.00.0000"
                value={numeroProcesso}
                onChange={e => setNumeroProcesso(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400
                  focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all font-mono"
              />
            </div>
          </div>

          {/* ── Filtros avançados (toggle) ── */}
          <div>
            <button
              type="button"
              onClick={() => setFiltersOpen(v => !v)}
              className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-brand-600 transition-colors group"
            >
              <Funnel size={13} weight={temFiltroAtivo() ? 'fill' : 'regular'} className={temFiltroAtivo() ? 'text-brand-500' : ''} />
              Filtros avançados
              {temFiltroAtivo() && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-100 text-brand-600 text-[10px] font-bold">
                  {[siglaTribunal, dataInicio || dataFim, meio].filter(Boolean).length}
                </span>
              )}
              <CaretDown
                size={12}
                className={`transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {filtersOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                      {/* Tribunal */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                          <Buildings size={13} weight="bold" />
                          Tribunal
                        </label>
                        <div className="relative">
                          <select
                            value={siglaTribunal}
                            onChange={e => setSiglaTribunal(e.target.value)}
                            className="w-full h-10 pl-3 pr-7 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900
                              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all appearance-none cursor-pointer"
                          >
                            <option value="">Todos os tribunais</option>
                            {tribunais.length > 0
                              ? tribunais.map(t => (
                                  <option key={t.sigla} value={t.sigla}>
                                    {t.sigla} — {t.nome}
                                  </option>
                                ))
                              : UFS.flatMap(uf => [
                                  { sigla: `TJ${uf}`, label: `TJ${uf}` },
                                ]).map(t => (
                                  <option key={t.sigla} value={t.sigla}>{t.label}</option>
                                ))
                            }
                          </select>
                          <CaretDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Data início */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                          <CalendarBlank size={13} weight="bold" />
                          Data inicial
                        </label>
                        <input
                          type="date"
                          value={dataInicio}
                          onChange={e => { setDataInicio(e.target.value); setActivePeriod(null) }}
                          className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900
                            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                        />
                      </div>

                      {/* Data fim */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
                          Data final
                        </label>
                        <input
                          type="date"
                          value={dataFim}
                          onChange={e => { setDataFim(e.target.value); setActivePeriod(null) }}
                          className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900
                            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Atalhos de período + tipo */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">Período:</span>
                        {PERIODOS.map(({ label, fn }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => aplicarPeriodo(label, fn)}
                            className={`text-xs px-2.5 py-1 rounded-md border transition-all
                              ${activePeriod === label
                                ? 'bg-brand-600 border-brand-600 text-white'
                                : 'border-zinc-200 text-zinc-600 hover:border-brand-400 hover:text-brand-600'
                              }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">Tipo:</span>
                        {(['D', 'E'] as MeioComunicacao[]).map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMeio(prev => prev === m ? '' : m)}
                            className={`text-xs px-2.5 py-1 rounded-md border transition-all
                              ${meio === m
                                ? 'bg-brand-600 border-brand-600 text-white'
                                : 'border-zinc-200 text-zinc-600 hover:border-brand-400 hover:text-brand-600'
                              }`}
                          >
                            {m === 'D' ? 'Diário Eletrônico' : 'Edital'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {temFiltroAtivo() && (
                      <button
                        type="button"
                        onClick={limparFiltros}
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-rose-500 transition-colors"
                      >
                        <X size={12} />
                        Limpar filtros
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Botão de busca ── */}
        <div className="px-6 pb-6">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700
              text-white text-sm font-semibold tracking-tight
              transition-all duration-200 active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100
              shadow-[0_2px_8px_rgba(79,85,230,0.35)]"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <MagnifyingGlass size={16} weight="bold" />
                Buscar comunicações
              </>
            )}
          </button>
        </div>

      </div>
    </form>
  )
}

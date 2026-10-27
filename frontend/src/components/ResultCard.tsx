import { useState, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowSquareOut,
  CaretDown,
  FilePdf,
  Buildings,
  Gavel,
  Users,
  UserCircle,
} from '@phosphor-icons/react'
import type { Comunicacao } from '../types/comunicacao'
import { urlCertidao } from '../api/djen'

// ─── Badge de tipo ────────────────────────────────────────────────────────────

const TIPO_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  'Intimação':             { bg: 'rgba(224,159,62,0.12)', color: '#e09f3e', border: 'rgba(224,159,62,0.25)' },
  'Citação':               { bg: 'rgba(248,113,113,0.10)', color: '#f87171', border: 'rgba(248,113,113,0.22)' },
  'Edital':                { bg: 'rgba(74,222,128,0.10)',  color: '#4ade80', border: 'rgba(74,222,128,0.22)' },
  'Pauta de julgamento':   { bg: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: 'rgba(167,139,250,0.22)' },
  'Lista de distribuição': { bg: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: 'rgba(167,139,250,0.22)' },
  'Ata de sessão':         { bg: 'rgba(113,113,122,0.12)', color: '#a1a1aa', border: 'rgba(113,113,122,0.25)' },
}

function TipoBadge({ tipo }: { tipo: string }) {
  const s = TIPO_STYLE[tipo] ?? { bg: 'rgba(82,82,91,0.12)', color: '#a1a1aa', border: 'rgba(82,82,91,0.25)' }
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {tipo}
    </span>
  )
}

// ─── Texto expandível ─────────────────────────────────────────────────────────

function TextoComunicacao({ html, expanded }: { html: string; expanded: boolean }) {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const preview = plain.slice(0, 280)
  const hasMore = plain.length > 280

  return (
    <AnimatePresence mode="wait" initial={false}>
      {expanded ? (
        <motion.div key="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          dangerouslySetInnerHTML={{ __html: html }}
          className="text-sm leading-relaxed [&_table]:w-full [&_table]:text-xs [&_table]:my-2 [&_td]:py-1 [&_td]:pr-3"
          style={{ color: 'var(--color-ink-muted)' }} />
      ) : (
        <motion.p key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="text-sm leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>
          {preview}{hasMore && <span style={{ color: 'var(--color-ink-faint)' }}> …</span>}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export const ResultCard = memo(function ResultCard({ comunicacao, index }: { comunicacao: Comunicacao; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const advogados = comunicacao.destinatarioadvogados?.map(d => d.advogado).filter(Boolean) ?? []
  const partes    = comunicacao.destinatarios ?? []

  // Só mostra o botão "Ver texto completo" se houver conteúdo além do preview
  const textoPlain = (comunicacao.texto ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const hasMoreText = textoPlain.length > 280

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.035, 0.25), ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.35)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div className="p-5">

        {/* ── Badges + data ── */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <TipoBadge tipo={comunicacao.tipoComunicacao} />
            <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-ink-faint)', border: '1px solid var(--color-edge-subtle)' }}>
              {comunicacao.siglaTribunal}
            </span>
          </div>
          <time className="font-mono text-[11px] shrink-0 tabular-nums"
            style={{ color: 'var(--color-ink-faint)' }}>
            {comunicacao.datadisponibilizacao}
          </time>
        </div>

        {/* ── Número do processo ── */}
        <p className="font-mono text-sm font-semibold tracking-tight mb-1"
          style={{ color: 'var(--color-ink)' }}>
          {comunicacao.numeroprocessocommascara || comunicacao.numero_processo}
        </p>

        {/* ── Órgão + classe ── */}
        <div className="flex items-center gap-1.5 mb-4">
          <Buildings size={12} style={{ color: 'var(--color-ink-faint)' }} className="shrink-0" />
          <span className="text-xs truncate" style={{ color: 'var(--color-ink-faint)' }}>
            {comunicacao.nomeOrgao}
          </span>
          {comunicacao.nomeClasse && (
            <>
              <span style={{ color: 'var(--color-edge)' }}>·</span>
              <Gavel size={12} style={{ color: 'var(--color-ink-faint)' }} className="shrink-0" />
              <span className="text-xs truncate capitalize" style={{ color: 'var(--color-ink-faint)' }}>
                {comunicacao.nomeClasse.toLowerCase()}
              </span>
            </>
          )}
        </div>

        {/* ── Texto ── */}
        <TextoComunicacao html={comunicacao.texto} expanded={expanded} />

        {/* ── Partes + Advogados ── */}
        {(partes.length > 0 || advogados.length > 0) && (
          <div className="mt-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
            style={{ borderTop: '1px solid var(--color-edge-subtle)' }}>

            {partes.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Users size={11} style={{ color: 'var(--color-ink-faint)' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--color-ink-faint)' }}>Partes</span>
                </div>
                <ul className="space-y-1">
                  {partes.slice(0, 3).map((p, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          background: p.polo === 'A' ? 'rgba(96,165,250,0.12)' : p.polo === 'P' ? 'rgba(248,113,113,0.12)' : 'var(--color-surface-overlay)',
                          color: p.polo === 'A' ? '#60a5fa' : p.polo === 'P' ? '#f87171' : 'var(--color-ink-faint)',
                          border: p.polo === 'A' ? '1px solid rgba(96,165,250,0.22)' : p.polo === 'P' ? '1px solid rgba(248,113,113,0.22)' : '1px solid var(--color-edge)',
                        }}>
                        {p.polo}
                      </span>
                      <span className="truncate" style={{ color: 'var(--color-ink-muted)' }}>{p.nome}</span>
                    </li>
                  ))}
                  {partes.length > 3 && <li className="text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>+{partes.length - 3} outros</li>}
                </ul>
              </div>
            )}

            {advogados.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <UserCircle size={11} style={{ color: 'var(--color-ink-faint)' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--color-ink-faint)' }}>Advogados</span>
                </div>
                <ul className="space-y-1">
                  {advogados.slice(0, 3).map((adv, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-[10px] shrink-0" style={{ color: 'var(--color-ink-faint)' }}>
                        {adv.uf_oab}/{adv.numero_oab}
                      </span>
                      <span className="truncate" style={{ color: 'var(--color-ink-muted)' }}>{adv.nome}</span>
                    </li>
                  ))}
                  {advogados.length > 3 && <li className="text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>+{advogados.length - 3} outros</li>}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Rodapé ── */}
      <div className="flex items-center justify-between px-5 py-3"
        style={{ borderTop: '1px solid var(--color-edge-subtle)', background: 'var(--color-surface-overlay)' }}>
        {hasMoreText ? (
          <button onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors duration-150"
            style={{ color: 'var(--color-ink-faint)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink-muted)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink-faint)')}>
            <CaretDown size={12} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Recolher texto' : 'Ver texto completo'}
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1">
          <a href={urlCertidao(comunicacao.hash)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all duration-150"
            style={{ color: 'var(--color-ink-faint)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-ink-muted)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-raised)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-ink-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
            <FilePdf size={13} />
            Certidão
          </a>
          {comunicacao.link && (
            <a href={comunicacao.link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all duration-150"
              style={{ color: 'var(--color-accent)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-accent-dim)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              Inteiro teor
              <ArrowSquareOut size={12} />
            </a>
          )}
        </div>
      </div>
    </motion.article>
  )
})

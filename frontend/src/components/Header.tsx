import { Scales } from '@phosphor-icons/react'

export function Header() {
  return (
    <header className="w-full sticky top-0 z-40"
      style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-edge)' }}>
      <div className="max-w-350 mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">

        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-accent)' }}>
            <Scales size={15} weight="bold" style={{ color: 'var(--color-accent-on)' }} />
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-ink)' }}>
              Consultas DJEN
            </span>
            <span className="hidden sm:block text-xs" style={{ color: 'var(--color-ink-faint)' }}>
              Diário de Justiça Eletrônico Nacional
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="font-mono text-xs tracking-tight" style={{ color: 'var(--color-ink-muted)' }}>
            OAB 69.161/PR
          </span>
        </div>

      </div>
    </header>
  )
}

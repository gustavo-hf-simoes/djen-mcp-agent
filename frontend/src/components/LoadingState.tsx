export function LoadingState() {
  return (
    <div className="space-y-2" role="status" aria-label="Carregando">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="relative rounded-xl overflow-hidden pl-5 pr-5 pt-4 pb-4"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-edge)',
            animationDelay: `${i * 60}ms`,
          }}>
          {/* Barra lateral */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] animate-pulse"
            style={{ background: 'var(--color-edge)' }} />

          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              <div className="h-5 w-20 rounded-md animate-pulse" style={{ background: 'var(--color-surface-overlay)' }} />
              <div className="h-5 w-12 rounded-md animate-pulse" style={{ background: 'var(--color-surface-overlay)' }} />
            </div>
            <div className="h-4 w-20 rounded-md animate-pulse" style={{ background: 'var(--color-surface-overlay)' }} />
          </div>

          <div className="h-5 w-56 rounded-md animate-pulse mb-1.5" style={{ background: 'var(--color-surface-overlay)' }} />
          <div className="h-3.5 w-40 rounded-md animate-pulse mb-4" style={{ background: 'var(--color-surface-overlay)' }} />

          <div className="space-y-2">
            <div className="h-3 w-full rounded-md animate-pulse" style={{ background: 'var(--color-surface-overlay)' }} />
            <div className="h-3 w-4/5 rounded-md animate-pulse" style={{ background: 'var(--color-surface-overlay)' }} />
          </div>
        </div>
      ))}
      <span className="sr-only">Carregando comunicações...</span>
    </div>
  )
}

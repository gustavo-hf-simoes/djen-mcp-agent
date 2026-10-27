import { CaretLeft, CaretRight } from '@phosphor-icons/react'

interface PaginationProps {
  currentPage: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  if (totalPages <= 1) return null

  const start = (currentPage - 1) * itemsPerPage + 1
  const end   = Math.min(currentPage * itemsPerPage, totalItems)

  function getPages(): (number | '...')[] {
    const delta = 2
    const range: number[] = []
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i)
    }
    const pages: (number | '...')[] = [1]
    if (range[0] > 2) pages.push('...')
    pages.push(...range)
    if (range[range.length - 1] < totalPages - 1) pages.push('...')
    if (totalPages > 1) pages.push(totalPages)
    return pages
  }

  const btnBase = 'flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-all duration-150 active:scale-[0.97]'

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
      <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
        Mostrando{' '}
        <span className="font-mono font-semibold" style={{ color: 'var(--color-ink)' }}>{start}–{end}</span>
        {' '}de{' '}
        <span className="font-mono font-semibold" style={{ color: 'var(--color-ink)' }}>
          {totalItems >= 10000 ? '10.000+' : totalItems.toLocaleString('pt-BR')}
        </span>
        {' '}comunicações
      </p>

      <nav className="flex items-center gap-1" aria-label="Paginação">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Página anterior"
          className={btnBase}
          style={{
            border: '1px solid var(--color-edge)',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-ink-muted)',
            opacity: currentPage === 1 ? 0.35 : 1,
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          }}
        >
          <CaretLeft size={13} weight="bold" />
        </button>

        {getPages().map((page, i) =>
          page === '...' ? (
            <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs"
              style={{ color: 'var(--color-ink-faint)' }}>···</span>
          ) : (
            <button key={page} onClick={() => onPageChange(page as number)}
              aria-current={currentPage === page ? 'page' : undefined}
              className={btnBase}
              style={{
                border: currentPage === page ? '1px solid var(--color-accent)' : '1px solid var(--color-edge)',
                background: currentPage === page ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                color: currentPage === page ? 'var(--color-accent-on)' : 'var(--color-ink-muted)',
              }}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Próxima página"
          className={btnBase}
          style={{
            border: '1px solid var(--color-edge)',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-ink-muted)',
            opacity: currentPage === totalPages ? 0.35 : 1,
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          }}
        >
          <CaretRight size={13} weight="bold" />
        </button>
      </nav>
    </div>
  )
}

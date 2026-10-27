import type { ReactNode } from 'react'
import { Header } from './Header'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--color-surface)' }}>
      <Header />
      <main className="flex-1 w-full max-w-350 mx-auto px-6 lg:px-10 py-8">
        {children}
      </main>
      <footer style={{ borderTop: '1px solid var(--color-edge-subtle)' }} className="py-5">
        <div className="max-w-350 mx-auto px-6 lg:px-10 flex items-center justify-between gap-4">
          <p className="text-xs" style={{ color: 'var(--color-ink-faint)' }}>
            Dados via{' '}
            <a href="https://comunicaapi.pje.jus.br" target="_blank" rel="noopener noreferrer"
              className="transition-colors hover:underline"
              style={{ color: 'var(--color-ink-muted)' }}>
              API pública DJEN · CNJ
            </a>
          </p>
          <p className="text-xs hidden sm:block" style={{ color: 'var(--color-ink-faint)' }}>
            <a href="https://atos.cnj.jus.br/atos/detalhar/4509" target="_blank" rel="noopener noreferrer"
              className="hover:underline transition-colors"
              style={{ color: 'var(--color-ink-muted)' }}>
              Resolução CNJ nº 455/2022
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

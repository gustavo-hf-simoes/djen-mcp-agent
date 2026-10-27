import type { ReactNode } from 'react'
import { Sidebar, type NavPageId } from './Sidebar'
import type { UsuarioSessao } from '../api/djen'

interface LayoutProps {
  children: ReactNode
  usuario: UsuarioSessao
  activePage: NavPageId
  onSelectPage: (page: NavPageId) => void
  onSyncNow: () => void
  syncing: boolean
  onLogout: () => void
}

export function Layout({
  children,
  usuario,
  activePage,
  onSelectPage,
  onSyncNow,
  syncing,
  onLogout,
}: LayoutProps) {
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row" style={{ background: 'var(--color-surface)' }}>
      <Sidebar
        usuario={usuario}
        activePage={activePage}
        onSelectPage={onSelectPage}
        onSyncNow={onSyncNow}
        syncing={syncing}
        onLogout={onLogout}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 w-full max-w-350 mx-auto px-6 lg:px-10 py-7">
          {children}
        </main>
        <footer style={{ borderTop: '1px solid var(--color-edge-subtle)' }} className="py-4">
          <div className="max-w-350 mx-auto px-6 lg:px-10 flex items-center justify-between gap-4">
            <p className="text-xs" style={{ color: 'var(--color-ink-faint)' }}>
              Dados via{' '}
              <a
                href="https://comunicaapi.pje.jus.br"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:underline"
                style={{ color: 'var(--color-ink-muted)' }}
              >
                API pública DJEN · CNJ
              </a>
            </p>
            <p className="text-xs hidden sm:block" style={{ color: 'var(--color-ink-faint)' }}>
              {usuario.escritorio.nome} · OAB {usuario.oab.numero}/{usuario.oab.uf}
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}

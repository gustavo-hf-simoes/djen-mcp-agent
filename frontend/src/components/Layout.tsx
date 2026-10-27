import type { ReactNode } from 'react'
import { Header, type ActiveTab } from './Header'
import type { UsuarioSessao } from '../api/djen'

interface LayoutProps {
  children: ReactNode
  usuario: UsuarioSessao
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  onSyncNow: () => void
  syncing: boolean
  onLogout: () => void
}

export function Layout({
  children,
  usuario,
  activeTab,
  onTabChange,
  onSyncNow,
  syncing,
  onLogout,
}: LayoutProps) {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--color-surface)' }}>
      <Header
        usuario={usuario}
        activeTab={activeTab}
        onTabChange={onTabChange}
        onSyncNow={onSyncNow}
        syncing={syncing}
        onLogout={onLogout}
      />
      <main className="flex-1 w-full max-w-350 mx-auto px-6 lg:px-10 py-8">
        {children}
      </main>
      <footer style={{ borderTop: '1px solid var(--color-edge-subtle)' }} className="py-5">
        <div className="max-w-350 mx-auto px-6 lg:px-10 flex items-center justify-between gap-4">
          <p className="text-xs" style={{ color: 'var(--color-ink-faint)' }}>
            GHFS SaaS Jurídico Agêntico · Banco PostgreSQL Multi-Tenant Auditado (SHA-256)
          </p>
          <p className="text-xs hidden sm:block" style={{ color: 'var(--color-ink-faint)' }}>
            Proprietário Master: Gustavo Simões · OAB Piloto: {usuario.oab.numero}/{usuario.oab.uf}
          </p>
        </div>
      </footer>
    </div>
  )
}

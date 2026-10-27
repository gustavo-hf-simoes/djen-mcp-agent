import { Scales, SignOut, ArrowsClockwise, ShieldCheck, FolderSimple, Kanban, MagnifyingGlass } from '@phosphor-icons/react'
import type { UsuarioSessao } from '../api/djen'

export type ActiveTab = 'controladoria' | 'processos' | 'djen_live' | 'saas_admin'

interface HeaderProps {
  usuario: UsuarioSessao
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  onSyncNow: () => void
  syncing: boolean
  onLogout: () => void
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  MASTER:    { label: 'MASTER · PROPRIETÁRIO', color: '#e09f3e' },
  ADMIN_DEV: { label: 'ADMIN DEV',             color: '#60a5fa' },
  ADVOGADO:  { label: 'ADVOGADO',              color: '#4ade80' },
}

export function Header({
  usuario,
  activeTab,
  onTabChange,
  onSyncNow,
  syncing,
  onLogout,
}: HeaderProps) {
  const roleInfo = ROLE_BADGE[usuario.role] ?? { label: usuario.role, color: '#a1a1aa' }
  const isAdmin = usuario.role === 'MASTER' || usuario.role === 'ADMIN_DEV'

  const tabs: Array<{ id: ActiveTab; label: string; icon: typeof Kanban }> = [
    { id: 'controladoria', label: 'Controladoria & Prazos', icon: Kanban },
    { id: 'processos',     label: 'Pastas de Processos',    icon: FolderSimple },
    { id: 'djen_live',     label: 'Consulta Direta DJEN',   icon: MagnifyingGlass },
    ...(isAdmin ? [{ id: 'saas_admin' as ActiveTab, label: 'Gestão SaaS', icon: ShieldCheck }] : []),
  ]

  return (
    <header
      className="w-full sticky top-0 z-40"
      style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-edge)' }}
    >
      <div className="max-w-350 mx-auto px-6 lg:px-10">
        <div className="h-15 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-accent)' }}
            >
              <Scales size={16} weight="bold" style={{ color: 'var(--color-accent-on)' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-ink)' }}>
                  {usuario.escritorio.nome ?? 'GHFS SaaS Jurídico'}
                </span>
                <span
                  className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    color: roleInfo.color,
                    background: `${roleInfo.color}18`,
                    border: `1px solid ${roleInfo.color}40`,
                  }}
                >
                  {roleInfo.label}
                </span>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>
                {usuario.nome} ({usuario.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg"
              style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-edge-subtle)' }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="font-mono text-xs tracking-tight" style={{ color: 'var(--color-ink-muted)' }}>
                OAB {usuario.oab.numero}/{usuario.oab.uf}
              </span>
            </div>

            <button
              type="button"
              onClick={onSyncNow}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                background: 'rgba(224,159,62,0.14)',
                color: 'var(--color-accent)',
                border: '1px solid rgba(224,159,62,0.3)',
              }}
            >
              <ArrowsClockwise size={13} weight="bold" className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar DJEN'}
            </button>

            <button
              type="button"
              onClick={onLogout}
              title="Sair do SaaS"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                color: 'var(--color-ink-faint)',
                border: '1px solid var(--color-edge)',
              }}
            >
              <SignOut size={14} weight="bold" />
              <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* Barra de Navegação por Abas */}
        <nav className="flex items-center gap-1 overflow-x-auto pb-2 pt-1">
          {tabs.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                style={{
                  background: active ? 'var(--color-accent)' : 'transparent',
                  color: active ? 'var(--color-accent-on)' : 'var(--color-ink-muted)',
                }}
              >
                <Icon size={14} weight="bold" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

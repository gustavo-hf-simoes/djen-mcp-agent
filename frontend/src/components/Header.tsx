import {
  Scales,
  SignOut,
  ArrowsClockwise,
  ShieldCheck,
  FolderSimple,
  Kanban,
  MagnifyingGlass,
  WhatsappLogo,
} from '@phosphor-icons/react'
import type { UsuarioSessao } from '../api/djen'

export type ActiveModule = 'modulo_controladoria' | 'modulo_operacional' | 'modulo_saas_master'
export type ControladoriaSubTab = 'djen_live' | 'acompanhamento' | 'processos'

interface HeaderProps {
  usuario: UsuarioSessao
  activeModule: ActiveModule
  onModuleChange: (mod: ActiveModule) => void
  subTab: ControladoriaSubTab
  onSubTabChange: (tab: ControladoriaSubTab) => void
  onSyncNow: () => void
  syncing: boolean
  onLogout: () => void
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  MASTER:    { label: 'MASTER',    color: '#e09f3e' },
  ADMIN_DEV: { label: 'ADMIN DEV', color: '#60a5fa' },
  ADVOGADO:  { label: 'ADVOGADO',  color: '#4ade80' },
}

export function Header({
  usuario,
  activeModule,
  onModuleChange,
  subTab,
  onSubTabChange,
  onSyncNow,
  syncing,
  onLogout,
}: HeaderProps) {
  const roleInfo = ROLE_BADGE[usuario.role] ?? { label: usuario.role, color: '#a1a1aa' }
  // EXCLUSIVO para o proprietário MASTER (Gustavo)
  const isMaster = usuario.role === 'MASTER'

  const modules: Array<{ id: ActiveModule; label: string; icon: typeof Kanban }> = [
    { id: 'modulo_controladoria', label: 'Controladoria & DJEN', icon: Kanban },
    { id: 'modulo_operacional',   label: 'Operacional WhatsApp', icon: WhatsappLogo },
    ...(isMaster ? [{ id: 'modulo_saas_master' as ActiveModule, label: 'Governança SaaS', icon: ShieldCheck }] : []),
  ]

  const controladoriaTabs: Array<{ id: ControladoriaSubTab; label: string; icon: typeof Kanban }> = [
    { id: 'djen_live',       label: 'Publicações DJEN',        icon: MagnifyingGlass },
    { id: 'acompanhamento',  label: 'Prazos & Providências',   icon: Kanban },
    { id: 'processos',       label: 'Pastas de Processos CNJ', icon: FolderSimple },
  ]

  return (
    <header
      className="w-full sticky top-0 z-40"
      style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-edge)' }}
    >
      <div className="max-w-350 mx-auto px-6 lg:px-10">
        {/* Linha 1: Identidade + Seletor de Módulos do SaaS + Ações do Usuário */}
        <div className="h-15 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
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
                    {usuario.escritorio.nome ?? 'GHFS Jurídico'}
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
                  {usuario.nome}
                </p>
              </div>
            </div>

            {/* Menu Principal de Módulos */}
            <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl"
              style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-edge-subtle)' }}>
              {modules.map(m => {
                const Icon = m.icon
                const active = activeModule === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onModuleChange(m.id)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                    style={{
                      background: active ? 'var(--color-accent)' : 'transparent',
                      color: active ? 'var(--color-accent-on)' : 'var(--color-ink-muted)',
                    }}
                  >
                    <Icon size={14} weight="bold" />
                    {m.label}
                  </button>
                )
              })}
            </nav>
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
              title="Sair"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                color: 'var(--color-ink-faint)',
                border: '1px solid var(--color-edge)',
              }}
            >
              <SignOut size={14} weight="bold" />
              <span className="hidden lg:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* Menu Mobile de Módulos */}
        <div className="flex md:hidden items-center gap-1 pb-2 overflow-x-auto">
          {modules.map(m => {
            const Icon = m.icon
            const active = activeModule === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onModuleChange(m.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                style={{
                  background: active ? 'var(--color-accent)' : 'var(--color-surface-overlay)',
                  color: active ? 'var(--color-accent-on)' : 'var(--color-ink-muted)',
                }}
              >
                <Icon size={13} weight="bold" />
                {m.label}
              </button>
            )
          })}
        </div>

        {/* Linha 2: Sub-navegação quando dentro do Módulo Controladoria */}
        {activeModule === 'modulo_controladoria' && (
          <div
            className="flex items-center gap-1 overflow-x-auto py-2"
            style={{ borderTop: '1px solid var(--color-edge-subtle)' }}
          >
            {controladoriaTabs.map(t => {
              const Icon = t.icon
              const active = subTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSubTabChange(t.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
                  style={{
                    background: active ? 'rgba(224,159,62,0.14)' : 'transparent',
                    color: active ? 'var(--color-accent)' : 'var(--color-ink-faint)',
                    border: active ? '1px solid rgba(224,159,62,0.28)' : '1px solid transparent',
                  }}
                >
                  <Icon size={13} weight="bold" />
                  {t.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </header>
  )
}

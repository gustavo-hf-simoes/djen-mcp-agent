import { useState, useMemo } from 'react'
import {
  Scales,
  SignOut,
  ArrowsClockwise,
  ShieldCheck,
  FolderSimple,
  Kanban,
  MagnifyingGlass,
  WhatsappLogo,
  BookOpen,
  ChartBar,
  CurrencyDollar,
  X,
} from '@phosphor-icons/react'
import type { UsuarioSessao } from '../api/djen'

export type NavPageId =
  | 'djen_publicacoes'
  | 'controladoria_prazos'
  | 'processos_pastas'
  | 'operacional_whatsapp'
  | 'inteligencia_jurisprudencia'
  | 'base_conhecimento'
  | 'financeiro_honorarios'
  | 'governanca_master'

interface NavItem {
  id: NavPageId
  label: string
  keywords: string
  icon: typeof Kanban
  badge?: string
  masterOnly?: boolean
}

interface NavGroup {
  groupTitle: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: 'Controladoria & DJEN',
    items: [
      {
        id: 'djen_publicacoes',
        label: 'Publicações DJEN',
        keywords: 'publicacoes djen diario intimacoes citacoes busca oficial',
        icon: MagnifyingGlass,
      },
      {
        id: 'processos_pastas',
        label: 'Pastas de Processos',
        keywords: 'pastas processos cnj clientes certidoes baixar pdf zip',
        icon: FolderSimple,
      },
      {
        id: 'controladoria_prazos',
        label: 'Prazos & Providências',
        keywords: 'prazos providencias controladoria kanban tarefas ia',
        icon: Kanban,
      },
    ],
  },
  {
    groupTitle: 'Atendimento & Operacional',
    items: [
      {
        id: 'operacional_whatsapp',
        label: 'Triagem WhatsApp',
        keywords: 'whatsapp operacional audios transcricao documentos checklist zapsign procuracao',
        icon: WhatsappLogo,
      },
    ],
  },
  {
    groupTitle: 'Inteligência & Escritório',
    items: [
      {
        id: 'inteligencia_jurisprudencia',
        label: 'Mapa de Jurisprudência',
        keywords: 'mapa calor jurisprudencia teses tribunais juizes',
        icon: ChartBar,
        badge: 'Em breve',
      },
      {
        id: 'base_conhecimento',
        label: 'Base de Conhecimento',
        keywords: 'base conhecimento modelos peticoes prompts ia',
        icon: BookOpen,
        badge: 'Em breve',
      },
      {
        id: 'financeiro_honorarios',
        label: 'Financeiro & Contratos',
        keywords: 'financeiro honorarios pagamentos parcelas contratos',
        icon: CurrencyDollar,
        badge: 'Em breve',
      },
    ],
  },
  {
    groupTitle: 'Administração da Plataforma',
    items: [
      {
        id: 'governanca_master',
        label: 'Governança SaaS',
        keywords: 'governanca saas master tenants escritorios usuarios seguranca',
        icon: ShieldCheck,
        masterOnly: true,
      },
    ],
  },
]

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  MASTER:    { label: 'MASTER',    color: '#e09f3e' },
  ADMIN_DEV: { label: 'ADMIN DEV', color: '#60a5fa' },
  ADVOGADO:  { label: 'ADVOGADO',  color: '#4ade80' },
}

interface SidebarProps {
  usuario: UsuarioSessao
  activePage: NavPageId
  onSelectPage: (page: NavPageId) => void
  onSyncNow: () => void
  syncing: boolean
  onLogout: () => void
}

export function Sidebar({
  usuario,
  activePage,
  onSelectPage,
  onSyncNow,
  syncing,
  onLogout,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const isMaster = usuario.role === 'MASTER'
  const roleInfo = ROLE_BADGE[usuario.role] ?? { label: usuario.role, color: '#a1a1aa' }

  const filteredGroups = useMemo(() => {
    const q = searchQuery
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

    return NAV_GROUPS.map(group => {
      const visibleItems = group.items.filter(item => {
        if (item.masterOnly && !isMaster) return false
        if (!q) return true
        const target = `${group.groupTitle} ${item.label} ${item.keywords}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
        return target.includes(q)
      })
      return { ...group, items: visibleItems }
    }).filter(group => group.items.length > 0)
  }, [searchQuery, isMaster])

  return (
    <aside
      className="w-full lg:w-64 lg:min-h-dvh lg:sticky lg:top-0 shrink-0 flex flex-col justify-between"
      style={{
        background: 'var(--color-surface-raised)',
        borderRight: '1px solid var(--color-edge)',
      }}
    >
      <div className="p-4 space-y-4">
        {/* Identidade da Plataforma */}
        <div className="flex items-center justify-between gap-2 pb-3"
          style={{ borderBottom: '1px solid var(--color-edge-subtle)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-accent)' }}
            >
              <Scales size={16} weight="bold" style={{ color: 'var(--color-accent-on)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--color-ink)' }}>
                GHFS Jurídico
              </p>
              <p className="font-mono text-[11px] truncate" style={{ color: 'var(--color-ink-faint)' }}>
                OAB {usuario.oab.numero}/{usuario.oab.uf}
              </p>
            </div>
          </div>
          <span
            className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{
              color: roleInfo.color,
              background: `${roleInfo.color}18`,
              border: `1px solid ${roleInfo.color}40`,
            }}
          >
            {roleInfo.label}
          </span>
        </div>

        {/* Busca Rápida de Módulos e Páginas */}
        <div className="relative">
          <MagnifyingGlass
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-ink-faint)' }}
          />
          <input
            type="text"
            placeholder="Buscar no menu (ex: prazos)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-8 pr-7 rounded-lg text-xs outline-none transition-all placeholder:opacity-45"
            style={{
              background: 'var(--color-surface-input)',
              border: '1px solid var(--color-edge)',
              color: 'var(--color-ink)',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-ink-faint)' }}
            >
              <X size={12} weight="bold" />
            </button>
          )}
        </div>

        {/* Botão de Sincronização Rápida */}
        <button
          type="button"
          onClick={onSyncNow}
          disabled={syncing}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background: 'rgba(224,159,62,0.14)',
            color: 'var(--color-accent)',
            border: '1px solid rgba(224,159,62,0.3)',
          }}
        >
          <ArrowsClockwise size={13} weight="bold" className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando DJEN...' : 'Sincronizar DJEN Agora'}
        </button>

        {/* Grupos do Menu Lateral */}
        <nav className="space-y-4 pt-1" aria-label="Menu Principal">
          {filteredGroups.length === 0 ? (
            <p className="text-xs px-2 py-3 text-center" style={{ color: 'var(--color-ink-faint)' }}>
              Nenhum módulo encontrado para "{searchQuery}"
            </p>
          ) : (
            filteredGroups.map(group => (
              <div key={group.groupTitle} className="space-y-1">
                <p
                  className="px-2.5 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--color-ink-faint)' }}
                >
                  {group.groupTitle}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon
                    const active = activePage === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectPage(item.id)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left"
                        style={{
                          background: active ? 'var(--color-accent)' : 'transparent',
                          color: active ? 'var(--color-accent-on)' : 'var(--color-ink-muted)',
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Icon size={15} weight={active ? 'bold' : 'regular'} className="shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.badge && (
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              background: active ? 'rgba(0,0,0,0.2)' : 'var(--color-surface-overlay)',
                              color: active ? 'var(--color-accent-on)' : 'var(--color-ink-faint)',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </nav>
      </div>

      {/* Rodapé da Sidebar: Usuário Logado + Logout */}
      <div
        className="p-4 flex items-center justify-between gap-2"
        style={{
          borderTop: '1px solid var(--color-edge-subtle)',
          background: 'var(--color-surface-overlay)',
        }}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-ink)' }}>
            {usuario.nome}
          </p>
          <p className="text-[11px] truncate" style={{ color: 'var(--color-ink-faint)' }}>
            {usuario.email}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Sair da conta"
          className="p-2 rounded-lg transition-colors shrink-0"
          style={{
            color: 'var(--color-ink-faint)',
            border: '1px solid var(--color-edge)',
          }}
        >
          <SignOut size={15} weight="bold" />
        </button>
      </div>
    </aside>
  )
}

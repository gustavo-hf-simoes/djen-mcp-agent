import { useState, useMemo, useRef } from 'react'
import {
  SignOut,
  ArrowsClockwise,
  Buildings,
  ShieldCheck,
  FolderSimple,
  Kanban,
  MagnifyingGlass,
  WhatsappLogo,
  BookOpen,
  ChartBar,
  CurrencyDollar,
  PencilSimple,
  UploadSimple,
  Check,
  X,
} from '@phosphor-icons/react'
import { atualizarIdentidadeEscritorio, trocarEscritorioAtivo, type UsuarioSessao } from '../api/djen'

export const DEFAULT_ASO_LOGO_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">
      <rect width="240" height="160" rx="20" fill="#211E4A"/>
      <rect x="22" y="22" width="120" height="84" fill="#FFFFFF"/>
      <rect x="142" y="22" width="76" height="84" fill="#FF1E1E"/>
      <text x="82" y="86" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="500" fill="#211E4A" letter-spacing="2">AS</text>
      <text x="180" y="86" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="500" fill="#211E4A">O</text>
      <text x="120" y="136" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18.5" font-weight="600" fill="#FFFFFF" letter-spacing="7.5">ADVOGADOS</text>
    </svg>`
  )

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
  onUpdateUsuario?: (usuario: UsuarioSessao) => void
}

export function Sidebar({
  usuario,
  activePage,
  onSelectPage,
  onSyncNow,
  syncing,
  onLogout,
  onUpdateUsuario,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingBrand, setEditingBrand] = useState(false)
  const [officeName, setOfficeName] = useState(usuario.escritorio.nome || 'Meu Escritório')
  const [officeLogo, setOfficeLogo] = useState<string>(usuario.escritorio.logoUrl || DEFAULT_ASO_LOGO_DATA_URL)
  const [savingBrand, setSavingBrand] = useState(false)
  const [switchingTenant, setSwitchingTenant] = useState(false)

  async function handleTrocarTenant(targetId: string) {
    if (!targetId || targetId === usuario.escritorio.id) return
    setSwitchingTenant(true)
    try {
      const res = await trocarEscritorioAtivo(targetId)
      if (onUpdateUsuario) {
        onUpdateUsuario(res.usuario)
      }
    } catch (err) {
      console.error('Erro ao alternar tenant:', err)
    } finally {
      setSwitchingTenant(false)
    }
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isMaster = usuario.role === 'MASTER'
  const roleInfo = ROLE_BADGE[usuario.role] ?? { label: usuario.role, color: '#a1a1aa' }

  const displayOfficeName = usuario.escritorio.nome || 'Meu Escritório'
  const displayOfficeLogo = usuario.escritorio.logoUrl || DEFAULT_ASO_LOGO_DATA_URL

  function handleOpenEditBrand() {
    setOfficeName(displayOfficeName)
    setOfficeLogo(displayOfficeLogo)
    setEditingBrand(true)
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOfficeLogo(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleSaveBrand(e: React.FormEvent) {
    e.preventDefault()
    setSavingBrand(true)
    try {
      const res = await atualizarIdentidadeEscritorio({
        nome: officeName.trim() || usuario.escritorio.nome || 'Meu Escritório',
        logoUrl: officeLogo || DEFAULT_ASO_LOGO_DATA_URL,
      })
      if (onUpdateUsuario) {
        onUpdateUsuario({
          ...usuario,
          escritorio: {
            ...usuario.escritorio,
            nome: res.escritorio.nome,
            logoUrl: res.escritorio.logoUrl,
          },
        })
      }
      setEditingBrand(false)
    } catch (err) {
      console.error('Erro ao salvar identidade do escritório:', err)
    } finally {
      setSavingBrand(false)
    }
  }

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
        {/* Identidade do Escritório (White-Label Multi-Tenant) */}
        <div
          className="flex items-center justify-between gap-2 pb-3"
          style={{ borderBottom: '1px solid var(--color-edge-subtle)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleOpenEditBrand}
              title="Alterar Logo e Nome do Escritório"
              className="w-11 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center transition-transform hover:scale-105"
              style={{
                background: '#211E4A',
                border: '1px solid var(--color-edge)',
              }}
            >
              <img
                src={displayOfficeLogo}
                alt={displayOfficeName}
                className="w-full h-full object-contain"
              />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--color-ink)' }}>
                  {displayOfficeName}
                </p>
                <button
                  type="button"
                  onClick={handleOpenEditBrand}
                  title="Personalizar Nome e Logo do Escritório"
                  className="p-1 rounded hover:opacity-80 shrink-0"
                  style={{ color: 'var(--color-ink-faint)' }}
                >
                  <PencilSimple size={12} weight="bold" />
                </button>
              </div>
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

        {/* Seletor Rápido de Tenant (Multi-Tenant Switcher para MASTER / ADMIN) */}
        {usuario.escritoriosDisponiveis && usuario.escritoriosDisponiveis.length > 1 && (
          <div
            className="p-2.5 rounded-xl flex items-center justify-between gap-2.5"
            style={{
              background: 'var(--color-surface-overlay)',
              border: '1px solid rgba(224,159,62,0.3)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(224,159,62,0.15)', color: 'var(--color-accent)' }}
              >
                <Buildings size={16} weight="bold" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-faint)' }}>
                  Ambiente / Tenant
                </p>
                <select
                  value={usuario.escritorio.id ?? ''}
                  onChange={e => void handleTrocarTenant(e.target.value)}
                  disabled={switchingTenant}
                  className="w-full text-xs font-bold bg-transparent border-0 outline-none cursor-pointer truncate"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {usuario.escritoriosDisponiveis.map(esc => (
                    <option
                      key={esc.id}
                      value={esc.id}
                      style={{ background: '#1c1b22', color: '#f4f4f5' }}
                    >
                      {esc.nome} ({esc.plano})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {switchingTenant && (
              <span className="text-[10px] animate-pulse shrink-0 font-medium" style={{ color: 'var(--color-accent)' }}>
                Trocando...
              </span>
            )}
          </div>
        )}

        {/* Painel Rápido de Personalização da Marca do Escritório */}
        {editingBrand && (
          <form
            onSubmit={e => void handleSaveBrand(e)}
            className="p-3 rounded-xl space-y-3"
            style={{
              background: 'var(--color-surface-overlay)',
              border: '1px solid rgba(224,159,62,0.35)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold" style={{ color: 'var(--color-accent)' }}>
                Identidade do Escritório
              </span>
              <button
                type="button"
                onClick={() => setEditingBrand(false)}
                style={{ color: 'var(--color-ink-faint)' }}
              >
                <X size={13} weight="bold" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="w-16 h-11 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                style={{ background: '#211E4A', border: '1px solid var(--color-edge)' }}
              >
                <img src={officeLogo} alt="Preview Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5"
                  style={{
                    background: 'var(--color-surface-raised)',
                    color: 'var(--color-ink)',
                    border: '1px solid var(--color-edge)',
                  }}
                >
                  <UploadSimple size={12} weight="bold" />
                  Enviar Logo (PNG/SVG)
                </button>
                <button
                  type="button"
                  onClick={() => setOfficeLogo(DEFAULT_ASO_LOGO_DATA_URL)}
                  className="text-[10px] underline text-left"
                  style={{ color: 'var(--color-ink-muted)' }}
                >
                  Restaurar Logo Padrão
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-ink-muted)' }}>
                Nome de Exibição do Escritório
              </label>
              <input
                type="text"
                value={officeName}
                onChange={e => setOfficeName(e.target.value)}
                placeholder="Ex: Nome do Escritório"
                className="w-full h-8 px-2.5 rounded-lg text-xs outline-none"
                style={{
                  background: 'var(--color-surface-input)',
                  border: '1px solid var(--color-edge)',
                  color: 'var(--color-ink)',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={savingBrand}
              className="w-full h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-accent-on)',
              }}
            >
              <Check size={12} weight="bold" />
              {savingBrand ? 'Salvando...' : 'Salvar Identidade'}
            </button>
          </form>
        )}

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

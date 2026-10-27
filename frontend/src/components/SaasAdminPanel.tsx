import { useEffect, useState } from 'react'
import { ShieldCheck, Buildings, Users } from '@phosphor-icons/react'
import { buscarAdminOverview, type SaasAdminOverview, type UsuarioSessao } from '../api/djen'
import { LoadingState } from './LoadingState'

export function SaasAdminPanel({ usuarioLogado }: { usuarioLogado: UsuarioSessao }) {
  const [dados, setDados] = useState<SaasAdminOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buscarAdminOverview()
      .then(setDados)
      .catch(err => console.error('Erro ao carregar visão Master:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div
        className="p-5 rounded-2xl flex items-center justify-between gap-4 flex-wrap"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(224,159,62,0.14)', color: 'var(--color-accent)' }}
          >
            <ShieldCheck size={22} weight="bold" />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>
              Governança SaaS Multi-Tenant & Controle de Acessos (RBAC)
            </h2>
            <p className="text-xs" style={{ color: 'var(--color-ink-faint)' }}>
              Você está autenticado como <strong style={{ color: 'var(--color-ink)' }}>{usuarioLogado.role}</strong>. O usuário MASTER possui proteção em nível de trigger no PostgreSQL.
            </p>
          </div>
        </div>
      </div>

      {/* Escritórios (Tenants) */}
      <div
        className="p-5 rounded-2xl space-y-4"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
      >
        <div className="flex items-center gap-2">
          <Buildings size={16} weight="bold" style={{ color: 'var(--color-accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
            Escritórios (Tenants Cadastrados)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dados?.escritorios.map(esc => (
            <div
              key={esc.id}
              className="p-4 rounded-xl space-y-2"
              style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-edge-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>
                  {esc.nome}
                </span>
                <span
                  className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}
                >
                  PLANO {esc.plano}
                </span>
              </div>
              <p className="font-mono text-xs" style={{ color: 'var(--color-ink-faint)' }}>
                Tenant Slug: {esc.slug} · ID: {esc.id}
              </p>
              <div className="flex items-center gap-4 pt-1 text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                <span><strong>{esc.totalProcessos}</strong> processos isolados</span>
                <span><strong>{esc.totalUsuarios}</strong> usuários vinculados</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de Usuários */}
      <div
        className="p-5 rounded-2xl space-y-4"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
      >
        <div className="flex items-center gap-2">
          <Users size={16} weight="bold" style={{ color: 'var(--color-accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
            Usuários e Hierarquia de Permissões
          </h3>
        </div>

        <div className="space-y-2.5">
          {dados?.usuarios.map(u => (
            <div
              key={u.id}
              className="p-4 rounded-xl flex items-center justify-between gap-4 flex-wrap"
              style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-edge-subtle)' }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    {u.nome}
                  </span>
                  <span
                    className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      color: u.role === 'MASTER' ? '#e09f3e' : u.role === 'ADMIN_DEV' ? '#60a5fa' : '#4ade80',
                      background: 'var(--color-surface-raised)',
                      border: '1px solid var(--color-edge)',
                    }}
                  >
                    {u.role}
                  </span>
                </div>
                <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--color-ink-faint)' }}>
                  {u.email} · OAB {u.oab.numero}/{u.oab.uf}
                </p>
              </div>
              <div className="text-right text-xs" style={{ color: 'var(--color-ink-faint)' }}>
                <p>{u.escritorio.nome}</p>
                <p className="font-mono text-[11px]">
                  Último login: {u.ultimoLoginEm ? new Date(u.ultimoLoginEm).toLocaleString('pt-BR') : 'Nunca'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

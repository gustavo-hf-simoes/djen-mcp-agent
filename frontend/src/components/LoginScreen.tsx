import { useState } from 'react'
import { motion } from 'framer-motion'
import { Scales, LockKey, EnvelopeSimple, ShieldCheck, UserCircle, Code } from '@phosphor-icons/react'
import { loginSaas, DjenError, type UsuarioSessao } from '../api/djen'

interface LoginScreenProps {
  onSuccess: (usuario: UsuarioSessao) => void
}

const CONTAS_RAPIDAS = [
  {
    titulo: 'Gustavo (Master)',
    subtitulo: 'Proprietário do SaaS',
    email: 'gustavo@ghfs.adv.br',
    senha: 'Master@2026',
    badge: 'MASTER',
    icon: ShieldCheck,
    cor: '#e09f3e',
  },
  {
    titulo: 'André Oliveira',
    subtitulo: 'OAB 69.161/PR · Piloto',
    email: 'andre@oliveira.adv.br',
    senha: 'Andre@2026',
    badge: 'ADVOGADO',
    icon: UserCircle,
    cor: '#4ade80',
  },
  {
    titulo: 'Alessandro',
    subtitulo: 'Desenvolvedor Front-end',
    email: 'alessandro@ghfs.adv.br',
    senha: 'Alessandro@2026',
    badge: 'ADMIN_DEV',
    icon: Code,
    cor: '#60a5fa',
  },
]

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('gustavo@ghfs.adv.br')
  const [senha, setSenha] = useState('Master@2026')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function autenticar(emailLogin: string, senhaLogin: string) {
    setLoading(true)
    setErro('')
    try {
      const { usuario } = await loginSaas(emailLogin, senhaLogin)
      onSuccess(usuario)
    } catch (err) {
      if (err instanceof DjenError) {
        setErro(err.message)
      } else {
        setErro('Não foi possível conectar ao servidor SaaS (porta 3000).')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void autenticar(email, senha)
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center p-6"
      style={{ background: 'var(--color-surface)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-edge)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="px-6 pt-6 pb-5 flex items-center gap-3.5"
          style={{ borderBottom: '1px solid var(--color-edge-subtle)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-accent)' }}
          >
            <Scales size={20} weight="bold" style={{ color: 'var(--color-accent-on)' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>
                GHFS Jurídico Agêntico
              </h1>
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(224,159,62,0.14)',
                  color: 'var(--color-accent)',
                  border: '1px solid rgba(224,159,62,0.3)',
                }}
              >
                SaaS v1.0
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>
              Controladoria Autônoma · DJEN · Multi-Tenant
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erro && (
            <div
              className="p-3 rounded-xl text-xs font-medium"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171',
              }}
            >
              {erro}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-ink-faint)' }}
            >
              E-mail Corporativo
            </label>
            <div className="relative">
              <EnvelopeSimple
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-ink-faint)' }}
              />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--color-surface-input)',
                  border: '1px solid var(--color-edge)',
                  color: 'var(--color-ink)',
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-ink-faint)' }}
            >
              Senha de Acesso
            </label>
            <div className="relative">
              <LockKey
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-ink-faint)' }}
              />
              <input
                type="password"
                required
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--color-surface-input)',
                  border: '1px solid var(--color-edge)',
                  color: 'var(--color-ink)',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-on)',
              boxShadow: '0 2px 14px rgba(224,159,62,0.25)',
            }}
          >
            {loading ? 'Autenticando...' : 'Entrar no SaaS'}
          </button>
        </form>

        <div
          className="px-6 py-4 space-y-2.5"
          style={{
            borderTop: '1px solid var(--color-edge-subtle)',
            background: 'var(--color-surface-overlay)',
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-ink-faint)' }}
          >
            Acesso Rápido (Ambiente Local de Homologação)
          </p>
          <div className="grid grid-cols-1 gap-2">
            {CONTAS_RAPIDAS.map(conta => {
              const Icon = conta.icon
              return (
                <button
                  key={conta.email}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setEmail(conta.email)
                    setSenha(conta.senha)
                    void autenticar(conta.email, conta.senha)
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all"
                  style={{
                    background: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-edge)',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={16} weight="bold" style={{ color: conta.cor }} />
                    <div className="truncate">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-ink)' }}>
                        {conta.titulo}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--color-ink-faint)' }}>
                        {conta.subtitulo}
                      </p>
                    </div>
                  </div>
                  <span
                    className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      color: conta.cor,
                      background: `${conta.cor}1a`,
                      border: `1px solid ${conta.cor}40`,
                    }}
                  >
                    {conta.badge}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

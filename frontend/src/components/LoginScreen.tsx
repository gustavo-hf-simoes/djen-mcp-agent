import { useState } from 'react'
import { motion } from 'framer-motion'
import { LockKey, EnvelopeSimple, Scales } from '@phosphor-icons/react'
import { loginSaas, DjenError, type UsuarioSessao } from '../api/djen'

interface LoginScreenProps {
  onSuccess: (usuario: UsuarioSessao) => void
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    try {
      const { usuario } = await loginSaas(email, senha)
      onSuccess(usuario)
    } catch (err) {
      if (err instanceof DjenError) {
        setErro(err.message)
      } else {
        setErro('Não foi possível conectar ao servidor SaaS.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 relative"
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
            className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(224, 159, 62, 0.12)',
              border: '1px solid rgba(224, 159, 62, 0.30)',
            }}
          >
            <Scales size={24} weight="fill" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>
              GHFS Jurídico
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>
              Plataforma de Inteligência & Controladoria SaaS · Acesse sua conta
            </p>
          </div>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="p-6 space-y-4">
          {erro && (
            <div
              className="p-3 rounded-xl text-xs font-medium"
              style={{
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.25)',
                color: '#f87171',
              }}
            >
              {erro}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--color-ink-muted)' }}>
              E-mail do Advogado
            </label>
            <div className="relative">
              <EnvelopeSimple
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-ink-faint)' }}
              />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="advogado@escritorio.adv.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none"
                style={{
                  background: 'var(--color-surface-overlay)',
                  border: '1px solid var(--color-edge)',
                  color: 'var(--color-ink)',
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--color-ink-muted)' }}>
              Senha de Acesso
            </label>
            <div className="relative">
              <LockKey
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-ink-faint)' }}
              />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none"
                style={{
                  background: 'var(--color-surface-overlay)',
                  border: '1px solid var(--color-edge)',
                  color: 'var(--color-ink)',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-on)',
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Autenticando...
              </span>
            ) : (
              'Entrar no Sistema'
            )}
          </button>

          <p className="text-[11px] text-center pt-2" style={{ color: 'var(--color-ink-faint)' }}>
            Ambiente seguro · Criptografia AES-256-GCM & Zero-Trust
          </p>
        </form>
      </motion.div>
    </div>
  )
}

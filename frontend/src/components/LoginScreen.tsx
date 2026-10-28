import { useState } from 'react'
import { motion } from 'framer-motion'
import { LockKey, EnvelopeSimple } from '@phosphor-icons/react'
import { loginSaas, DjenError, type UsuarioSessao } from '../api/djen'
import { DEFAULT_ASO_LOGO_DATA_URL } from './Sidebar'

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
            className="w-14 h-11 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
            style={{ background: '#211E4A', border: '1px solid var(--color-edge)' }}
          >
            <img src={DEFAULT_ASO_LOGO_DATA_URL} alt="ASO Advogados" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>
              ASO Advogados
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>
              Controladoria & Triagem Inteligente · Acesse sua conta
            </p>
          </div>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="p-6 space-y-4">
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
              E-mail
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
                placeholder="seu@email.com.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg text-sm outline-none transition-all placeholder:opacity-40"
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
              Senha
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
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg text-sm outline-none transition-all placeholder:opacity-40"
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
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

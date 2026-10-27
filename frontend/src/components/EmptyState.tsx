import { motion } from 'framer-motion'
import { FolderOpen, FunnelX } from '@phosphor-icons/react'

type EmptyStateVariant = 'idle' | 'no-results'

export function EmptyState({ variant }: { variant: EmptyStateVariant }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-start py-16 px-2"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
        style={{ background: 'var(--color-surface-overlay)' }}>
        {variant === 'idle'
          ? <FolderOpen size={20} weight="duotone" style={{ color: 'var(--color-ink-faint)' }} />
          : <FunnelX size={20} weight="duotone" style={{ color: 'var(--color-ink-faint)' }} />
        }
      </div>

      <h3 className="text-sm font-semibold tracking-tight mb-1.5" style={{ color: 'var(--color-ink)' }}>
        {variant === 'idle'
          ? 'Nenhuma comunicação carregada'
          : 'Nenhum resultado para esses filtros'
        }
      </h3>

      <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--color-ink-muted)' }}>
        {variant === 'idle'
          ? 'Aguardando o carregamento das comunicações para OAB 69.161/PR.'
          : 'Tente remover algum filtro ou ampliar o período de busca.'
        }
      </p>
    </motion.div>
  )
}

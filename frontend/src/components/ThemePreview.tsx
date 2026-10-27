/**
 * COMPONENTE TEMPORÁRIO — remover após escolha do tema
 * Exibe 3 mini-mockups do design em cada paleta proposta.
 */

const THEMES = [
  {
    id: 'classico',
    name: 'Clássico',
    subtitle: 'Marinho + Ouro',
    desc: 'Linguagem das grandes bancas e da OAB. Peso e tradição.',
    bg: '#0b1425',
    bgCard: '#111d30',
    bgCardHover: '#152238',
    border: '#1e3050',
    borderAccent: '#c9a227',
    accent: '#c9a227',
    accentText: '#0b1425',
    muted: '#4a6080',
    text: '#e8edf5',
    textMuted: '#7a94b0',
    barColor: '#c9a227',
    badgeBg: 'rgba(201,162,39,0.15)',
    badgeText: '#c9a227',
    badgeBorder: 'rgba(201,162,39,0.3)',
    tribunalBg: 'rgba(255,255,255,0.06)',
    tribunalText: '#7a94b0',
    footerBorder: '#1e3050',
  },
  {
    id: 'moderno',
    name: 'Moderno',
    subtitle: 'Slate + Índigo',
    desc: 'Legal tech contemporâneo. Confiança sem ser conservador.',
    bg: '#0f1117',
    bgCard: '#161b27',
    bgCardHover: '#1c2235',
    border: '#232b3e',
    borderAccent: '#5b6cf9',
    accent: '#5b6cf9',
    accentText: '#ffffff',
    muted: '#3d4a63',
    text: '#e2e8f0',
    textMuted: '#64748b',
    barColor: '#f59e0b',
    badgeBg: 'rgba(245,158,11,0.12)',
    badgeText: '#f59e0b',
    badgeBorder: 'rgba(245,158,11,0.25)',
    tribunalBg: 'rgba(255,255,255,0.05)',
    tribunalText: '#64748b',
    footerBorder: '#1e2535',
  },
  {
    id: 'chumbo',
    name: 'Chumbo',
    subtitle: 'Grafite + Âmbar',
    desc: 'Meio-termo: sóbrio e direto. Fácil de ler por horas.',
    bg: '#161618',
    bgCard: '#1e1e21',
    bgCardHover: '#252528',
    border: '#2e2e32',
    borderAccent: '#e09f3e',
    accent: '#e09f3e',
    accentText: '#161618',
    muted: '#3a3a3f',
    text: '#e4e4e7',
    textMuted: '#71717a',
    barColor: '#e09f3e',
    badgeBg: 'rgba(224,159,62,0.12)',
    badgeText: '#e09f3e',
    badgeBorder: 'rgba(224,159,62,0.25)',
    tribunalBg: 'rgba(255,255,255,0.05)',
    tribunalText: '#71717a',
    footerBorder: '#2e2e32',
  },
]

interface MiniCardProps {
  t: typeof THEMES[0]
}

function MiniMockup({ t }: MiniCardProps) {
  return (
    <div
      style={{ background: t.bg, border: `1px solid ${t.border}` }}
      className="rounded-2xl overflow-hidden flex-1 min-w-0"
    >
      {/* Mini header */}
      <div style={{ borderBottom: `1px solid ${t.border}`, background: t.bg }}
        className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div style={{ background: t.accent }} className="w-5 h-5 rounded-md flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L4 7v5c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V7l-8-4z"
                fill={t.accentText} fillOpacity="0.9" />
            </svg>
          </div>
          <span style={{ color: t.text }} className="text-xs font-semibold">Consultas DJEN</span>
        </div>
        <span style={{ color: t.textMuted }} className="font-mono text-[10px]">OAB 69.161/PR</span>
      </div>

      {/* Corpo — sidebar + cards */}
      <div className="flex gap-3 p-4">

        {/* Mini sidebar */}
        <div className="w-16 shrink-0 space-y-2">
          <div style={{ color: t.textMuted }} className="text-[8px] uppercase tracking-widest font-semibold mb-2">
            Filtros
          </div>
          {['TJSP', 'TJPR', 'TRF2'].map(t2 => (
            <div key={t2} style={{ background: t.tribunalBg, color: t.tribunalText, border: `1px solid ${t.border}` }}
              className="text-[9px] font-medium px-1.5 py-0.5 rounded text-center">
              {t2}
            </div>
          ))}
          <div style={{ background: t.accent, color: t.accentText }}
            className="text-[9px] font-bold px-1.5 py-1 rounded-md text-center mt-3">
            Aplicar
          </div>
        </div>

        {/* Mini lista de comunicações */}
        <div className="flex-1 space-y-2 min-w-0">
          {[
            { tipo: 'Intimação', proc: '0826341-92.2026.8.16.0014', orgao: '3º Juizado · TJPR' },
            { tipo: 'Intimação', proc: '4002848-32.2026.8.26.0081', orgao: 'Vara Cível · TJSP' },
            { tipo: 'Lista de distribuição', proc: '0866230-68.2017.8.16.0014', orgao: '9ª Vara · TJPR' },
          ].map((item, i) => (
            <div key={i}
              style={{ background: t.bgCard, border: `1px solid ${t.border}` }}
              className="rounded-lg overflow-hidden"
            >
              <div className="flex">
                {/* Barra colorida à esquerda */}
                <div style={{ background: t.barColor, width: 3, flexShrink: 0 }} />
                <div className="px-2.5 py-2 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span style={{ background: t.badgeBg, color: t.badgeText, border: `1px solid ${t.badgeBorder}` }}
                      className="text-[8px] font-semibold px-1.5 py-px rounded">
                      {item.tipo === 'Lista de distribuição' ? 'Lista' : item.tipo}
                    </span>
                    <span style={{ color: t.textMuted, background: t.tribunalBg, border: `1px solid ${t.border}` }}
                      className="text-[8px] font-mono px-1 py-px rounded">
                      {item.orgao.split(' · ')[1]}
                    </span>
                  </div>
                  <p style={{ color: t.text }} className="font-mono text-[9px] font-semibold truncate">
                    {item.proc}
                  </p>
                  <p style={{ color: t.textMuted }} className="text-[8px] truncate mt-0.5">
                    {item.orgao}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mini footer */}
      <div style={{ borderTop: `1px solid ${t.footerBorder}` }}
        className="px-4 py-2 flex items-center justify-between">
        <span style={{ color: t.textMuted }} className="text-[9px]">API DJEN · CNJ</span>
        <span style={{ color: t.textMuted }} className="text-[9px]">Resolução 455/2022</span>
      </div>
    </div>
  )
}

interface ThemePreviewProps {
  onChoose: (themeId: string) => void
}

export function ThemePreview({ onChoose }: ThemePreviewProps) {
  return (
    <div className="mb-10">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-zinc-800 tracking-tight">
          Escolha o tema dark
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Pré-visualização em escala reduzida — clique em "Usar este" para aplicar.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {THEMES.map(theme => (
          <div key={theme.id} className="flex-1 min-w-0 space-y-3">
            {/* Card de preview */}
            <MiniMockup t={theme} />

            {/* Info + botão */}
            <div className="flex items-start justify-between gap-3 px-1">
              <div>
                <p className="text-sm font-semibold text-zinc-800 tracking-tight">{theme.name}</p>
                <p className="text-xs text-zinc-500">{theme.subtitle}</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{theme.desc}</p>
              </div>
              <button
                onClick={() => onChoose(theme.id)}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200
                  text-zinc-700 hover:bg-zinc-900 hover:text-white hover:border-zinc-900
                  transition-all duration-150 active:scale-[0.97] whitespace-nowrap"
              >
                Usar este
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Divisor */}
      <div className="mt-8 flex items-center gap-4">
        <div className="flex-1 h-px bg-zinc-200" />
        <span className="text-xs text-zinc-400">Resultados reais abaixo</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>
    </div>
  )
}

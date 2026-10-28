import { useEffect, useState, useCallback } from 'react'
import {
  WhatsappLogo,
  Microphone,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  Clock,
  Copy,
  Check,
  GearSix,
  ArrowsClockwise,
  UserCheck,
  WarningCircle,
  LinkSimple,
  Sparkle,
  ShieldCheck,
} from '@phosphor-icons/react'
import {
  buscarClientesOperacional,
  buscarDossieCliente,
  atualizarChecklistCliente,
  buscarConfiguracaoWhatsapp,
  salvarConfiguracaoWhatsapp,
  type ClienteTriagemResumo,
  type DossieClienteCompleto,
  type ConfiguracaoWhatsappTenant,
  type TipoCasoJuridico,
} from '../api/djen'

const TIPO_CASO_LABELS: Record<TipoCasoJuridico, { label: string; color: string; bg: string }> = {
  ECOMMERCE_ML: {
    label: 'E-commerce · Mercado Livre',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.12)',
  },
  RCV_BANCARIO: {
    label: 'Bancário · Revisional Veículo (RCV)',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.12)',
  },
  GERAL: {
    label: 'Cível / Geral',
    color: '#a3e635',
    bg: 'rgba(163,230,53,0.12)',
  },
}

const ORIGEM_BADGE: Record<'LEAD' | 'NOVO' | 'ANTIGO', { label: string; color: string; bg: string }> = {
  LEAD: { label: 'Lead Anúncio', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  NOVO: { label: 'Novo Contato', color: '#e09f3e', bg: 'rgba(224,159,62,0.12)' },
  ANTIGO: { label: 'Cliente Recorrente', color: '#93c5fd', bg: 'rgba(147,197,253,0.12)' },
}

function formatHoraData(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function OperacionalWhatsappPanel() {
  const [clientes, setClientes] = useState<ClienteTriagemResumo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dossie, setDossie] = useState<DossieClienteCompleto | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDossie, setLoadingDossie] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Configuração do Webhook Meta Cloud API (Multi-tenant)
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState<ConfiguracaoWhatsappTenant | null>(null)
  const [wabaIdInput, setWabaIdInput] = useState('')
  const [phoneIdInput, setPhoneIdInput] = useState('')
  const [displayPhoneInput, setDisplayPhoneInput] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null)

  // Feedback de cópia
  const [copiedCobranca, setCopiedCobranca] = useState(false)
  const [copiedDossie, setCopiedDossie] = useState(false)
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false)
  const [copiedVerifyToken, setCopiedVerifyToken] = useState(false)
  const [copiedPrivacyUrl, setCopiedPrivacyUrl] = useState(false)

  const carregarClientes = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true)
    try {
      const [res, cfg] = await Promise.all([
        buscarClientesOperacional(),
        buscarConfiguracaoWhatsapp().catch(() => null),
      ])
      if (cfg) setConfig(cfg)
      setClientes(res.items)
      if (res.items.length > 0) {
        setSelectedId(prev => {
          if (prev && res.items.some(c => c.id === prev)) return prev
          return res.items[0]!.id
        })
      } else {
        setSelectedId(null)
        setDossie(null)
      }
    } catch (err) {
      console.error('Falha ao listar clientes da triagem:', err)
    } finally {
      if (!silent) setLoadingList(false)
    }
  }, [])

  const carregarDossie = useCallback(async (clienteId: string, silent = false) => {
    if (!silent) setLoadingDossie(true)
    try {
      const res = await buscarDossieCliente(clienteId)
      setDossie(res)
    } catch (err) {
      console.error('Falha ao carregar dossiê do cliente:', err)
    } finally {
      if (!silent) setLoadingDossie(false)
    }
  }, [])

  useEffect(() => {
    void carregarClientes(false)
    buscarConfiguracaoWhatsapp()
      .then(cfg => {
        setConfig(cfg)
        setWabaIdInput(cfg.whatsappWabaId || '')
        setPhoneIdInput(cfg.whatsappPhoneNumberId || '')
        setDisplayPhoneInput(cfg.whatsappDisplayPhone || '')
      })
      .catch(() => {})
  }, [carregarClientes])

  useEffect(() => {
    if (selectedId) {
      void carregarDossie(selectedId, false)
    }
  }, [selectedId, carregarDossie])

  // Atualização em tempo real (a cada 5s) para exibir mensagens recebidas do celular sem precisar dar F5
  useEffect(() => {
    const timer = setInterval(() => {
      void carregarClientes(true)
      if (selectedId) {
        void carregarDossie(selectedId, true)
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [carregarClientes, carregarDossie, selectedId])

  async function handleManualRefresh() {
    setRefreshing(true)
    try {
      await carregarClientes(true)
      if (selectedId) await carregarDossie(selectedId, true)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleToggleChecklistItem(itemKey: string, recebidoAtual: boolean) {
    if (!dossie) return
    try {
      const atualizado = await atualizarChecklistCliente(dossie.cliente.id, {
        itemKey,
        recebido: !recebidoAtual,
      })
      setDossie(atualizado)
      setClientes(prev => prev.map(c => (c.id === atualizado.cliente.id ? atualizado.cliente : c)))
    } catch (err) {
      console.error('Erro ao atualizar item do checklist:', err)
    }
  }

  async function handleChangeTipoCaso(novoTipo: TipoCasoJuridico) {
    if (!dossie) return
    try {
      const atualizado = await atualizarChecklistCliente(dossie.cliente.id, {
        tipoCaso: novoTipo,
      })
      setDossie(atualizado)
      setClientes(prev => prev.map(c => (c.id === atualizado.cliente.id ? atualizado.cliente : c)))
    } catch (err) {
      console.error('Erro ao alterar nicho do caso:', err)
    }
  }

  async function handleSalvarConfig(e: React.FormEvent) {
    e.preventDefault()
    setSavingConfig(true)
    setConfigSavedMsg(null)
    try {
      const atualizado = await salvarConfiguracaoWhatsapp({
        whatsappWabaId: wabaIdInput,
        whatsappPhoneNumberId: phoneIdInput,
        whatsappDisplayPhone: displayPhoneInput,
      })
      setConfig(atualizado)
      setConfigSavedMsg(
        atualizado.metaSubscribed
          ? 'Vínculo salvo e conta WABA inscrita automaticamente na Graph API da Meta (subscribed_apps OK)!'
          : 'Vínculo salvo no banco de dados do escritório.'
      )
    } catch {
      setConfigSavedMsg('Erro ao salvar configuração.')
    } finally {
      setSavingConfig(false)
    }
  }

  function copiarMensagemCobrancaFaltantes() {
    if (!dossie) return
    const faltantes = dossie.checklist.filter(i => i.obrigatorio && !i.recebido)
    const texto =
      faltantes.length === 0
        ? `Olá ${dossie.cliente.nome}! Confirmamos o recebimento de toda a documentação necessária (${TIPO_CASO_LABELS[dossie.cliente.tipoCaso].label}). Já estamos gerando sua Procuração Digital para assinatura.`
        : `Olá ${dossie.cliente.nome}, tudo bem? Recebemos seu relato e os primeiros arquivos aqui no escritório!\n\nPara finalizarmos sua pasta e gerarmos a Procuração Digital, faltam apenas os seguintes documentos:\n${faltantes.map(f => `• *${f.label}* (${f.descricao})`).join('\n')}\n\nPode nos enviar por foto ou PDF aqui mesmo no WhatsApp!`

    void navigator.clipboard.writeText(texto)
    setCopiedCobranca(true)
    setTimeout(() => setCopiedCobranca(false), 2500)
  }

  function copiarDossieParaInicial() {
    if (!dossie) return
    const docsRecebidos = dossie.checklist.filter(i => i.recebido).map(i => `✅ ${i.label}`).join('\n')
    const docsPendentes = dossie.checklist.filter(i => !i.recebido).map(i => `⏳ ${i.label}`).join('\n')

    const historicoFormatado = dossie.mensagens
      .map(m => {
        const data = formatHoraData(m.enviadaEm)
        if (m.tipo === 'audio') {
          return `[${data}] ÁUDIO TRANSCRITO: "${m.transcricao ?? 'Áudio recebido'}"`
        }
        if (m.midia) {
          const explicacao = m.explicacaoContextual
            ? ` -> Explicação dada pelo cliente na sequência: "${m.explicacaoContextual}"`
            : m.texto
            ? ` -> Legenda: "${m.texto}"`
            : ''
          return `[${data}] ANEXO (${m.midia.tipoDoc} - ${m.midia.nomeArquivo})${explicacao}`
        }
        return `[${data}] MENSAGEM DE TEXTO: "${m.texto}"`
      })
      .join('\n')

    const promptDossie = [
      `=== DOSSIÊ DE TRIAGEM JURÍDICA (WHATSAPP) ===`,
      `Cliente: ${dossie.cliente.nome}`,
      `Telefone: ${dossie.cliente.telefone}`,
      `Natureza da Demanda: ${TIPO_CASO_LABELS[dossie.cliente.tipoCaso].label}`,
      `Status da Pasta: ${dossie.cliente.status}`,
      ``,
      `--- SÍNTESE DOS FATOS ---`,
      dossie.cliente.resumoContexto,
      ``,
      `--- CHECKLIST DOCUMENTAL ---`,
      docsRecebidos || 'Nenhum documento validado ainda.',
      docsPendentes ? `\nPendentes:\n${docsPendentes}` : '',
      ``,
      `--- LINHA DO TEMPO CRONOLÓGICA (TEXTOS + ÁUDIOS + IMAGENS EXPLICADAS) ---`,
      historicoFormatado,
    ].join('\n')

    void navigator.clipboard.writeText(promptDossie)
    setCopiedDossie(true)
    setTimeout(() => setCopiedDossie(false), 2500)
  }

  const webhookCallbackUrl = `${window.location.origin}/webhook/whatsapp`
  const privacyPolicyUrl = `${window.location.origin}/politica-de-privacidade`
  const verifyTokenValue = config?.verifyToken ?? 'djen-meta-verify-2026'

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR DE COMANDO E CONFIGURAÇÃO META CLOUD API */}
      <div
        className="p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}
          >
            <WhatsappLogo size={22} weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>
                Estação de Triagem WhatsApp & Dossiê do Cliente
              </h2>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(74,222,128,0.12)',
                  color: '#4ade80',
                  border: '1px solid rgba(74,222,128,0.25)',
                }}
              >
                Escuta em Tempo Real (5s)
              </span>
              {config?.ultimoWebhookEm && (
                <span className="text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>
                  Último evento Meta: {formatHoraData(config.ultimoWebhookEm)}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
              Recebe mensagens, áudios e documentos enviados pelos clientes na API Oficial da Meta e organiza a pasta para a inicial.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: 'var(--color-surface-overlay)',
              border: '1px solid var(--color-edge)',
              color: 'var(--color-ink)',
            }}
          >
            <ArrowsClockwise size={14} className={refreshing ? 'animate-spin' : ''} weight="bold" />
            Atualizar Fila
          </button>

          <button
            type="button"
            onClick={() => setShowConfig(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: showConfig ? 'var(--color-accent)' : 'rgba(224,159,62,0.12)',
              border: '1px solid rgba(224,159,62,0.35)',
              color: showConfig ? '#09090b' : 'var(--color-accent)',
            }}
          >
            <GearSix size={15} weight="bold" />
            Configuração Meta Cloud API
          </button>
        </div>
      </div>

      {/* GAVETA DE CONFIGURAÇÃO DO WEBHOOK META (IMPLANTACAO SAAS POR ESCRITÓRIO) */}
      {(showConfig || clientes.length === 0) && (
        <div
          className="p-5 rounded-2xl space-y-4"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid rgba(224,159,62,0.35)',
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-accent)' }}>
                <ShieldCheck size={16} weight="fill" />
                Guia de Implantação do Escritório · Meta WhatsApp Cloud API Oficial
              </h3>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>
                Para que a Meta envie as mensagens reais do celular para este painel (em vez de retê-las apenas na <em>Etapa 1. Experimente</em>), conclua os <strong>3 passos obrigatórios da Meta</strong> abaixo:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Passo 1: URLs e Tokens para colar na Meta */}
            <div
              className="p-4 rounded-xl space-y-3"
              style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-edge-subtle)' }}
            >
              <p className="text-xs font-bold" style={{ color: 'var(--color-ink)' }}>
                Passo 1 · Webhook (Etapa 2 da Meta)
              </p>

              <div className="space-y-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--color-ink-faint)' }}>
                  URL de Callback (HTTPS)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookCallbackUrl}
                    className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-mono"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-edge)',
                      color: 'var(--color-ink)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(webhookCallbackUrl)
                      setCopiedWebhookUrl(true)
                      setTimeout(() => setCopiedWebhookUrl(false), 2000)
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer flex items-center gap-1"
                    style={{
                      background: 'rgba(224,159,62,0.14)',
                      color: 'var(--color-accent)',
                    }}
                  >
                    {copiedWebhookUrl ? <Check size={13} /> : <Copy size={13} />}
                    {copiedWebhookUrl ? 'OK' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--color-ink-faint)' }}>
                  Verificar Token (Verify Token)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={verifyTokenValue}
                    className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-mono"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-edge)',
                      color: 'var(--color-ink)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(verifyTokenValue)
                      setCopiedVerifyToken(true)
                      setTimeout(() => setCopiedVerifyToken(false), 2000)
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer flex items-center gap-1"
                    style={{
                      background: 'rgba(224,159,62,0.14)',
                      color: 'var(--color-accent)',
                    }}
                  >
                    {copiedVerifyToken ? <Check size={13} /> : <Copy size={13} />}
                    {copiedVerifyToken ? 'OK' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>

            {/* Passo 2: Assinar o campo "messages" e Chave "Ao Vivo" */}
            <div
              className="p-4 rounded-xl space-y-2.5"
              style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-edge-subtle)' }}
            >
              <p className="text-xs font-bold" style={{ color: 'var(--color-ink)' }}>
                Passo 2 · Liberar Disparo Externo na Meta
              </p>
              <ul className="text-xs space-y-1.5 leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>
                <li>
                  • Em <strong>Campos do webhook</strong> (Etapa 2), role a tabela até a letra <strong>M</strong>, ative a chave <strong>Assinar</strong> na linha <code>messages</code> e clique em <strong>Teste</strong>.
                </li>
                <li>
                  • Para que mensagens do seu celular não fiquem retidas no modo de desenvolvimento, vire a chave no topo da Meta para <strong>Ao vivo</strong>. Caso a Meta peça a <em>URL da Política de Privacidade</em> em <em>Configurações do app &gt; Básico</em>, use o link abaixo:
                </li>
              </ul>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={privacyPolicyUrl}
                  className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-mono"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-edge)',
                    color: 'var(--color-ink)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(privacyPolicyUrl)
                    setCopiedPrivacyUrl(true)
                    setTimeout(() => setCopiedPrivacyUrl(false), 2000)
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer flex items-center gap-1"
                  style={{
                    background: 'rgba(224,159,62,0.14)',
                    color: 'var(--color-accent)',
                  }}
                >
                  {copiedPrivacyUrl ? <Check size={13} /> : <Copy size={13} />}
                  {copiedPrivacyUrl ? 'OK' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Passo 3: Vínculo Multi-tenant do Phone Number ID e WABA ID do Escritório */}
            <form
              onSubmit={e => void handleSalvarConfig(e)}
              className="p-4 rounded-xl space-y-3"
              style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-edge-subtle)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold" style={{ color: 'var(--color-ink)' }}>
                  Passo 3 · Ativação do Escritório ({config?.escritorioNome ?? 'Escritório Piloto'})
                </p>
                {config?.tokenConfiguradoNoServidor && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}
                  >
                    Token .env Ativo
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--color-ink-faint)' }}>
                    Identificação da Conta de Mensagens (WABA ID)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 2346185095786771"
                    value={wabaIdInput}
                    onChange={e => setWabaIdInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-mono"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-edge)',
                      color: 'var(--color-ink)',
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium" style={{ color: 'var(--color-ink-faint)' }}>
                      Phone Number ID
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 1461573947028881"
                      value={phoneIdInput}
                      onChange={e => setPhoneIdInput(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg text-xs font-mono"
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-edge)',
                        color: 'var(--color-ink)',
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium" style={{ color: 'var(--color-ink-faint)' }}>
                      Número WhatsApp
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 5543996034632"
                      value={displayPhoneInput}
                      onChange={e => setDisplayPhoneInput(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg text-xs font-mono"
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-edge)',
                        color: 'var(--color-ink)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                  style={{
                    background: 'var(--color-accent)',
                    color: '#09090b',
                  }}
                >
                  {savingConfig ? 'Ativando na Meta...' : 'Salvar & Inscrever na Meta'}
                </button>
              </div>

              {configSavedMsg && (
                <p className="text-xs font-medium" style={{ color: '#4ade80' }}>
                  {configSavedMsg}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ESTAÇÃO DE TRABALHO EM 3 COLUNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* COLUNA 1 (ESQUERDA - 3 cols): FILA DE CLIENTES EM TRIAGEM */}
        <div
          className="lg:col-span-3 rounded-2xl p-3.5 space-y-3"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
        >
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>
              Clientes em Triagem ({clientes.length})
            </h3>
          </div>

          {loadingList ? (
            <div className="p-4 text-xs text-center" style={{ color: 'var(--color-ink-faint)' }}>
              Carregando fila de atendimento...
            </div>
          ) : clientes.length === 0 ? (
            <div className="p-5 text-xs text-center space-y-2" style={{ color: 'var(--color-ink-muted)' }}>
              <p className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                Aguardando primeira mensagem real
              </p>
              <p className="leading-relaxed">
                Assim que a Meta disparar o evento <code>messages</code> para o nosso Webhook, o contato aparecerá automaticamente aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[680px] overflow-y-auto overscroll-contain pr-1">
              {clientes.map(cli => {
                const isSelected = cli.id === selectedId
                const casoMeta = TIPO_CASO_LABELS[cli.tipoCaso]
                const origemMeta = ORIGEM_BADGE[cli.origem]
                const completo = cli.checklistRecebidos >= cli.checklistTotal && cli.checklistTotal > 0

                return (
                  <button
                    key={cli.id}
                    type="button"
                    onClick={() => setSelectedId(cli.id)}
                    className="w-full text-left p-3 rounded-xl transition-all cursor-pointer space-y-2"
                    style={{
                      background: isSelected ? 'rgba(224,159,62,0.10)' : 'var(--color-surface-overlay)',
                      border: isSelected
                        ? '1px solid rgba(224,159,62,0.45)'
                        : '1px solid var(--color-edge-subtle)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold leading-snug" style={{ color: 'var(--color-ink)' }}>
                        {cli.nome}
                      </p>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: origemMeta.bg, color: origemMeta.color }}
                      >
                        {origemMeta.label}
                      </span>
                    </div>

                    <p className="text-[11px] font-mono" style={{ color: 'var(--color-ink-faint)' }}>
                      {cli.telefone}
                    </p>

                    <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                        style={{ background: casoMeta.bg, color: casoMeta.color }}
                      >
                        {casoMeta.label}
                      </span>

                      <span
                        className="text-[10px] font-bold flex items-center gap-1"
                        style={{ color: completo ? '#4ade80' : '#fbbf24' }}
                      >
                        {completo ? <CheckCircle size={12} weight="fill" /> : <Clock size={12} weight="bold" />}
                        {cli.checklistRecebidos}/{cli.checklistTotal} docs
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* COLUNA 2 (CENTRO - 5 cols): HISTÓRICO CRONOLÓGICO UNIFICADO (TEXTOS + ÁUDIOS + IMAGENS AVULSAS EXPLICADAS) */}
        <div
          className="lg:col-span-5 rounded-2xl p-4 space-y-3 flex flex-col"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
        >
          {!dossie || loadingDossie ? (
            <div className="p-8 text-xs text-center space-y-2" style={{ color: 'var(--color-ink-faint)' }}>
              <p className="font-semibold" style={{ color: 'var(--color-ink-muted)' }}>
                Linha do Tempo da Conversa
              </p>
              <p>
                Quando um cliente da fila ao lado é selecionado, todas as mensagens de texto, áudios transcritos e documentos aparecem aqui em ordem cronológica.
              </p>
            </div>
          ) : (
            <>
              <div
                className="pb-3 flex items-center justify-between gap-2"
                style={{ borderBottom: '1px solid var(--color-edge-subtle)' }}
              >
                <div>
                  <h3 className="text-xs font-bold" style={{ color: 'var(--color-ink)' }}>
                    Histórico Cronológico da Conversa ({dossie.mensagens.length} mensagens)
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>
                    Imagens avulsas são automaticamente conectadas às mensagens de texto que o cliente digitou em seguida.
                  </p>
                </div>
              </div>

              <div className="space-y-3 max-h-[620px] overflow-y-auto overscroll-contain pr-1">
                {dossie.mensagens.map((msg, idx) => {
                  const isAudio = msg.tipo === 'audio'
                  const isImage = msg.tipo === 'image'
                  const isDoc = msg.tipo === 'document'

                  return (
                    <div
                      key={msg.id}
                      className="p-3.5 rounded-xl space-y-2"
                      style={{
                        background: 'var(--color-surface-overlay)',
                        border: isAudio
                          ? '1px solid rgba(224,159,62,0.30)'
                          : isImage || isDoc
                          ? '1px solid rgba(96,165,250,0.30)'
                          : '1px solid var(--color-edge-subtle)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-ink)' }}>
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-ink-muted)' }}
                          >
                            {idx + 1}
                          </span>
                          {isAudio && (
                            <>
                              <Microphone size={14} weight="fill" style={{ color: 'var(--color-accent)' }} />
                              Áudio de Voz Recebido
                            </>
                          )}
                          {isImage && (
                            <>
                              <ImageIcon size={14} weight="fill" style={{ color: '#60a5fa' }} />
                              Imagem Enviada pelo Cliente
                            </>
                          )}
                          {isDoc && (
                            <>
                              <FileText size={14} weight="fill" style={{ color: '#4ade80' }} />
                              Documento PDF / Anexo
                            </>
                          )}
                          {!isAudio && !isImage && !isDoc && 'Mensagem de Texto do Cliente'}
                        </span>
                        <span style={{ color: 'var(--color-ink-faint)' }}>{formatHoraData(msg.enviadaEm)}</span>
                      </div>

                      {/* CARTÃO DE MÍDIA (IMAGEM OU PDF) */}
                      {msg.midia && (
                        <div
                          className="p-2.5 rounded-lg flex items-center justify-between gap-2"
                          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-mono font-semibold truncate" style={{ color: 'var(--color-ink)' }}>
                              {msg.midia.nomeArquivo}
                            </p>
                            <p className="text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>
                              Classificação automática: <strong>{msg.midia.tipoDoc}</strong>
                            </p>
                          </div>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0"
                            style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}
                          >
                            Arquivado na Pasta
                          </span>
                        </div>
                      )}

                      {/* TRANSCRIÇÃO AUTOMÁTICA DE ÁUDIO */}
                      {msg.transcricao && (
                        <div
                          className="p-3 rounded-lg space-y-1"
                          style={{
                            background: 'rgba(224,159,62,0.08)',
                            border: '1px solid rgba(224,159,62,0.22)',
                          }}
                        >
                          <p
                            className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                            style={{ color: 'var(--color-accent)' }}
                          >
                            <Sparkle size={12} weight="fill" />
                            Transcrição em Texto do Áudio
                          </p>
                          <p className="text-xs leading-relaxed italic" style={{ color: 'var(--color-ink)' }}>
                            "{msg.transcricao}"
                          </p>
                        </div>
                      )}

                      {/* TEXTO OU LEGENDA DIRETA */}
                      {msg.texto && (
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-ink)' }}>
                          {msg.texto}
                        </p>
                      )}

                      {/* VÍNCULO INTELIGENTE: IMAGEM AVULSA + EXPLICAÇÃO DIGITADA DEPOIS */}
                      {msg.explicacaoContextual && (
                        <div
                          className="p-2.5 rounded-lg space-y-1"
                          style={{
                            background: 'rgba(96,165,250,0.08)',
                            border: '1px solid rgba(96,165,250,0.25)',
                          }}
                        >
                          <p
                            className="text-[10px] font-bold flex items-center gap-1"
                            style={{ color: '#60a5fa' }}
                          >
                            <LinkSimple size={12} weight="bold" />
                            Contexto vinculado da mensagem seguinte do cliente:
                          </p>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-ink)' }}>
                            "{msg.explicacaoContextual}"
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* COLUNA 3 (DIREITA - 4 cols): DOSSIÊ DO CLIENTE, CHECKLIST INTERATIVO & AÇÕES */}
        <div
          className="lg:col-span-4 rounded-2xl p-4 space-y-4"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
        >
          {!dossie ? (
            <div className="p-6 text-xs text-center space-y-2" style={{ color: 'var(--color-ink-faint)' }}>
              <p className="font-semibold" style={{ color: 'var(--color-ink-muted)' }}>
                Checklist Documental & Dossiê
              </p>
              <p>
                Exibirá automaticamente os documentos obrigatórios (RCV Bancário ou E-commerce) e o botão de cobrança no WhatsApp assim que o cliente iniciar o contato.
              </p>
            </div>
          ) : (
            <>
              {/* Cabeçalho do Dossiê e Seletor de Tipo de Caso */}
              <div className="space-y-2 pb-3" style={{ borderBottom: '1px solid var(--color-edge-subtle)' }}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>
                    Pasta · {dossie.cliente.nome}
                  </h3>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background:
                        dossie.cliente.faltando.length === 0
                          ? 'rgba(74,222,128,0.14)'
                          : 'rgba(251,191,36,0.14)',
                      color: dossie.cliente.faltando.length === 0 ? '#4ade80' : '#fbbf24',
                    }}
                  >
                    {dossie.cliente.faltando.length === 0 ? 'Pronto p/ Procuração' : 'Documentação Pendente'}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--color-ink-faint)' }}>
                    Enquadramento Jurídico / Tipo de Checklist:
                  </label>
                  <select
                    value={dossie.cliente.tipoCaso}
                    onChange={e => void handleChangeTipoCaso(e.target.value as TipoCasoJuridico)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    style={{
                      background: 'var(--color-surface-overlay)',
                      border: '1px solid var(--color-edge)',
                      color: 'var(--color-ink)',
                    }}
                  >
                    <option value="ECOMMERCE_ML">E-commerce · Mercado Livre (Golpe / Retenção)</option>
                    <option value="RCV_BANCARIO">Direito Bancário · Revisional de Veículo (RCV)</option>
                    <option value="GERAL">Cível Geral / Outros</option>
                  </select>
                </div>
              </div>

              {/* Checklist Interativo de Documentos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>
                    Checklist de Documentos ({dossie.cliente.checklistRecebidos}/{dossie.cliente.checklistTotal})
                  </h4>
                  <span className="text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>
                    Clique para validar/desmarcar
                  </span>
                </div>

                <div className="space-y-1.5">
                  {dossie.checklist.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => void handleToggleChecklistItem(item.key, item.recebido)}
                      className="w-full text-left p-2.5 rounded-xl flex items-start gap-2.5 transition-all cursor-pointer"
                      style={{
                        background: item.recebido ? 'rgba(74,222,128,0.07)' : 'var(--color-surface-overlay)',
                        border: item.recebido
                          ? '1px solid rgba(74,222,128,0.28)'
                          : '1px solid var(--color-edge-subtle)',
                      }}
                    >
                      <div className="mt-0.5 shrink-0">
                        {item.recebido ? (
                          <CheckCircle size={16} weight="fill" style={{ color: '#4ade80' }} />
                        ) : (
                          <WarningCircle size={16} weight="bold" style={{ color: '#fbbf24' }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className="text-xs font-semibold leading-snug"
                            style={{ color: item.recebido ? '#4ade80' : 'var(--color-ink)' }}
                          >
                            {item.label}
                          </p>
                          {!item.obrigatorio && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ color: 'var(--color-ink-faint)' }}>
                              Opcional
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
                          {item.descricao}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Botão 1: Copiar Cobrança de Documentos Faltantes para mandar no WhatsApp */}
              <button
                type="button"
                onClick={copiarMensagemCobrancaFaltantes}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                style={{
                  background: copiedCobranca ? 'rgba(74,222,128,0.18)' : 'var(--color-surface-overlay)',
                  border: copiedCobranca ? '1px solid rgba(74,222,128,0.4)' : '1px solid var(--color-edge)',
                  color: copiedCobranca ? '#4ade80' : 'var(--color-ink)',
                }}
              >
                {copiedCobranca ? <Check size={15} weight="bold" /> : <Copy size={15} weight="bold" />}
                {copiedCobranca
                  ? 'Mensagem copiada para colar no WhatsApp!'
                  : dossie.cliente.faltando.length > 0
                  ? `Copiar Cobrança dos ${dossie.cliente.faltando.length} Doc(s) Faltantes`
                  : 'Copiar Confirmação de Pasta Completa'}
              </button>

              {/* Resumo Cronológico Consolidado do Caso */}
              <div
                className="p-3 rounded-xl space-y-1.5"
                style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-edge-subtle)' }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>
                  Resumo Consolidado dos Fatos (Texto + Áudios)
                </p>
                <p className="text-xs whitespace-pre-line leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>
                  {dossie.cliente.resumoContexto}
                </p>
              </div>

              {/* Botão 2: Copiar Dossiê Completo para Petição Inicial / Procuração */}
              <button
                type="button"
                onClick={copiarDossieParaInicial}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                style={{
                  background: copiedDossie ? '#4ade80' : 'var(--color-accent)',
                  color: '#09090b',
                }}
              >
                {copiedDossie ? <Check size={15} weight="bold" /> : <UserCheck size={15} weight="bold" />}
                {copiedDossie
                  ? 'Dossiê Completo Copiado!'
                  : 'Copiar Dossiê Completo p/ Inicial & Procuração'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  WhatsappLogo,
  GearSix,
  ArrowsClockwise,
  Check,
  Copy,
  MagnifyingGlass,
  Sparkle,
  UserCheck,
  FolderSimple,
  FileText,
  DownloadSimple,
  ArrowSquareOut,
  CheckCircle,
  WarningCircle,
  Clock,
  X,
  ShieldCheck,
  Play,
  Pause,
  Microphone,
  Image as ImageIcon,
  Users,
  CaretRight,
  ChatCircleText,
  IdentificationCard,
  ListChecks,
  Scroll,
} from '@phosphor-icons/react'
import {
  buscarClientesOperacional,
  buscarDossieCliente,
  atualizarChecklistCliente,
  buscarConfiguracaoWhatsapp,
  salvarConfiguracaoWhatsapp,
  urlMidiaOperacional,
  baixarZipPastaCliente,
  urlGerarKitContratual,
  reprocessarMidiasCliente,
  atualizarQualificacaoCliente,
  type ClienteTriagemResumo,
  type DossieClienteCompleto,
  type ConfiguracaoWhatsappTenant,
  type TipoCasoJuridico,
} from '../api/djen'

const TIPO_CASO_LABELS: Record<TipoCasoJuridico, { label: string; color: string; bg: string }> = {
  NAO_CLASSIFICADO: { label: 'Em Triagem', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  RCV_BANCARIO:     { label: 'Direito Bancário', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  ECOMMERCE_ML:     { label: 'E-commerce & Digital', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  CIVEL_CONSUMIDOR: { label: 'Cível & Consumidor', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  TRABALHISTA:      { label: 'Trabalhista', color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  TRIBUTARIO:       { label: 'Tributário', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  PENAL:            { label: 'Penal', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  GERAL:            { label: 'Geral', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

function formatHoraData(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatDataCurta(isoString: string): string {
  try {
    const d = new Date(isoString)
    const hoje = new Date()
    if (d.toDateString() === hoje.toDateString()) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  } catch {
    return ''
  }
}

function formatTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  return tel
}

export function OperacionalWhatsappPanel() {
  const [clientes, setClientes] = useState<ClienteTriagemResumo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dossie, setDossie] = useState<DossieClienteCompleto | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDossie, setLoadingDossie] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [extractingOcr, setExtractingOcr] = useState(false)
  const [savingQualificacao, setSavingQualificacao] = useState(false)
  const [qualificacaoMsg, setQualificacaoMsg] = useState<string | null>(null)

  // Filtros da Fila
  const [buscaCliente, setBuscaCliente] = useState('')
  const [filtroCaso, setFiltroCaso] = useState<string>('TODOS')

  // Navegação Mobile (Alterna entre Fila, Chat e Dossiê no celular)
  const [mobileTab, setMobileTab] = useState<'lista' | 'chat' | 'dossie'>('lista')

  // Abas do Dossiê do Cliente (Coluna Direita)
  const [dossieTab, setDossieTab] = useState<'qualificacao' | 'checklist' | 'minutas'>('qualificacao')

  // Modal Central de Configuração da Meta
  const [showModalConfig, setShowModalConfig] = useState(false)
  const [config, setConfig] = useState<ConfiguracaoWhatsappTenant | null>(null)
  const [wabaIdInput, setWabaIdInput] = useState('')
  const [phoneIdInput, setPhoneIdInput] = useState('')
  const [displayPhoneInput, setDisplayPhoneInput] = useState('')
  const [accessTokenInput, setAccessTokenInput] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null)

  // Player de Áudio minimalista
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({})
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({})
  const [expandedTranscricaoId, setExpandedTranscricaoId] = useState<string | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Edição de Qualificação
  const [editQualificacao, setEditQualificacao] = useState(false)
  const [cpfInput, setCpfInput] = useState('')
  const [rgInput, setRgInput] = useState('')
  const [estadoCivilInput, setEstadoCivilInput] = useState('solteiro(a)')
  const [enderecoInput, setEnderecoInput] = useState('')
  const [cidadeInput, setCidadeInput] = useState('')
  const [ufInput, setUfInput] = useState('')

  // Feedback de Cópia
  const [copiedCobranca, setCopiedCobranca] = useState(false)
  const [copiedDossie, setCopiedDossie] = useState(false)
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false)
  const [copiedVerifyToken, setCopiedVerifyToken] = useState(false)

  const carregarClientes = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true)
    try {
      const [res, cfg] = await Promise.all([
        buscarClientesOperacional(),
        buscarConfiguracaoWhatsapp().catch(() => null),
      ])
      if (cfg) {
        setConfig(cfg)
        setWabaIdInput(cfg.whatsappWabaId || '')
        setPhoneIdInput(cfg.whatsappPhoneNumberId || '')
        setDisplayPhoneInput(cfg.whatsappDisplayPhone || '')
      }
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
  }, [carregarClientes])

  useEffect(() => {
    if (selectedId) {
      void carregarDossie(selectedId, false)
    }
  }, [selectedId, carregarDossie])

  // Polling silencioso a cada 5s para novos áudios/mensagens do WhatsApp
  useEffect(() => {
    const timer = setInterval(() => {
      void carregarClientes(true)
      if (selectedId) {
        void carregarDossie(selectedId, true)
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [carregarClientes, carregarDossie, selectedId])

  useEffect(() => {
    if (dossie?.cliente.qualificacao) {
      const q = dossie.cliente.qualificacao
      setCpfInput(q.cpf ?? '')
      setRgInput(q.rg ? (q.orgaoEmissor ? `${q.rg} ${q.orgaoEmissor}` : q.rg) : '')
      setEstadoCivilInput(q.estadoCivil ?? 'solteiro(a)')
      setEnderecoInput(q.endereco ?? '')
      setCidadeInput(q.cidade ?? '')
      setUfInput(q.uf ?? '')
    }
  }, [dossie?.cliente.id, dossie?.cliente.qualificacao])

  useEffect(() => {
    if (dossie?.mensagens?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [dossie?.cliente?.id, dossie?.mensagens?.length])

  async function handleManualRefresh() {
    setRefreshing(true)
    try {
      await carregarClientes(true)
      if (selectedId) await carregarDossie(selectedId, true)
    } finally {
      setRefreshing(false)
    }
  }

  // Métricas Executivas da Esteira Jurídica (100% Advogado)
  const kpis = useMemo(() => {
    const novos = clientes.filter(c => c.tipoCaso === 'NAO_CLASSIFICADO').length
    const pendentes = clientes.filter(c => c.checklistRecebidos < c.checklistTotal && c.tipoCaso !== 'NAO_CLASSIFICADO').length
    const prontos = clientes.filter(c => c.checklistRecebidos >= c.checklistTotal && c.checklistTotal > 0).length
    const semRetorno = clientes.filter(c => {
      const diffHs = (Date.now() - new Date(c.updatedAt).getTime()) / (1000 * 3600)
      return diffHs >= 48
    }).length
    return { novos, pendentes, prontos, semRetorno }
  }, [clientes])

  // Filtro de Busca da Lista
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      const matchBusca =
        !buscaCliente.trim() ||
        c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
        c.telefone.includes(buscaCliente)
      const matchCaso = filtroCaso === 'TODOS' || c.tipoCaso === filtroCaso
      return matchBusca && matchCaso
    })
  }, [clientes, buscaCliente, filtroCaso])

  // Player de Áudio customizado
  function togglePlayAudio(audioId: string) {
    const el = audioRefs.current[audioId]
    if (!el) return

    if (playingAudioId === audioId) {
      el.pause()
      setPlayingAudioId(null)
    } else {
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId]?.pause()
      }
      void el.play()
      setPlayingAudioId(audioId)
    }
  }

  async function handleToggleChecklistItem(itemKey: string, recebidoAtual: boolean) {
    if (!dossie) return
    const novoValor = !recebidoAtual
    try {
      const atualizado = await atualizarChecklistCliente(dossie.cliente.id, {
        itemKey,
        recebido: novoValor,
      })
      if (atualizado) setDossie(atualizado)
      setClientes(prev =>
        prev.map(c => {
          if (c.id !== dossie.cliente.id) return c
          const rec = novoValor ? c.checklistRecebidos + 1 : Math.max(0, c.checklistRecebidos - 1)
          return { ...c, checklistRecebidos: rec }
        })
      )
    } catch (err) {
      console.error('Falha ao alternar documento:', err)
    }
  }

  async function handleChangeTipoCaso(novoTipo: TipoCasoJuridico) {
    if (!dossie) return
    try {
      const atualizado = await atualizarChecklistCliente(dossie.cliente.id, {
        tipoCaso: novoTipo,
      })
      if (atualizado) setDossie(atualizado)
      setClientes(prev => prev.map(c => (c.id === dossie.cliente.id ? { ...c, tipoCaso: novoTipo } : c)))
    } catch (err) {
      console.error('Erro ao alterar nicho do caso:', err)
    }
  }

  async function handleDispararOcr() {
    if (!dossie) return
    setExtractingOcr(true)
    setQualificacaoMsg(null)
    try {
      const res = await reprocessarMidiasCliente(dossie.cliente.id)
      setDossie(res)
      setQualificacaoMsg('Documentos reprocessados com sucesso pela IA.')
      setTimeout(() => setQualificacaoMsg(null), 3500)
    } catch (err) {
      console.error('Falha no OCR:', err)
      setQualificacaoMsg('Falha ao reprocessar documentos.')
    } finally {
      setExtractingOcr(false)
    }
  }

  async function handleSalvarQualificacao() {
    if (!dossie) return
    setSavingQualificacao(true)
    setQualificacaoMsg(null)
    try {
      const res = await atualizarQualificacaoCliente(dossie.cliente.id, {
        cpf: cpfInput.trim() || undefined,
        rg: rgInput.trim() || undefined,
        estadoCivil: estadoCivilInput,
        endereco: enderecoInput.trim() || undefined,
        cidade: cidadeInput.trim() || undefined,
        uf: ufInput.trim() || undefined,
      })
      if (res) {
        setDossie(res)
        setEditQualificacao(false)
        setQualificacaoMsg('Dados cadastrais salvos no dossiê.')
        setTimeout(() => setQualificacaoMsg(null), 3000)
      }
    } catch (err) {
      console.error('Erro ao salvar qualificação:', err)
      setQualificacaoMsg('Erro ao salvar alterações.')
    } finally {
      setSavingQualificacao(false)
    }
  }

  async function handleSalvarConfig(e: React.FormEvent) {
    e.preventDefault()
    setSavingConfig(true)
    setConfigSavedMsg(null)
    try {
      const atualizado = await salvarConfiguracaoWhatsapp({
        whatsappWabaId: wabaIdInput.trim() || undefined,
        whatsappPhoneNumberId: phoneIdInput.trim(),
        whatsappDisplayPhone: displayPhoneInput.trim() || undefined,
        ...(accessTokenInput.trim() ? { accessToken: accessTokenInput.trim() } : {}),
      })
      setConfig(atualizado)
      setAccessTokenInput('')
      setConfigSavedMsg(
        atualizado.metaSubscribed
          ? 'Conexão salva e validada na Meta Cloud API com sucesso!'
          : 'Configuração salva no escritório.'
      )
      setTimeout(() => setConfigSavedMsg(null), 4000)
    } catch {
      setConfigSavedMsg('Erro ao salvar configuração.')
    } finally {
      setSavingConfig(false)
    }
  }

  function copiarMensagemCobrancaFaltantes() {
    if (!dossie) return
    const faltantes = dossie.checklist.filter(i => i.obrigatorio && !i.recebido)
    const nomePrimeiro = dossie.cliente.nome.split(' ')[0] ?? 'Cliente'
    const labelArea = TIPO_CASO_LABELS[dossie.cliente.tipoCaso]?.label ?? 'seu caso'

    let texto = `Olá, ${nomePrimeiro}! Tudo bem? Aqui é do escritório ${config?.escritorioNome ?? 'de advocacia'}.\n\n`
    if (faltantes.length > 0) {
      texto += `Para darmos andamento na sua ação de ${labelArea}, precisamos que nos envie por aqui os seguintes documentos pendentes:\n\n`
      faltantes.forEach((item, idx) => {
        texto += `${idx + 1}. *${item.label}* (${item.descricao})\n`
      })
      texto += `\nPode nos enviar foto nítida ou arquivo em PDF. Qualquer dúvida, estamos à disposição!`
    } else {
      texto += `Recebemos todos os documentos necessários para sua ação de ${labelArea}! Já estamos preparando sua Procuração e Contrato de Honorários para assinatura.`
    }

    void navigator.clipboard.writeText(texto)
    setCopiedCobranca(true)
    setTimeout(() => setCopiedCobranca(false), 2500)
  }

  async function handleBaixarZip() {
    if (!dossie) return
    setDownloadingZip(true)
    try {
      await baixarZipPastaCliente(dossie.cliente.id, dossie.cliente.nome)
    } catch (err) {
      console.error('Falha ao baixar pasta do cliente:', err)
    } finally {
      setDownloadingZip(false)
    }
  }

  function copiarDossieParaInicial() {
    if (!dossie) return
    const c = dossie.cliente
    const q = c.qualificacao
    const labelArea = TIPO_CASO_LABELS[c.tipoCaso]?.label ?? c.tipoCaso

    let texto = `=== DOSSIÊ DO CLIENTE P/ PETIÇÃO INICIAL ===\n`
    texto += `Escritório: ${config?.escritorioNome ?? 'Escritório de Advocacia'}\n`
    texto += `Cliente: ${c.nome}\n`
    texto += `Telefone: ${c.telefone}\n`
    texto += `Área Jurídica: ${labelArea}\n`
    texto += `Qualificação Civil:\n`
    texto += `  - CPF: ${q?.cpf ?? 'Pendente'}\n`
    texto += `  - RG: ${q?.rg ?? 'Pendente'}\n`
    texto += `  - Estado Civil: ${q?.estadoCivil ?? 'solteiro(a)'}\n`
    texto += `  - Endereço: ${q?.endereco ?? 'A confirmar'}, ${q?.cidade ?? 'Cidade'}/${q?.uf ?? 'UF'}, ${q?.cep ?? ''}\n\n`
    texto += `RESUMO FÁTICO DOS ÁUDIOS & MENSAGENS:\n${c.resumoContexto}\n\n`
    texto += `DOCUMENTOS PROBATÓRIOS:\n`
    const docs = dossie.mensagens.filter(m => m.midia).map(m => m.midia!)
    if (docs.length === 0) {
      texto += `- Nenhum documento anexado ainda.\n`
    } else {
      docs.forEach(d => {
        texto += `- [${d.tipoDoc}] ${d.nomeArquivo} (${d.estado})\n`
      })
    }

    void navigator.clipboard.writeText(texto)
    setCopiedDossie(true)
    setTimeout(() => setCopiedDossie(false), 2500)
  }

  const hostAtual = typeof window !== 'undefined' ? window.location.origin : ''
  const webhookCallbackUrl = `${hostAtual}/webhook/whatsapp`
  const verifyTokenValue = config?.verifyToken ?? 'djen-meta-verify-2026'
  const isConectado = config?.statusConexao === 'CONECTADO' || Boolean(config?.tokenConfiguradoNoServidor)

  return (
    <div className="space-y-5">
      {/* ── CABEÇALHO DO MÓDULO (Padrão Alessandro) ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>
              Triagem Operacional do WhatsApp
            </h2>
            <div className="flex items-center gap-1.5">
              {isConectado ? (
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {config?.whatsappDisplayPhone ? formatTelefone(config.whatsappDisplayPhone) : 'WhatsApp Conectado'}
                </span>
              ) : (
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer"
                  onClick={() => setShowModalConfig(true)}
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
                >
                  ○ Conectar WhatsApp
                </span>
              )}
            </div>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
            Atendimento pré-processual, qualificação automática via CNH e instrução de minutas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-edge)',
              color: 'var(--color-ink)',
            }}
          >
            <ArrowsClockwise size={13} className={refreshing ? 'animate-spin' : ''} weight="bold" />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => setShowModalConfig(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: 'rgba(224,159,62,0.12)',
              border: '1px solid rgba(224,159,62,0.35)',
              color: 'var(--color-accent)',
            }}
          >
            <GearSix size={14} weight="bold" />
            Configurar Conexão
          </button>
        </div>
      </div>

      {/* ── CARDS EXECUTIVOS: ESTEIRA JURÍDICA DE CONVERSÃO (Padrão Controladoria) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            titulo: 'Novos Contatos',
            valor: kpis.novos,
            subtitulo: 'Aguardando classificação',
            cor: '#60a5fa',
            ativo: filtroCaso === 'NAO_CLASSIFICADO',
            onClick: () => setFiltroCaso(prev => (prev === 'NAO_CLASSIFICADO' ? 'TODOS' : 'NAO_CLASSIFICADO')),
          },
          {
            titulo: 'Aguardando Documentos',
            valor: kpis.pendentes,
            subtitulo: 'Checklist pendente',
            cor: '#fbbf24',
            ativo: false,
            onClick: () => {},
          },
          {
            titulo: 'Prontos p/ Inicial',
            valor: kpis.prontos,
            subtitulo: 'Dossiê e CNH completos',
            cor: '#4ade80',
            ativo: false,
            onClick: () => {},
          },
          {
            titulo: 'Sem Retorno (+48h)',
            valor: kpis.semRetorno,
            subtitulo: 'Leads parados na fila',
            cor: '#a1a1aa',
            ativo: false,
            onClick: () => {},
          },
        ].map((card, idx) => (
          <div
            key={idx}
            onClick={card.onClick}
            className="p-3.5 rounded-2xl transition-all cursor-pointer"
            style={{
              background: card.ativo ? 'rgba(224,159,62,0.08)' : 'var(--color-surface-raised)',
              border: card.ativo ? '1px solid var(--color-accent)' : '1px solid var(--color-edge)',
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xl font-bold tracking-tight font-mono" style={{ color: card.cor }}>
                {card.valor}
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-faint)' }}>
                {card.titulo}
              </span>
            </div>
            <p className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--color-ink-muted)' }}>
              {card.subtitulo}
            </p>
          </div>
        ))}
      </div>

      {/* ── BARRA DE NAVEGAÇÃO MOBILE (Para visualização sem aperto em smartphones) ── */}
      <div className="lg:hidden flex items-center p-1 rounded-xl gap-1" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}>
        <button
          type="button"
          onClick={() => setMobileTab('lista')}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
          style={{
            background: mobileTab === 'lista' ? 'var(--color-surface-overlay)' : 'transparent',
            color: mobileTab === 'lista' ? 'var(--color-accent)' : 'var(--color-ink-muted)',
          }}
        >
          <Users size={14} />
          Clientes ({clientes.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('chat')}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
          style={{
            background: mobileTab === 'chat' ? 'var(--color-surface-overlay)' : 'transparent',
            color: mobileTab === 'chat' ? 'var(--color-accent)' : 'var(--color-ink-muted)',
          }}
        >
          <ChatCircleText size={14} />
          Conversa
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('dossie')}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
          style={{
            background: mobileTab === 'dossie' ? 'var(--color-surface-overlay)' : 'transparent',
            color: mobileTab === 'dossie' ? 'var(--color-accent)' : 'var(--color-ink-muted)',
          }}
        >
          <FolderSimple size={14} />
          Dossiê
        </button>
      </div>

      {/* ── ESTAÇÃO DE TRABALHO RESPONSIVA (3 Colunas em Desktop / 1 Coluna em Mobile) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* COLUNA 1: FILA DE CLIENTES EM ATENDIMENTO */}
        <div
          className={`lg:col-span-3 rounded-2xl p-3.5 space-y-3 ${
            mobileTab !== 'lista' ? 'hidden lg:block' : 'block'
          }`}
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
        >
          <div className="space-y-2">
            <div className="relative">
              <MagnifyingGlass size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar por nome ou fone..."
                value={buscaCliente}
                onChange={e => setBuscaCliente(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none"
                style={{
                  background: 'var(--color-surface-input)',
                  border: '1px solid var(--color-edge-subtle)',
                  color: 'var(--color-ink)',
                }}
              />
            </div>

            {filtroCaso !== 'TODOS' && (
              <div className="flex items-center justify-between text-[11px] px-1 text-amber-400">
                <span>Filtrando: {TIPO_CASO_LABELS[filtroCaso as TipoCasoJuridico]?.label}</span>
                <button type="button" onClick={() => setFiltroCaso('TODOS')} className="hover:underline cursor-pointer">
                  Limpar
                </button>
              </div>
            )}
          </div>

          {loadingList ? (
            <div className="py-8 text-xs text-center" style={{ color: 'var(--color-ink-faint)' }}>
              Carregando fila...
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="py-12 px-3 text-center space-y-3">
              <div
                className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center"
                style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-ink-faint)' }}
              >
                <WhatsappLogo size={22} weight="duotone" />
              </div>
              <h4 className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                {isConectado ? 'Fila Vazia' : 'WhatsApp Desconectado'}
              </h4>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>
                {isConectado
                  ? 'Assim que um cliente enviar mensagem no número do escritório, aparecerá aqui.'
                  : 'Conecte o número oficial da Meta Cloud API para iniciar a triagem de clientes.'}
              </p>
              {!isConectado && (
                <button
                  type="button"
                  onClick={() => setShowModalConfig(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                  style={{ background: 'var(--color-accent)', color: '#09090b' }}
                >
                  Conectar Agora
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 flex-1 overflow-y-auto overscroll-contain pr-1 pb-6">
              {clientesFiltrados.map(cli => {
                const isSelected = cli.id === selectedId
                const caso = TIPO_CASO_LABELS[cli.tipoCaso] ?? TIPO_CASO_LABELS.NAO_CLASSIFICADO
                const completo = cli.checklistRecebidos >= cli.checklistTotal && cli.checklistTotal > 0

                return (
                  <button
                    key={cli.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(cli.id)
                      setMobileTab('chat')
                    }}
                    className="w-full text-left p-3 rounded-xl transition-all cursor-pointer space-y-2"
                    style={{
                      background: isSelected ? 'rgba(224,159,62,0.10)' : 'var(--color-surface-overlay)',
                      border: isSelected ? '1px solid rgba(224,159,62,0.45)' : '1px solid var(--color-edge-subtle)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate leading-snug" style={{ color: 'var(--color-ink)' }}>
                          {cli.nome}
                        </p>
                        <p className="text-[11px] font-mono" style={{ color: 'var(--color-ink-faint)' }}>
                          {formatTelefone(cli.telefone)}
                        </p>
                      </div>
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--color-ink-faint)' }}>
                        {formatDataCurta(cli.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                        style={{ background: caso.bg, color: caso.color }}
                      >
                        {caso.label}
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

        {/* COLUNA 2: HISTÓRICO DE MENSAGENS, ÁUDIOS E PROVAS */}
        <div
          className={`lg:col-span-5 rounded-2xl p-4 space-y-3 flex flex-col ${
            mobileTab !== 'chat' ? 'hidden lg:flex' : 'flex'
          }`}
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
        >
          {!dossie || loadingDossie ? (
            <div className="py-20 text-center space-y-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--color-ink-muted)' }}>
                Selecione um cliente para abrir a conversa
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>
                Os áudios transcritos e fotos de documentos aparecerão nesta coluna.
              </p>
            </div>
          ) : (
            <>
              {/* Barra do Cliente Selecionado */}
              <div className="pb-3 flex items-center justify-between gap-3 border-b border-zinc-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                    style={{ background: 'rgba(224,159,62,0.15)', color: 'var(--color-accent)' }}
                  >
                    {dossie.cliente.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold truncate" style={{ color: 'var(--color-ink)' }}>
                      {dossie.cliente.nome}
                    </h3>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--color-ink-muted)' }}>
                      {formatTelefone(dossie.cliente.telefone)} · {dossie.mensagens.length} mensagens
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={copiarMensagemCobrancaFaltantes}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                    style={{
                      background: copiedCobranca ? 'rgba(74,222,128,0.15)' : 'var(--color-surface-overlay)',
                      border: copiedCobranca ? '1px solid rgba(74,222,128,0.35)' : '1px solid var(--color-edge)',
                      color: copiedCobranca ? '#4ade80' : 'var(--color-ink)',
                    }}
                    title="Copia cobrança cordial dos documentos que faltam"
                  >
                    {copiedCobranca ? <Check size={12} weight="bold" /> : <Copy size={12} />}
                    {copiedCobranca ? 'Copiado!' : 'Cobrar Docs'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMobileTab('dossie')}
                    className="lg:hidden px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    style={{ background: 'rgba(224,159,62,0.12)', color: 'var(--color-accent)' }}
                  >
                    Ver Dossiê
                    <CaretRight size={12} />
                  </button>
                </div>
              </div>

              {/* Feed de Conversa Estilo Mensageiro Moderno */}
              <div className="space-y-3 max-h-[620px] overflow-y-auto overscroll-contain pr-1">
                {dossie.mensagens.map(msg => {
                  const isAudio = msg.tipo === 'audio'
                  const isImage = msg.tipo === 'image'
                  const isDoc = msg.tipo === 'document'

                  return (
                    <div
                      key={msg.id}
                      className="p-3 rounded-2xl space-y-2 max-w-[92%] transition-all"
                      style={{
                        background: 'var(--color-surface-overlay)',
                        border: '1px solid var(--color-edge-subtle)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>
                        <span className="font-semibold flex items-center gap-1">
                          {isAudio && <Microphone size={12} weight="fill" className="text-amber-400" />}
                          {isImage && <ImageIcon size={12} weight="fill" className="text-sky-400" />}
                          {isDoc && <FileText size={12} weight="fill" className="text-emerald-400" />}
                          {isAudio ? 'Áudio de Voz' : isImage ? 'Imagem / CNH' : isDoc ? 'Documento Anexo' : 'Mensagem'}
                        </span>
                        <span>{formatHoraData(msg.enviadaEm)}</span>
                      </div>

                      {/* Texto Direto */}
                      {msg.texto && (
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-ink)' }}>
                          {msg.texto}
                        </p>
                      )}

                      {/* Player de Áudio Elegante & Minimalista */}
                      {isAudio && msg.midia && (
                        <div
                          className="p-2.5 rounded-xl space-y-2"
                          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                        >
                          <audio
                            ref={el => {
                              audioRefs.current[msg.midia!.id] = el
                            }}
                            src={urlMidiaOperacional(msg.midia.id, false)}
                            onTimeUpdate={e => {
                              const midiaId = msg.midia?.id
                              if (!midiaId) return
                              const el = e.currentTarget
                              const ct = el?.currentTime ?? 0
                              const dur = el?.duration || 1
                              const pct = Math.min(100, Math.max(0, (ct / dur) * 100))
                              setAudioProgress(prev => ({
                                ...prev,
                                [midiaId]: pct,
                              }))
                            }}
                            onLoadedMetadata={e => {
                              const midiaId = msg.midia?.id
                              if (!midiaId) return
                              const dur = e.currentTarget?.duration || 0
                              setAudioDurations(prev => ({
                                ...prev,
                                [midiaId]: dur,
                              }))
                            }}
                            onEnded={() => setPlayingAudioId(null)}
                          />

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => togglePlayAudio(msg.midia!.id)}
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95"
                              style={{ background: 'var(--color-accent)', color: '#09090b' }}
                            >
                              {playingAudioId === msg.midia.id ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
                            </button>

                            <div className="flex-1 space-y-1">
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-overlay)' }}>
                                <div
                                  className="h-full transition-all"
                                  style={{
                                    width: `${audioProgress[msg.midia.id] || 0}%`,
                                    background: 'var(--color-accent)',
                                  }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>
                                <span>{msg.midia.nomeArquivo}</span>
                                <span>
                                  {audioDurations[msg.midia.id]
                                    ? `0:${Math.floor(audioDurations[msg.midia.id]).toString().padStart(2, '0')}`
                                    : 'Voz'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Transcrição de Áudio Integrada com Accordion */}
                          <div className="pt-1 border-t border-zinc-800">
                            {msg.transcricao ? (
                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedTranscricaoId(prev => (prev === msg.id ? null : msg.id))
                                  }
                                  className="text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                  style={{ color: 'var(--color-accent)' }}
                                >
                                  <Sparkle size={11} weight="fill" />
                                  {expandedTranscricaoId === msg.id ? 'Ocultar Transcrição' : 'Ver Transcrição IA'}
                                </button>
                                {expandedTranscricaoId === msg.id && (
                                  <p className="text-xs italic mt-1.5 leading-relaxed text-zinc-300">
                                    "{msg.transcricao}"
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] italic text-zinc-500 flex items-center gap-1">
                                <Sparkle size={10} />
                                Processando transcrição em background...
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Miniatura de Imagem com Download / Abrir */}
                      {isImage && msg.midia && (
                        <div className="space-y-1.5 pt-1">
                          <a
                            href={urlMidiaOperacional(msg.midia.id, false)}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-xl border border-zinc-800 max-h-56 group relative"
                          >
                            <img
                              src={urlMidiaOperacional(msg.midia.id, false)}
                              alt={msg.midia.nomeArquivo}
                              loading="lazy"
                              className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-black/70 text-white">
                              {msg.midia.tipoDoc}
                            </div>
                          </a>
                          {msg.midia.resumoOcr && (
                            <p className="text-[11px] text-zinc-400 leading-snug">
                              <span className="text-sky-400 font-semibold">Leitura OCR:</span> {msg.midia.resumoOcr}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Documento PDF / Arquivo */}
                      {isDoc && msg.midia && (
                        <div className="p-2.5 rounded-xl flex items-center justify-between gap-2" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-ink)' }}>
                              {msg.midia.nomeArquivo}
                            </p>
                            <span className="text-[10px] text-emerald-400 font-medium">
                              Classificado como: {msg.midia.tipoDoc}
                            </span>
                          </div>
                          <a
                            href={urlMidiaOperacional(msg.midia.id, false)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded text-xs font-semibold shrink-0"
                            style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-ink)' }}
                          >
                            Abrir
                          </a>
                        </div>
                      )}

                      {/* Vínculo Inteligente com Explicação Posterior */}
                      {msg.explicacaoContextual && (
                        <p className="text-[11px] text-sky-300 bg-sky-950/30 p-2 rounded-lg border border-sky-800/30">
                          <strong>Contexto:</strong> "{msg.explicacaoContextual}"
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* COLUNA 3: DOSSIÊ EMINENTE EM 3 ABAS (Mobile/Desktop Ergonomia) */}
        <div
          className={`lg:col-span-4 rounded-2xl p-4 space-y-4 ${
            mobileTab !== 'dossie' ? 'hidden lg:block' : 'block'
          }`}
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-edge)' }}
        >
          {!dossie ? (
            <div className="py-20 text-center space-y-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--color-ink-muted)' }}>
                Dossiê Jurídico & Provas
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>
                Selecione um cliente para qualificar e gerar minutas.
              </p>
            </div>
          ) : (
            <>
              {/* Cabeçalho do Dossiê */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-1.5">
                  <FolderSimple size={16} weight="fill" style={{ color: 'var(--color-accent)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--color-ink)' }}>
                    Pasta Digital do Cliente
                  </span>
                </div>
                <button
                  type="button"
                  disabled={downloadingZip}
                  onClick={() => void handleBaixarZip()}
                  className="px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}
                  title="Baixa todos os áudios e documentos originais em .ZIP"
                >
                  <DownloadSimple size={12} weight="bold" />
                  {downloadingZip ? 'Gerando...' : 'Baixar ZIP'}
                </button>
              </div>

              {/* Seletor da Área Jurídica */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Enquadramento da Causa
                </label>
                <select
                  value={dossie.cliente.tipoCaso}
                  onChange={e => void handleChangeTipoCaso(e.target.value as TipoCasoJuridico)}
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold outline-none cursor-pointer"
                  style={{
                    background: 'var(--color-surface-overlay)',
                    border: '1px solid var(--color-edge)',
                    color: 'var(--color-ink)',
                  }}
                >
                  <option value="NAO_CLASSIFICADO">Em Triagem (Definir Área)</option>
                  <option value="RCV_BANCARIO">Direito Bancário · Empréstimo / RCV / Revisional</option>
                  <option value="ECOMMERCE_ML">Direito Digital & E-commerce · Mercado Livre</option>
                  <option value="CIVEL_CONSUMIDOR">Direito Cível & Consumidor</option>
                  <option value="TRABALHISTA">Direito Trabalhista</option>
                  <option value="TRIBUTARIO">Direito Tributário</option>
                  <option value="PENAL">Direito Penal</option>
                  <option value="GERAL">Consultivo Geral</option>
                </select>
              </div>

              {/* ABAS DO DOSSIÊ: [Cadastro] | [Checklist Provas] | [Minutas] */}
              <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}>
                <button
                  type="button"
                  onClick={() => setDossieTab('qualificacao')}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1"
                  style={{
                    background: dossieTab === 'qualificacao' ? 'var(--color-surface-overlay)' : 'transparent',
                    color: dossieTab === 'qualificacao' ? 'var(--color-accent)' : 'var(--color-ink-muted)',
                  }}
                >
                  <IdentificationCard size={13} />
                  Cadastro
                </button>
                <button
                  type="button"
                  onClick={() => setDossieTab('checklist')}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1"
                  style={{
                    background: dossieTab === 'checklist' ? 'var(--color-surface-overlay)' : 'transparent',
                    color: dossieTab === 'checklist' ? 'var(--color-accent)' : 'var(--color-ink-muted)',
                  }}
                >
                  <ListChecks size={13} />
                  Provas ({dossie.cliente.checklistRecebidos}/{dossie.cliente.checklistTotal})
                </button>
                <button
                  type="button"
                  onClick={() => setDossieTab('minutas')}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1"
                  style={{
                    background: dossieTab === 'minutas' ? 'var(--color-surface-overlay)' : 'transparent',
                    color: dossieTab === 'minutas' ? 'var(--color-accent)' : 'var(--color-ink-muted)',
                  }}
                >
                  <Scroll size={13} />
                  Minutas
                </button>
              </div>

              {/* ABA 1: QUALIFICAÇÃO CIVIL */}
              {dossieTab === 'qualificacao' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Dados Qualificação (CNH / Civil)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={extractingOcr}
                        onClick={() => void handleDispararOcr()}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer"
                        style={{ background: 'rgba(224,159,62,0.12)', color: 'var(--color-accent)' }}
                      >
                        {extractingOcr ? 'Lendo CNH...' : 'Extrair da CNH'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditQualificacao(!editQualificacao)}
                        className="text-[10px] text-zinc-400 hover:text-white cursor-pointer"
                      >
                        {editQualificacao ? 'Fechar' : 'Editar'}
                      </button>
                    </div>
                  </div>

                  {qualificacaoMsg && (
                    <p className="text-[11px] text-emerald-400 font-medium">{qualificacaoMsg}</p>
                  )}

                  {!editQualificacao ? (
                    <div className="p-3 rounded-xl space-y-2 text-xs" style={{ background: 'var(--color-surface-overlay)' }}>
                      <div>
                        <span className="text-zinc-500">Nome: </span>
                        <strong className="text-zinc-200">{dossie.cliente.nome}</strong>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-zinc-500">CPF: </span>
                          <span className="font-mono font-semibold text-emerald-400">
                            {cpfInput || 'Pendente'}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500">RG: </span>
                          <span className="font-mono text-zinc-300">{rgInput || 'Pendente'}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-zinc-500">Estado Civil: </span>
                          <span className="capitalize text-zinc-300">{estadoCivilInput}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Cidade/UF: </span>
                          <span className="text-zinc-300">{cidadeInput || 'A definir'}/{ufInput || ''}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-zinc-500">Endereço: </span>
                        <span className="text-zinc-300">{enderecoInput || 'Pendente de comprovação'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 p-3 rounded-xl" style={{ background: 'var(--color-surface-overlay)' }}>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-zinc-400">CPF</label>
                          <input
                            type="text"
                            value={cpfInput}
                            onChange={e => setCpfInput(e.target.value)}
                            placeholder="000.000.000-00"
                            className="w-full px-2 py-1 rounded text-xs font-mono outline-none"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400">RG / Órgão</label>
                          <input
                            type="text"
                            value={rgInput}
                            onChange={e => setRgInput(e.target.value)}
                            placeholder="RG e Órgão"
                            className="w-full px-2 py-1 rounded text-xs font-mono outline-none"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-zinc-400">Cidade</label>
                          <input
                            type="text"
                            value={cidadeInput}
                            onChange={e => setCidadeInput(e.target.value)}
                            className="w-full px-2 py-1 rounded text-xs outline-none"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400">UF</label>
                          <input
                            type="text"
                            maxLength={2}
                            value={ufInput}
                            onChange={e => setUfInput(e.target.value.toUpperCase())}
                            className="w-full px-2 py-1 rounded text-xs outline-none uppercase font-mono"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400">Endereço Completo</label>
                        <input
                          type="text"
                          value={enderecoInput}
                          onChange={e => setEnderecoInput(e.target.value)}
                          placeholder="Rua, número, bairro"
                          className="w-full px-2 py-1 rounded text-xs outline-none"
                          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                        />
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          disabled={savingQualificacao}
                          onClick={() => void handleSalvarQualificacao()}
                          className="px-3 py-1 rounded text-xs font-bold cursor-pointer"
                          style={{ background: 'var(--color-accent)', color: '#09090b' }}
                        >
                          {savingQualificacao ? 'Salvando...' : 'Salvar Dados'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: CHECKLIST DE PROVAS */}
              {dossieTab === 'checklist' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--color-ink)' }}>
                    <span>Documentos da Causa</span>
                    <span className="text-emerald-400">
                      {dossie.cliente.checklistRecebidos} de {dossie.cliente.checklistTotal}
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-[380px] overflow-y-auto overscroll-contain pr-1">
                    {dossie.checklist.map(item => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => void handleToggleChecklistItem(item.key, item.recebido)}
                        className="w-full text-left p-2.5 rounded-xl flex items-start gap-2.5 transition-all cursor-pointer"
                        style={{
                          background: item.recebido ? 'rgba(74,222,128,0.08)' : 'var(--color-surface-overlay)',
                          border: item.recebido ? '1px solid rgba(74,222,128,0.25)' : '1px solid var(--color-edge-subtle)',
                        }}
                      >
                        <div className="mt-0.5 shrink-0">
                          {item.recebido ? (
                            <CheckCircle size={15} weight="fill" className="text-emerald-400" />
                          ) : (
                            <WarningCircle size={15} weight="bold" className="text-amber-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold" style={{ color: item.recebido ? '#4ade80' : 'var(--color-ink)' }}>
                            {item.label}
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
                            {item.descricao}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={copiarMensagemCobrancaFaltantes}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-edge)', color: 'var(--color-ink)' }}
                  >
                    {copiedCobranca ? <Check size={13} weight="bold" /> : <Copy size={13} />}
                    {copiedCobranca ? 'Texto Copiado p/ WhatsApp!' : 'Copiar Cobrança de Faltantes'}
                  </button>
                </div>
              )}

              {/* ABA 3: MINUTAS & AÇÕES DO ESCRITÓRIO */}
              {dossieTab === 'minutas' && (
                <div className="space-y-3">
                  {/* Resumo Fático dos Áudios */}
                  <div className="p-3 rounded-xl space-y-1.5" style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-edge-subtle)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>
                      Resumo dos Fatos da Causa (IA)
                    </p>
                    <p className="text-xs leading-relaxed whitespace-pre-line text-zinc-300 max-h-36 overflow-y-auto">
                      {dossie.cliente.resumoContexto}
                    </p>
                  </div>

                  {/* Ação Primária: Emitir Kit Contratual Personalizado */}
                  <div
                    className="p-3.5 rounded-xl space-y-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(224,159,62,0.12), rgba(224,159,62,0.02))',
                      border: '1px solid rgba(224,159,62,0.35)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <FileText size={15} weight="bold" />
                        Minutas Oficiais do Escritório
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug text-zinc-400">
                      Gera Procuração Ad Judicia, Declarações e Contrato com a identidade de{' '}
                      <strong>{config?.escritorioNome ?? 'seu escritório'}</strong>, pronto para assinatura ou PDF.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!dossie) return
                        const url = urlGerarKitContratual(dossie.cliente.id)
                        window.open(url, '_blank', 'noopener,noreferrer')
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow transition-transform active:scale-95"
                      style={{ background: 'var(--color-accent)', color: '#09090b' }}
                    >
                      <ArrowSquareOut size={14} weight="bold" />
                      Emitir Minutas do Escritório
                    </button>
                  </div>

                  {/* Ação Secundária: Copiar Dossiê Completo p/ Inicial */}
                  <button
                    type="button"
                    onClick={copiarDossieParaInicial}
                    className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{
                      background: copiedDossie ? 'rgba(74,222,128,0.15)' : 'var(--color-surface-overlay)',
                      border: copiedDossie ? '1px solid rgba(74,222,128,0.35)' : '1px solid var(--color-edge)',
                      color: copiedDossie ? '#4ade80' : 'var(--color-ink)',
                    }}
                  >
                    {copiedDossie ? <Check size={14} weight="bold" /> : <UserCheck size={14} />}
                    {copiedDossie ? 'Dossiê Copiado com Sucesso!' : 'Copiar Dossiê p/ Inicial & PJe'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── MODAL CENTRAL DE CONFIGURAÇÃO META CLOUD API (Sem Poluição Operacional) ── */}
      <AnimatePresence>
        {showModalConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-edge)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              }}
            >
              <div className="p-4 px-6 flex items-center justify-between border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={20} weight="fill" style={{ color: 'var(--color-accent)' }} />
                  <h3 className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>
                    Conexão Oficial Meta WhatsApp Cloud API · {config?.escritorioNome ?? 'Escritório'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModalConfig(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto overscroll-contain">
                {/* Passo 1 & 2: Dados do Webhook p/ o Desenvolvedor / Setup */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl space-y-1.5" style={{ background: 'var(--color-surface-overlay)' }}>
                    <span className="text-[10px] font-bold uppercase text-zinc-400">URL do Webhook (Callback)</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={webhookCallbackUrl}
                        className="w-full px-2 py-1 rounded text-[11px] font-mono outline-none"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(webhookCallbackUrl)
                          setCopiedWebhookUrl(true)
                          setTimeout(() => setCopiedWebhookUrl(false), 2000)
                        }}
                        className="p-1.5 rounded cursor-pointer shrink-0 text-amber-400"
                      >
                        {copiedWebhookUrl ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl space-y-1.5" style={{ background: 'var(--color-surface-overlay)' }}>
                    <span className="text-[10px] font-bold uppercase text-zinc-400">Token de Verificação (Verify)</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={verifyTokenValue}
                        className="w-full px-2 py-1 rounded text-[11px] font-mono outline-none"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(verifyTokenValue)
                          setCopiedVerifyToken(true)
                          setTimeout(() => setCopiedVerifyToken(false), 2000)
                        }}
                        className="p-1.5 rounded cursor-pointer shrink-0 text-amber-400"
                      >
                        {copiedVerifyToken ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Formulário de Ativação do Escritório (BYON) */}
                <form onSubmit={e => void handleSalvarConfig(e)} className="p-4 rounded-xl space-y-3" style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-edge-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold" style={{ color: 'var(--color-ink)' }}>
                      Credenciais da Conta do Escritório
                    </h4>
                    <span className="text-[10px] text-zinc-400">
                      Criptografia de ponta a ponta (AES-256-GCM)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-400">WABA ID (Conta WhatsApp Business)</label>
                      <input
                        type="text"
                        placeholder="Ex: 2346185095786771"
                        value={wabaIdInput}
                        onChange={e => setWabaIdInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono outline-none"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-400">Phone Number ID (ID do Telefone)</label>
                      <input
                        type="text"
                        placeholder="Ex: 1461573947028881"
                        value={phoneIdInput}
                        onChange={e => setPhoneIdInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono outline-none"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400">Número WhatsApp com DDI/DDD</label>
                    <input
                      type="text"
                      placeholder="Ex: 5543996034632"
                      value={displayPhoneInput}
                      onChange={e => setDisplayPhoneInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono outline-none"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400 flex items-center justify-between">
                      <span>Token Permanente da Meta (System User Token)</span>
                      {config?.tokenConfiguradoNoServidor && (
                        <span className="text-[10px] text-emerald-400 font-semibold">Token Ativo no Servidor</span>
                      )}
                    </label>
                    <input
                      type="password"
                      placeholder={config?.tokenConfiguradoNoServidor ? '•••••••••••••••••••••••• (Criptografado)' : 'Cole o Token permanente da Meta (EAAG...)'}
                      value={accessTokenInput}
                      onChange={e => setAccessTokenInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono outline-none"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-edge)' }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {configSavedMsg ? (
                      <span className="text-xs font-semibold text-emerald-400">{configSavedMsg}</span>
                    ) : <span />}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowModalConfig(false)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer text-zinc-400 hover:text-white"
                      >
                        Fechar
                      </button>
                      <button
                        type="submit"
                        disabled={savingConfig}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                        style={{ background: 'var(--color-accent)', color: '#09090b' }}
                      >
                        {savingConfig ? 'Validando...' : 'Salvar Conexão'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

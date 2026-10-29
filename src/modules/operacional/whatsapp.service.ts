import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { buildZipBuffer, type ZipEntryInput } from '../djen/application/zip-builder';
import { decryptValue, encryptValue, phoneHmac } from './whatsapp.crypto';
import { gerarHtmlKitContratualAso } from './documento-contratual.service';
import { extrairDadosDocumento } from './extracao-documental.service';

type JsonRecord = Record<string, unknown>;

export interface WhatsAppSecrets {
  encryptionKey?: Buffer;
  phoneHashKey?: Buffer;
}

export type TipoCasoJuridico =
  | 'NAO_CLASSIFICADO'
  | 'RCV_BANCARIO'
  | 'ECOMMERCE_ML'
  | 'CIVEL_CONSUMIDOR'
  | 'TRIBUTARIO'
  | 'TRABALHISTA'
  | 'PENAL'
  | 'GERAL';

export interface ChecklistTemplateItem {
  key: string;
  label: string;
  obrigatorio: boolean;
  descricao: string;
}

export const CHECKLIST_TEMPLATES: Record<TipoCasoJuridico, ChecklistTemplateItem[]> = {
  NAO_CLASSIFICADO: [
    {
      key: 'DOC_IDENTIDADE',
      label: 'RG ou CNH do Cliente',
      obrigatorio: true,
      descricao: 'Documento oficial com foto para qualificação básica inicial'
    },
    {
      key: 'COMPROVANTE_ENDERECO',
      label: 'Comprovante de Endereço Atualizado',
      obrigatorio: true,
      descricao: 'Conta de consumo (luz, água, internet) dos últimos 90 dias'
    },
    {
      key: 'PROVAS_INICIAIS',
      label: 'Documentos / Prints Relacionados ao Caso',
      obrigatorio: false,
      descricao: 'Contratos, conversas, comprovantes ou notificações recebidas'
    }
  ],
  RCV_BANCARIO: [
    {
      key: 'DOC_IDENTIDADE',
      label: 'RG ou CNH do Titular / Financiado',
      obrigatorio: true,
      descricao: 'Documento de identificação com CPF'
    },
    {
      key: 'COMPROVANTE_ENDERECO',
      label: 'Comprovante de Residência',
      obrigatorio: true,
      descricao: 'Comprovante em nome do autor para definição de competência'
    },
    {
      key: 'CONTRATO_FINANCIAMENTO',
      label: 'Contrato do Empréstimo / Financiamento (CCB)',
      obrigatorio: true,
      descricao: 'Cópia do contrato bancário com taxas de juros, CET e tarifas embutidas'
    },
    {
      key: 'EXTRATO_PARCELAS',
      label: 'Extrato do Empréstimo / Carnê de Parcelas ou CRLV',
      obrigatorio: true,
      descricao: 'Demonstrativo de evolução da dívida, descontos ou documento do bem'
    }
  ],
  ECOMMERCE_ML: [
    {
      key: 'DOC_IDENTIDADE',
      label: 'RG ou CNH do Titular / Sócio',
      obrigatorio: true,
      descricao: 'Documento oficial com foto para qualificação na inicial'
    },
    {
      key: 'COMPROVANTE_ENDERECO',
      label: 'Comprovante de Endereço Atualizado',
      obrigatorio: true,
      descricao: 'Conta de consumo (água, luz, internet) dos últimos 90 dias'
    },
    {
      key: 'PRINTS_PLATAFORMA_ML',
      label: 'Prints da Reclamação / Mediação na Plataforma',
      obrigatorio: true,
      descricao: 'Telas da venda, mensagens do comprador e encerramento da mediação'
    },
    {
      key: 'COMPROVANTE_ENVIO_PESO',
      label: 'Comprovante de Postagem / Peso nos Correios ou Coleta',
      obrigatorio: true,
      descricao: 'Recibo de postagem ou etiqueta demonstrando o peso real enviado'
    },
    {
      key: 'EXTRATO_RETENCAO_CONTA',
      label: 'Extrato do Mercado Pago (Valor Retido / Estornado)',
      obrigatorio: false,
      descricao: 'Demonstrativo do débito ou bloqueio indevido na conta do vendedor'
    }
  ],
  CIVEL_CONSUMIDOR: [
    {
      key: 'DOC_IDENTIDADE',
      label: 'RG ou CNH',
      obrigatorio: true,
      descricao: 'Documento de identificação civil'
    },
    {
      key: 'COMPROVANTE_ENDERECO',
      label: 'Comprovante de Endereço',
      obrigatorio: true,
      descricao: 'Comprovante atualizado (últimos 90 dias)'
    },
    {
      key: 'NOTA_FISCAL_OU_CONTRATO',
      label: 'Nota Fiscal, Fatura ou Contrato de Prestação',
      obrigatorio: true,
      descricao: 'Prova da relação jurídica / consumo'
    },
    {
      key: 'PROTOCOLOS_E_PRINTS',
      label: 'Protocolos de Atendimento / Prints da Falha ou Negativação',
      obrigatorio: true,
      descricao: 'Registros de tentativa de solução ou comprovante do dano'
    }
  ],
  TRIBUTARIO: [
    {
      key: 'DOC_IDENTIDADE',
      label: 'RG/CNH do Contribuinte ou Contrato Social (PJ)',
      obrigatorio: true,
      descricao: 'Qualificação do contribuinte ou ato constitutivo da empresa'
    },
    {
      key: 'COMPROVANTE_ENDERECO',
      label: 'Comprovante de Endereço / Cartão CNPJ',
      obrigatorio: true,
      descricao: 'Comprovante fiscal de domicílio'
    },
    {
      key: 'CDA_OU_AUTO_INFRACAO',
      label: 'Certidão de Dívida Ativa (CDA) / Notificação Fiscal / DARF',
      obrigatorio: true,
      descricao: 'Espelho do débito tributário, execução fiscal ou guias recolhidas'
    }
  ],
  TRABALHISTA: [
    {
      key: 'DOC_IDENTIDADE',
      label: 'RG, CNH e CTPS (Carteira de Trabalho Digital)',
      obrigatorio: true,
      descricao: 'Identificação e registros de contrato de trabalho'
    },
    {
      key: 'COMPROVANTE_ENDERECO',
      label: 'Comprovante de Residência',
      obrigatorio: true,
      descricao: 'Comprovante atualizado'
    },
    {
      key: 'TRCT_HOLERITES_FGTS',
      label: 'Termo de Rescisão (TRCT), Holerites e Extrato Analítico FGTS',
      obrigatorio: true,
      descricao: 'Documentos salariais e rescisórios para cálculo trabalhista'
    }
  ],
  PENAL: [
    {
      key: 'DOC_IDENTIDADE',
      label: 'RG ou CNH do Constituinte',
      obrigatorio: true,
      descricao: 'Documento oficial com foto'
    },
    {
      key: 'COMPROVANTE_ENDERECO',
      label: 'Comprovante de Residência Fixa e Ocupação Lícita',
      obrigatorio: true,
      descricao: 'Essencial para pedidos de liberdade / resposta à acusação'
    },
    {
      key: 'BOLETIM_OCORRENCIA_INQUERITO',
      label: 'Boletim de Ocorrência, Intimação Policial ou Autos do Inquérito',
      obrigatorio: true,
      descricao: 'Cópia da peça policial ou mandado recebido'
    }
  ],
  GERAL: [
    {
      key: 'DOC_IDENTIDADE',
      label: 'Documento de Identidade (RG/CNH)',
      obrigatorio: true,
      descricao: 'Identificação civil do cliente'
    },
    {
      key: 'COMPROVANTE_ENDERECO',
      label: 'Comprovante de Endereço',
      obrigatorio: true,
      descricao: 'Comprovante atualizado'
    },
    {
      key: 'PROVAS_DOCUMENTAIS',
      label: 'Provas Documentais / Prints do Caso',
      obrigatorio: true,
      descricao: 'Documentos e registros enviados pelo WhatsApp'
    }
  ]
};

interface IncomingMessage {
  id: string;
  phone: string;
  type: string;
  timestamp: Date;
  rawObject: JsonRecord;
  textBody?: string;
  transcriptionText?: string;
  encryptedContent: ReturnType<typeof encryptValue>;
  encryptedName?: ReturnType<typeof encryptValue>;
  encryptedTranscription?: ReturnType<typeof encryptValue>;
  media?: {
    type: string;
    mediaId: string;
    mimeType?: string;
    filename?: string;
    caption?: string;
    classifiedDocType: string;
    encryptedFilename?: ReturnType<typeof encryptValue>;
  };
  adId?: string;
  ctwaClid?: string;
  phoneNumberId?: string;
}


export interface QualificacaoCadastral {
  cpf: string | null;
  rg: string | null;
  orgaoEmissor: string | null;
  nacionalidade: string | null;
  estadoCivil: string | null;
  profissao: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  dadosQualificacao: Record<string, any>;
}

export interface ClienteTriagemResumo {
  id: string;
  nome: string;
  telefone: string;
  origem: 'LEAD' | 'ANTIGO' | 'NOVO';
  tipoCaso: TipoCasoJuridico;
  status: 'INCOMPLETO' | 'PRONTO_PROCURACAO' | 'COMPLETO';
  checklistRecebidos: number;
  checklistTotal: number;
  faltando: string[];
  resumoContexto: string;
  totalMensagens: number;
  totalDocumentos: number;
  qualificacao: QualificacaoCadastral;
  updatedAt: string;
}

export interface MensagemDossie {
  id: string;
  whatsappMessageId: string;
  direcao: 'ENTRADA' | 'SAIDA';
  tipo: 'text' | 'audio' | 'image' | 'document' | 'video' | 'sticker' | 'outro';
  enviadaEm: string;
  texto: string;
  transcricao?: string;
  transcricaoEstado?: string;
  explicacaoContextual?: string;
  midia?: {
    id: string;
    tipoDoc: string;
    mediaKind: string;
    mimeType: string | null;
    nomeArquivo: string;
    estado: string;
    caminhoLocal?: string | null;
    resumoOcr?: string | null;
  };
}

export interface DossieClienteCompleto {
  cliente: ClienteTriagemResumo;
  pastaFisicaRelativa: string;
  checklist: Array<
    ChecklistTemplateItem & {
      recebido: boolean;
      evidencia?: string;
    }
  >;
  mensagens: MensagemDossie[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function encryptedColumns(_prefix: string, value: ReturnType<typeof encryptValue> | undefined) {
  return value ? [value.ciphertext, value.nonce, value.tag] : [null, null, null];
}

function classifyDocumentFromText(filename?: string, caption?: string): string {
  const combined = `${filename ?? ''} ${caption ?? ''}`.toLowerCase();
  if (combined.includes('cnh') || combined.includes('habilitacao') || combined.includes('habilitação')) {
    return 'CNH';
  }
  if (combined.includes('rg') || combined.includes('identidade')) {
    return 'RG';
  }
  if (combined.includes('cpf')) {
    return 'CPF';
  }
  if (
    combined.includes('endereco') ||
    combined.includes('endereço') ||
    combined.includes('copel') ||
    combined.includes('sanepar') ||
    combined.includes('fatura') ||
    combined.includes('residencia') ||
    combined.includes('conta de luz')
  ) {
    return 'COMPROVANTE_ENDERECO';
  }
  if (combined.includes('contrato') || combined.includes('ccb') || combined.includes('financiamento') || combined.includes('empréstimo')) {
    return 'CONTRATO';
  }
  if (combined.includes('procuracao') || combined.includes('procuração')) {
    return 'PROCURACAO';
  }
  return 'DOCUMENTO_COMPROBATORIO';
}

const VALID_TIPOS_CASO: TipoCasoJuridico[] = [
  'NAO_CLASSIFICADO',
  'RCV_BANCARIO',
  'ECOMMERCE_ML',
  'CIVEL_CONSUMIDOR',
  'TRIBUTARIO',
  'TRABALHISTA',
  'PENAL',
  'GERAL'
];

function normalizeTipoCaso(value: unknown): TipoCasoJuridico {
  if (typeof value === 'string' && VALID_TIPOS_CASO.includes(value as TipoCasoJuridico)) {
    return value as TipoCasoJuridico;
  }
  return 'NAO_CLASSIFICADO';
}

function autoEvaluateChecklist(
  tipoCaso: TipoCasoJuridico,
  currentChecklist: Record<string, boolean>,
  allText: string,
  docTypes: string[]
): Record<string, boolean> {
  const next = { ...currentChecklist };
  const lower = allText.toLowerCase();

  if (
    docTypes.includes('CNH') ||
    docTypes.includes('RG') ||
    docTypes.includes('CPF') ||
    lower.includes('cnh') ||
    lower.includes('rg') ||
    lower.includes('identidade')
  ) {
    next.DOC_IDENTIDADE = true;
  }
  if (
    docTypes.includes('COMPROVANTE_ENDERECO') ||
    lower.includes('comprovante de endereço') ||
    lower.includes('comprovante de residencia') ||
    lower.includes('conta de luz') ||
    lower.includes('copel') ||
    lower.includes('sanepar')
  ) {
    next.COMPROVANTE_ENDERECO = true;
  }

  if (tipoCaso === 'ECOMMERCE_ML') {
    if (
      docTypes.includes('DOCUMENTO_COMPROBATORIO') ||
      lower.includes('print') ||
      lower.includes('reclamação') ||
      lower.includes('mediação')
    ) {
      next.PRINTS_PLATAFORMA_ML = true;
    }
    if (lower.includes('peso') || lower.includes('correios') || lower.includes('postagem') || lower.includes('etiqueta')) {
      next.COMPROVANTE_ENVIO_PESO = true;
    }
    if (lower.includes('mercado pago') || lower.includes('retido') || lower.includes('estorno')) {
      next.EXTRATO_RETENCAO_CONTA = true;
    }
  } else if (tipoCaso === 'RCV_BANCARIO') {
    if (docTypes.includes('CONTRATO') || lower.includes('contrato') || lower.includes('ccb')) {
      next.CONTRATO_FINANCIAMENTO = true;
    }
    if (lower.includes('extrato') || lower.includes('carnê') || lower.includes('parcela') || lower.includes('crlv')) {
      next.EXTRATO_PARCELAS = true;
    }
  } else if (tipoCaso === 'NAO_CLASSIFICADO') {
    if (docTypes.length > 0) {
      next.PROVAS_INICIAIS = true;
    }
  }

  return next;
}

/** Processa eventos recebidos, baixa mídias reais na pasta do cliente e transcreve áudios com IA. */
export class WhatsAppWebhookService {
  private readonly storageRoot = join(process.cwd(), 'storage', 'clientes');
  private readonly processingClients = new Set<string>();

  constructor(
    private readonly pool: Pool,
    private readonly secrets: WhatsAppSecrets
  ) {
    if (!existsSync(this.storageRoot)) {
      mkdirSync(this.storageRoot, { recursive: true });
    }
  }

  private ensureKeys(): { encryptionKey: Buffer; phoneHashKey: Buffer } {
    const encryptionKey = this.secrets.encryptionKey;
    const phoneHashKey = this.secrets.phoneHashKey;
    if (!encryptionKey || !phoneHashKey) {
      throw new Error('CONFIGURACAO_DE_CIFRAGEM_AUSENTE');
    }
    return { encryptionKey, phoneHashKey };
  }

  private safeDecryptText(ciphertext?: Buffer | null, nonce?: Buffer | null, tag?: Buffer | null): string | null {
    if (!ciphertext || !nonce || !tag || !this.secrets?.encryptionKey) return null;
    try {
      return decryptValue({ ciphertext, nonce, tag }, this.secrets.encryptionKey).toString('utf8');
    } catch {
      return null;
    }
  }

  async receberWebhook(rawBody: Buffer): Promise<{ mensagens: number; duplicado: boolean }> {
    const { encryptionKey, phoneHashKey } = this.ensureKeys();

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new Error('JSON_INVALIDO');
    }
    if (!isRecord(payload)) throw new Error('PAYLOAD_INVALIDO');

    const { messages, phoneNumberId } = this.extrairMensagens(payload, encryptionKey);
    const eventHash = createHash('sha256').update(rawBody).digest('hex');
    const encryptedEvent = encryptValue(rawBody, encryptionKey);
    const client = await this.pool.connect();
    const touchedClients = new Set<string>();

    try {
      await client.query('BEGIN');

      let escritorioId: string | null = null;
      if (phoneNumberId) {
        const tenantMatch = await client.query(
          `SELECT id FROM escritorios WHERE whatsapp_phone_number_id = $1 LIMIT 1`,
          [phoneNumberId]
        );
        if (tenantMatch.rows.length > 0) {
          escritorioId = tenantMatch.rows[0].id as string;
        }
      }
      if (!escritorioId) {
        const defaultTenant = await client.query(`SELECT id FROM escritorios ORDER BY created_at ASC LIMIT 1`);
        if (defaultTenant.rows.length > 0) {
          escritorioId = defaultTenant.rows[0].id as string;
        }
      }

      const eventInsert = await client.query(
        `INSERT INTO operacional.webhook_eventos (
          sha256_corpo, payload_cifrado, payload_nonce, payload_tag, assinatura_validada,
          escritorio_id, phone_number_id
        ) VALUES ($1, $2, $3, $4, TRUE, $5, $6)
        ON CONFLICT (sha256_corpo) DO NOTHING
        RETURNING id`,
        [
          eventHash,
          encryptedEvent.ciphertext,
          encryptedEvent.nonce,
          encryptedEvent.tag,
          escritorioId,
          phoneNumberId ?? null
        ]
      );

      if (eventInsert.rows.length === 0) {
        await client.query('COMMIT');
        return { mensagens: 0, duplicado: true };
      }

      const eventId = eventInsert.rows[0].id as string;
      let persistedMessages = 0;

      for (const message of messages) {
        const phone = phoneHmac(message.phone, phoneHashKey);
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [phone.hash]);

        const contact = await client.query(
          `SELECT cliente_id FROM operacional.cliente_telefones
           WHERE telefone_hmac = $1 FOR UPDATE`,
          [phone.hash]
        );

        let clientId: string;
        let source: 'LEAD' | 'ANTIGO' | 'NOVO';
        if (contact.rows.length > 0) {
          clientId = contact.rows[0].cliente_id as string;
          source = message.adId || message.ctwaClid ? 'LEAD' : 'ANTIGO';
          if (escritorioId) {
            await client.query(
              `UPDATE operacional.clientes
               SET escritorio_id = COALESCE(escritorio_id, $2),
                   updated_at = clock_timestamp()
               WHERE id = $1`,
              [clientId, escritorioId]
            );
          }
        } else {
          source = message.adId || message.ctwaClid ? 'LEAD' : 'NOVO';
          const clientName = message.encryptedName;
          const clientInsert = await client.query(
            `INSERT INTO operacional.clientes (
              nome_cifrado, nome_nonce, nome_tag, origem, primeiro_ad_id, primeiro_ctwa_clid,
              escritorio_id, tipo_caso
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'NAO_CLASSIFICADO')
            RETURNING id`,
            [
              ...encryptedColumns('nome', clientName),
              source,
              message.adId ?? null,
              message.ctwaClid ?? null,
              escritorioId
            ]
          );
          clientId = clientInsert.rows[0].id as string;
          await client.query(
            `INSERT INTO operacional.cliente_telefones (
              cliente_id, telefone_hmac, telefone_cifrado, telefone_nonce, telefone_tag
            ) VALUES ($1, $2, $3, $4, $5)`,
            [clientId, phone.hash, ...encryptedColumns('telefone', encryptValue(phone.normalized, encryptionKey))]
          );
        }

        const transcricaoEstado = message.encryptedTranscription
          ? 'PRONTA'
          : message.type === 'audio'
          ? 'PENDENTE'
          : 'NAO_APLICAVEL';

        const messageInsert = await client.query(
          `INSERT INTO operacional.mensagens (
            whatsapp_message_id, webhook_evento_id, cliente_id, telefone_hmac,
            tipo, origem, ad_id, ctwa_clid, enviada_em,
            conteudo_cifrado, conteudo_nonce, conteudo_tag,
            transcricao_cifrada, transcricao_nonce, transcricao_tag, transcricao_estado
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (whatsapp_message_id) DO NOTHING
          RETURNING id`,
          [
            message.id,
            eventId,
            clientId,
            phone.hash,
            message.type,
            source,
            message.adId ?? null,
            message.ctwaClid ?? null,
            message.timestamp,
            message.encryptedContent.ciphertext,
            message.encryptedContent.nonce,
            message.encryptedContent.tag,
            ...encryptedColumns('transcricao', message.encryptedTranscription),
            transcricaoEstado
          ]
        );

        if (messageInsert.rows.length === 0) continue;
        persistedMessages++;
        touchedClients.add(clientId);

        if (message.media) {
          const encryptedMediaId = encryptValue(message.media.mediaId, encryptionKey);
          const encryptedFilename = message.media.encryptedFilename;
          await client.query(
            `INSERT INTO operacional.documentos (
              cliente_id, mensagem_id, media_kind, tipo_doc, mime_type,
              media_id_cifrado, media_id_nonce, media_id_tag,
              nome_original_cifrado, nome_original_nonce, nome_original_tag,
              estado, classificado_por
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDENTE_DOWNLOAD', 'REVISAO_PENDENTE')`,
            [
              clientId,
              messageInsert.rows[0].id,
              message.media.type.toUpperCase(),
              message.media.classifiedDocType,
              message.media.mimeType ?? null,
              encryptedMediaId.ciphertext,
              encryptedMediaId.nonce,
              encryptedMediaId.tag,
              ...encryptedColumns('nome_original', encryptedFilename)
            ]
          );
        }
      }

      for (const clientId of touchedClients) {
        await this.recalcularDossieTransacional(client, clientId, encryptionKey);
      }

      await client.query(
        `UPDATE operacional.webhook_eventos
         SET status = 'COMPLETO', processado_em = clock_timestamp()
         WHERE id = $1`,
        [eventId]
      );
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Falha ao reverter evento WhatsApp:', rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }

    // Dispara em background imediato o download na pasta física e a transcrição/OCR das mídias recebidas
    for (const clientId of touchedClients) {
      void this.processarMidiasPendentesCliente(clientId).catch(err => {
        console.error(`Erro no processamento assíncrono de mídia do cliente ${clientId}:`, err);
      });
    }

    return { mensagens: messages.length, duplicado: false };
  }

  /**
   * Resolve o token de acesso da Meta de forma multi-tenant dinâmica (BYON):
   * 1. Token criptografado armazenado no escritório do cliente
   * 2. Fallback para token do Escritório Master da plataforma
   * 3. Fallback final para variável de ambiente .env
   */
  async obterTokenAcessoTenant(escritorioId?: string | null): Promise<string | null> {
    if (escritorioId) {
      const res = await this.pool.query(
        `SELECT whatsapp_access_token_cifrado, whatsapp_access_token_nonce, whatsapp_access_token_tag
         FROM escritorios
         WHERE id = $1`,
        [escritorioId]
      );
      if (res.rows.length > 0 && res.rows[0].whatsapp_access_token_cifrado) {
        const row = res.rows[0];
        const dec = this.safeDecryptText(
          row.whatsapp_access_token_cifrado,
          row.whatsapp_access_token_nonce,
          row.whatsapp_access_token_tag
        );
        if (dec && dec.trim()) return dec.trim();
      }
    }

    const masterRes = await this.pool.query(
      `SELECT whatsapp_access_token_cifrado, whatsapp_access_token_nonce, whatsapp_access_token_tag
       FROM escritorios
       WHERE plano = 'MASTER' OR slug = 'ghfs-master'
       LIMIT 1`
    );
    if (masterRes.rows.length > 0 && masterRes.rows[0].whatsapp_access_token_cifrado) {
      const row = masterRes.rows[0];
      const dec = this.safeDecryptText(
        row.whatsapp_access_token_cifrado,
        row.whatsapp_access_token_nonce,
        row.whatsapp_access_token_tag
      );
      if (dec && dec.trim()) return dec.trim();
    }

    return process.env.WHATSAPP_ACCESS_TOKEN?.trim() || null;
  }

  /**
   * Baixa os arquivos reais da Graph API da Meta para storage/clientes/{clienteId}/,
   * transcreve os áudios em português usando Gemini 3.8 Flash e analisa imagens/documentos.
   */
  async processarMidiasPendentesCliente(clienteId: string): Promise<{ processados: number }> {
    if (this.processingClients.has(clienteId)) {
      return { processados: 0 };
    }
    this.processingClients.add(clienteId);

    try {
      const { encryptionKey } = this.ensureKeys();

      // Obtém o escritório do cliente para resolver o token BYON correspondente
      const clienteRes = await this.pool.query<{ escritorio_id: string | null }>(
        `SELECT escritorio_id FROM operacional.clientes WHERE id = $1`,
        [clienteId]
      );
      const clienteEscritorioId = clienteRes.rows[0]?.escritorio_id ?? null;

      const accessToken = await this.obterTokenAcessoTenant(clienteEscritorioId);
      if (!accessToken) {
        console.warn(`[WhatsApp Media] Nenhum token de acesso encontrado para o cliente ${clienteId} ou tenant.`);
        return { processados: 0 };
      }

      const pendentes = await this.pool.query(
        `SELECT
          d.id AS doc_id,
          d.mensagem_id,
          d.media_kind,
          d.mime_type,
          d.caminho_local,
          d.texto_ocr_cifrado,
          d.media_id_cifrado, d.media_id_nonce, d.media_id_tag,
          d.nome_original_cifrado, d.nome_original_nonce, d.nome_original_tag,
          m.transcricao_estado,
          m.enviada_em
         FROM operacional.documentos d
         JOIN operacional.mensagens m ON m.id = d.mensagem_id
         WHERE d.cliente_id = $1
           AND (
             d.caminho_local IS NULL
             OR (d.media_kind = 'AUDIO' AND m.transcricao_estado != 'PRONTA')
             OR (d.media_kind IN ('IMAGE', 'DOCUMENT') AND d.texto_ocr_cifrado IS NULL)
           )
         ORDER BY m.enviada_em ASC`,
        [clienteId]
      );

      if (pendentes.rows.length === 0) return { processados: 0 };

      const clientFolder = join(this.storageRoot, clienteId);
      if (!existsSync(clientFolder)) {
        mkdirSync(clientFolder, { recursive: true });
      }

      let processados = 0;

      for (const row of pendentes.rows) {
        const mediaId = this.safeDecryptText(row.media_id_cifrado, row.media_id_nonce, row.media_id_tag);
        if (!mediaId) continue;

        let fileBuffer: Buffer | null = null;
        let localPath: string | null = row.caminho_local ?? null;
        let mimeType: string = String(row.mime_type || 'application/octet-stream').split(';')[0]!.trim();

        if (localPath && existsSync(localPath)) {
          fileBuffer = readFileSync(localPath);
        } else {
          // 1. Consulta URL de download na Graph API da Meta
          let metaInfoRes: Response;
          try {
            metaInfoRes = await fetch(`https://graph.facebook.com/v25.0/${mediaId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(15000)
            });
          } catch (netErr) {
            console.warn(`[WhatsApp Media] Timeout ou erro de rede ao consultar mediaId ${mediaId}:`, (netErr as Error).message);
            continue;
          }

          if (!metaInfoRes.ok) {
            const errText = await metaInfoRes.text();
            console.warn(`[WhatsApp Media] Erro da Meta ao consultar mediaId ${mediaId} (${metaInfoRes.status}):`, errText);

            if (metaInfoRes.status === 401 || metaInfoRes.status === 403) {
              await this.pool.query(
                `UPDATE operacional.documentos SET estado = 'ERRO', erro_codigo = 'TOKEN_META_EXPIRADO' WHERE id = $1`,
                [row.doc_id]
              );
              if (row.media_kind === 'AUDIO') {
                await this.pool.query(
                  `UPDATE operacional.mensagens SET transcricao_estado = 'ERRO_TOKEN_META' WHERE id = $1`,
                  [row.mensagem_id]
                );
              }
            }
            continue;
          }

          const metaInfo = (await metaInfoRes.json()) as { url?: string; mime_type?: string };
          if (!metaInfo.url) {
            console.warn(`[WhatsApp Media] URL não informada pela Meta para mediaId ${mediaId}`);
            continue;
          }
          if (metaInfo.mime_type) {
            mimeType = metaInfo.mime_type.split(';')[0]!.trim();
          }

          // 2. Baixa os bytes reais do arquivo (áudio, imagem ou PDF)
          let binRes: Response;
          try {
            binRes = await fetch(metaInfo.url, {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(30000)
            });
          } catch (netErr) {
            console.warn(`[WhatsApp Media] Timeout ao baixar bytes de mediaId ${mediaId}:`, (netErr as Error).message);
            continue;
          }

          if (!binRes.ok) {
            console.warn(`[WhatsApp Media] Falha ao baixar bytes da URL da Meta (${binRes.status})`);
            continue;
          }
          fileBuffer = Buffer.from(await binRes.arrayBuffer());

          const originalName = this.safeDecryptText(
            row.nome_original_cifrado,
            row.nome_original_nonce,
            row.nome_original_tag
          );
          const ext =
            mimeType.includes('ogg') || row.media_kind === 'AUDIO'
              ? 'ogg'
              : mimeType.includes('jpeg') || mimeType.includes('jpg')
              ? 'jpg'
              : mimeType.includes('png')
              ? 'png'
              : mimeType.includes('pdf')
              ? 'pdf'
              : 'bin';

          const dateTag = new Date(row.enviada_em).toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const baseName = originalName
            ? originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
            : `${row.media_kind}_${dateTag}_${String(row.doc_id).slice(0, 6)}.${ext}`;

          localPath = join(clientFolder, baseName);
          writeFileSync(localPath, fileBuffer);

          const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
          const encryptedFileName = encryptValue(baseName, encryptionKey);

          await this.pool.query(
            `UPDATE operacional.documentos
             SET caminho_local = $2,
                 sha256_arquivo = $3,
                 estado = 'PRONTO',
                 nome_original_cifrado = COALESCE(nome_original_cifrado, $4),
                 nome_original_nonce = COALESCE(nome_original_nonce, $5),
                 nome_original_tag = COALESCE(nome_original_tag, $6)
             WHERE id = $1`,
            [
              row.doc_id,
              localPath,
              sha256,
              encryptedFileName.ciphertext,
              encryptedFileName.nonce,
              encryptedFileName.tag
            ]
          );
        }

        if (!fileBuffer) continue;

        // 3. Se for ÁUDIO, transcreve o conteúdo falado com Gemini 3.8 Flash
        if (row.media_kind === 'AUDIO' && row.transcricao_estado !== 'PRONTA') {
          const transcricao = await this.transcreverAudioComIA(fileBuffer, mimeType || 'audio/ogg');
          if (transcricao) {
            const encTransc = encryptValue(transcricao, encryptionKey);
            await this.pool.query(
              `UPDATE operacional.mensagens
               SET transcricao_cifrada = $2,
                   transcricao_nonce = $3,
                   transcricao_tag = $4,
                   transcricao_estado = 'PRONTA'
               WHERE id = $1`,
              [row.mensagem_id, encTransc.ciphertext, encTransc.nonce, encTransc.tag]
            );
          }
        }

        // 4. Se for IMAGEM ou PDF, analisa visualmente com IA para identificar o documento
        if ((row.media_kind === 'IMAGE' || row.media_kind === 'DOCUMENT') && !row.texto_ocr_cifrado) {
          const analise = await this.analisarDocumentoOuImagemComIA(fileBuffer, mimeType);
          if (analise) {
            const encOcr = encryptValue(analise.descricaoCurta, encryptionKey);
            await this.pool.query(
              `UPDATE operacional.documentos
               SET tipo_doc = $2,
                   texto_ocr_cifrado = $3,
                   texto_ocr_nonce = $4,
                   texto_ocr_tag = $5,
                   classificado_por = 'REGRA'
               WHERE id = $1`,
              [row.doc_id, analise.tipoDoc, encOcr.ciphertext, encOcr.nonce, encOcr.tag]
            );
          }
        }

        processados++;
      }

      // Recalcula o dossiê com as novas transcrições e documentos identificados
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await this.recalcularDossieTransacional(client, clienteId, encryptionKey);
        await client.query('COMMIT');
      } catch {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      return { processados };
    } finally {
      this.processingClients.delete(clienteId);
    }
  }

  private async transcreverAudioComIA(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return null;

    const base64Audio = audioBuffer.toString('base64');
    const cleanMime = mimeType.startsWith('audio/') ? mimeType : 'audio/ogg';

    // Roteador de Alta Disponibilidade: cadeia de modelos para garantir >= 99% uptime
    const modelos = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];

    for (const modelo of modelos) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: 'Transcreva fielmente em português o áudio enviado pelo cliente ao escritório de advocacia. Retorne apenas o texto falado, sem comentários adicionais.'
                    },
                    {
                      inline_data: {
                        mime_type: cleanMime,
                        data: base64Audio
                      }
                    }
                  ]
                }
              ]
            })
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[Transcrição Audio] Modelo ${modelo} retornou ${response.status}:`, errText);
          continue;
        }

        const data = (await response.json()) as any;
        const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
        const textPart = parts.find(p => !p?.thought && typeof p?.text === 'string') || parts[0];
        const text = textPart?.text;
        if (typeof text === 'string' && text.trim().length > 0) {
          return text.trim();
        }
      } catch (err) {
        console.warn(`[Transcrição Audio] Falha com modelo ${modelo}:`, (err as Error).message);
      }
    }

    return null;
  }

  private async analisarDocumentoOuImagemComIA(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{ tipoDoc: string; descricaoCurta: string } | null> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return null;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            generationConfig: {
              responseMimeType: 'application/json'
            },
            contents: [
              {
                parts: [
                  {
                    text: 'Analise esta imagem ou documento enviado por um cliente a um escritório de advocacia. Responda em JSON com os campos: "tipoDoc" (escolha estritamente um entre: "RG", "CPF", "CNH", "COMPROVANTE_ENDERECO", "CONTRATO", "PROCURACAO", "DOCUMENTO_COMPROBATORIO", "OUTRO") e "descricaoCurta" (uma frase curta em português descrevendo o que é o arquivo/imagem).'
                  },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: fileBuffer.toString('base64')
                    }
                  }
                ]
              }
            ]
          })
        }
      );

      if (!response.ok) return null;
      const data = (await response.json()) as any;
      const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      const rawText = parts.filter(p => !p?.thought && typeof p?.text === 'string').pop()?.text ?? parts[0]?.text;
      if (typeof rawText !== 'string') return null;

      const parsed = JSON.parse(rawText) as { tipoDoc?: string; descricaoCurta?: string };
      const allowed = [
        'RG',
        'CPF',
        'CNH',
        'COMPROVANTE_ENDERECO',
        'CONTRATO',
        'PROCURACAO',
        'PROCURACAO_ASSINADA',
        'DOCUMENTO_COMPROBATORIO',
        'OUTRO',
        'NAO_CLASSIFICADO'
      ];
      const tipoDoc = allowed.includes(String(parsed.tipoDoc)) ? String(parsed.tipoDoc) : 'DOCUMENTO_COMPROBATORIO';
      const descricaoCurta = parsed.descricaoCurta ? String(parsed.descricaoCurta).trim() : 'Arquivo recebido pelo WhatsApp';
      return { tipoDoc, descricaoCurta };
    } catch {
      return null;
    }
  }

  private async recalcularDossieTransacional(
    client: import('pg').PoolClient,
    clienteId: string,
    encryptionKey: Buffer
  ): Promise<void> {
    const clienteRow = await client.query(
      `SELECT tipo_caso, checklist_status FROM operacional.clientes WHERE id = $1`,
      [clienteId]
    );
    if (clienteRow.rows.length === 0) return;

    const msgsRes = await client.query(
      `SELECT tipo, enviada_em, conteudo_cifrado, conteudo_nonce, conteudo_tag,
              transcricao_cifrada, transcricao_nonce, transcricao_tag
       FROM operacional.mensagens
       WHERE cliente_id = $1
       ORDER BY enviada_em ASC`,
      [clienteId]
    );

    const docsRes = await client.query(
      `SELECT tipo_doc FROM operacional.documentos WHERE cliente_id = $1`,
      [clienteId]
    );

    const narratives: string[] = [];
    for (const row of msgsRes.rows) {
      const rawJson = this.safeDecryptText(row.conteudo_cifrado, row.conteudo_nonce, row.conteudo_tag);
      const transcricao = this.safeDecryptText(row.transcricao_cifrada, row.transcricao_nonce, row.transcricao_tag);
      if (rawJson) {
        try {
          const parsed = JSON.parse(rawJson) as JsonRecord;
          const textObj = isRecord(parsed.text) ? parsed.text : undefined;
          const imgObj = isRecord(parsed.image) ? parsed.image : undefined;
          const docObj = isRecord(parsed.document) ? parsed.document : undefined;
          const body =
            optionalString(textObj?.body) ??
            optionalString(imgObj?.caption) ??
            optionalString(docObj?.caption);
          if (body) narratives.push(body);
        } catch {
          // ignore
        }
      }
      if (transcricao) {
        narratives.push(`[Áudio Transcrito]: "${transcricao}"`);
      }
    }

    const combinedText = narratives.join(' | ');
    const docTypes = docsRes.rows.map(r => String(r.tipo_doc));
    const detectedTipoCaso = normalizeTipoCaso(clienteRow.rows[0].tipo_caso);

    const existingChecklist = isRecord(clienteRow.rows[0].checklist_status)
      ? (clienteRow.rows[0].checklist_status as Record<string, boolean>)
      : {};
    const updatedChecklist = autoEvaluateChecklist(detectedTipoCaso, existingChecklist, combinedText, docTypes);

    const template = CHECKLIST_TEMPLATES[detectedTipoCaso];
    const faltando = template
      .filter(item => item.obrigatorio && !updatedChecklist[item.key])
      .map(item => item.label);

    const status = faltando.length === 0 ? 'PRONTO_PROCURACAO' : 'INCOMPLETO';

    const resumoEstruturado =
      narratives.length > 0
        ? narratives.slice(-8).join('\n• ')
        : 'Aguardando relato detalhado do cliente pelo WhatsApp.';
    const encryptedResumo = encryptValue(`• ${resumoEstruturado}`, encryptionKey);

    await client.query(
      `UPDATE operacional.clientes
       SET tipo_caso = $2,
           checklist_status = $3::jsonb,
           faltando = $4::jsonb,
           status = CASE WHEN status = 'COMPLETO' THEN 'COMPLETO' ELSE $5 END,
           resumo_cifrado = $6,
           resumo_nonce = $7,
           resumo_tag = $8,
           updated_at = clock_timestamp()
       WHERE id = $1`,
      [
        clienteId,
        detectedTipoCaso,
        JSON.stringify(updatedChecklist),
        JSON.stringify(faltando),
        status,
        encryptedResumo.ciphertext,
        encryptedResumo.nonce,
        encryptedResumo.tag
      ]
    );
  }

  private extrairMensagens(
    payload: JsonRecord,
    encryptionKey: Buffer
  ): { messages: IncomingMessage[]; phoneNumberId?: string } {
    const entries = Array.isArray(payload.entry)
      ? payload.entry
      : isRecord(payload.value)
      ? [{ changes: [{ field: payload.field ?? 'messages', value: payload.value }] }]
      : [];
    const result: IncomingMessage[] = [];
    let detectedPhoneNumberId: string | undefined;

    for (const entry of entries) {
      if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
      for (const change of entry.changes) {
        if (!isRecord(change) || !isRecord(change.value)) continue;
        const value = change.value;

        if (isRecord(value.metadata)) {
          const metaPhoneId = optionalString(value.metadata.phone_number_id);
          if (metaPhoneId) detectedPhoneNumberId = metaPhoneId;
        }

        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        const namesByPhone = new Map<string, string>();
        for (const contact of contacts) {
          if (!isRecord(contact) || !isRecord(contact.profile)) continue;
          const waId = optionalString(contact.wa_id);
          const name = optionalString(contact.profile.name);
          if (waId && name) namesByPhone.set(waId, name);
        }

        if (!Array.isArray(value.messages)) continue;
        for (const rawMessage of value.messages) {
          if (!isRecord(rawMessage)) throw new Error('MENSAGEM_INVALIDA');
          const id = optionalString(rawMessage.id);
          const phone = optionalString(rawMessage.from);
          const type = optionalString(rawMessage.type);
          const timestamp = Number(rawMessage.timestamp);
          if (!id || !phone || !type || !Number.isFinite(timestamp)) {
            throw new Error('CAMPOS_OBRIGATORIOS_AUSENTES');
          }

          const content = isRecord(rawMessage[type]) ? rawMessage[type] : {};
          const referral = isRecord(rawMessage.referral) ? rawMessage.referral : {};
          const adId = optionalString(referral.ad_id) ?? optionalString(referral.source_id);
          const ctwaClid = optionalString(referral.ctwa_clid) ?? optionalString(rawMessage.ctwa_clid);
          const mediaId = optionalString(content.id);
          const filename = optionalString(content.filename);
          const caption = optionalString(content.caption);
          const mimeType = optionalString(content.mime_type);
          const transcription = optionalString(content.transcription);
          const isMedia = ['audio', 'document', 'image', 'video', 'sticker'].includes(type);

          result.push({
            id,
            phone,
            type: ['text', 'audio', 'image', 'document', 'video', 'sticker'].includes(type) ? type : 'outro',
            timestamp: new Date(timestamp * 1000),
            rawObject: rawMessage,
            encryptedContent: encryptValue(JSON.stringify(rawMessage), encryptionKey),
            ...(namesByPhone.has(phone)
              ? { encryptedName: encryptValue(namesByPhone.get(phone)!, encryptionKey) }
              : {}),
            ...(transcription
              ? {
                  transcriptionText: transcription,
                  encryptedTranscription: encryptValue(transcription, encryptionKey)
                }
              : {}),
            ...(isMedia && mediaId
              ? {
                  media: {
                    type,
                    mediaId,
                    classifiedDocType: classifyDocumentFromText(filename, caption),
                    ...(mimeType ? { mimeType } : {}),
                    ...(filename ? { filename, encryptedFilename: encryptValue(filename, encryptionKey) } : {}),
                    ...(caption ? { caption } : {})
                  }
                }
              : {}),
            ...(adId ? { adId } : {}),
            ...(ctwaClid ? { ctwaClid } : {}),
            ...(detectedPhoneNumberId ? { phoneNumberId: detectedPhoneNumberId } : {})
          });
        }
      }
    }
    return {
      messages: result,
      ...(detectedPhoneNumberId ? { phoneNumberId: detectedPhoneNumberId } : {})
    };
  }

  // ─── Consultas e Gestão da Estação de Triagem e Dossiê ──────────────────────

  async listarClientes(escritorioId?: string): Promise<ClienteTriagemResumo[]> {
    const query = `
      SELECT
        c.id,
        c.nome_cifrado, c.nome_nonce, c.nome_tag,
        c.origem,
        c.tipo_caso,
        c.status,
        c.checklist_status,
        c.faltando,
        c.resumo_cifrado, c.resumo_nonce, c.resumo_tag,
        c.updated_at,
        t.telefone_cifrado, t.telefone_nonce, t.telefone_tag,
        (SELECT COUNT(*)::int FROM operacional.mensagens m WHERE m.cliente_id = c.id) AS total_mensagens,
        (SELECT COUNT(*)::int FROM operacional.documentos d WHERE d.cliente_id = c.id) AS total_documentos
      FROM operacional.clientes c
      LEFT JOIN operacional.cliente_telefones t ON t.cliente_id = c.id AND t.principal = TRUE
      WHERE ($1::uuid IS NULL OR c.escritorio_id = $1 OR c.escritorio_id IS NULL)
      ORDER BY c.updated_at DESC
    `;
    const res = await this.pool.query(query, [escritorioId ?? null]);
    return res.rows.map(row => this.mapearResumoCliente(row));
  }

  private mapearResumoCliente(row: Record<string, any>): ClienteTriagemResumo {
    const nome =
      this.safeDecryptText(row.nome_cifrado, row.nome_nonce, row.nome_tag) ?? 'Contato WhatsApp';
    const telefone =
      this.safeDecryptText(row.telefone_cifrado, row.telefone_nonce, row.telefone_tag) ?? '+55 (Número Protegido)';
    const resumoContexto =
      this.safeDecryptText(row.resumo_cifrado, row.resumo_nonce, row.resumo_tag) ??
      'Sem resumo consolidado até o momento.';

    const tipoCaso: TipoCasoJuridico = normalizeTipoCaso(row.tipo_caso);

    const template = CHECKLIST_TEMPLATES[tipoCaso];
    const checklistStatus = isRecord(row.checklist_status)
      ? (row.checklist_status as Record<string, boolean>)
      : {};

    const obrigatorios = template.filter(i => i.obrigatorio);
    const recebidos = obrigatorios.filter(i => Boolean(checklistStatus[i.key])).length;
    const faltando = obrigatorios.filter(i => !checklistStatus[i.key]).map(i => i.label);

    return {
      id: String(row.id),
      nome,
      telefone,
      origem: row.origem,
      tipoCaso,
      status: row.status,
      checklistRecebidos: recebidos,
      checklistTotal: obrigatorios.length,
      faltando,
      resumoContexto,
      totalMensagens: Number(row.total_mensagens ?? 0),
      totalDocumentos: Number(row.total_documentos ?? 0),
      qualificacao: {
        cpf: row.cpf ? String(row.cpf) : null,
        rg: row.rg ? String(row.rg) : null,
        orgaoEmissor: row.orgao_emissor ? String(row.orgao_emissor) : null,
        nacionalidade: row.nacionalidade ? String(row.nacionalidade) : 'brasileiro(a)',
        estadoCivil: row.estado_civil ? String(row.estado_civil) : 'solteiro(a)',
        profissao: row.profissao ? String(row.profissao) : null,
        endereco: row.endereco ? String(row.endereco) : null,
        cidade: row.cidade ? String(row.cidade) : null,
        uf: row.uf ? String(row.uf) : null,
        cep: row.cep ? String(row.cep) : null,
        dadosQualificacao: isRecord(row.dados_qualificacao) ? (row.dados_qualificacao as Record<string, any>) : {}
      },
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  async obterDossieCliente(clienteId: string, escritorioId?: string): Promise<DossieClienteCompleto | null> {
    // Se houver mídias pendentes de download ou áudios sem transcrição, dispara o processamento em background sem travar a leitura
    void this.processarMidiasPendentesCliente(clienteId).catch(() => {});

    const cliRes = await this.pool.query(
      `SELECT
        c.id,
        c.nome_cifrado, c.nome_nonce, c.nome_tag,
        c.origem, c.tipo_caso, c.status, c.checklist_status, c.faltando,
        c.resumo_cifrado, c.resumo_nonce, c.resumo_tag, c.updated_at,
        c.cpf, c.rg, c.orgao_emissor, c.nacionalidade, c.estado_civil, c.profissao, c.endereco, c.cidade, c.uf, c.cep, c.dados_qualificacao,
        t.telefone_cifrado, t.telefone_nonce, t.telefone_tag,
        (SELECT COUNT(*)::int FROM operacional.mensagens m WHERE m.cliente_id = c.id) AS total_mensagens,
        (SELECT COUNT(*)::int FROM operacional.documentos d WHERE d.cliente_id = c.id) AS total_documentos
       FROM operacional.clientes c
       LEFT JOIN operacional.cliente_telefones t ON t.cliente_id = c.id AND t.principal = TRUE
       WHERE c.id = $1 AND ($2::uuid IS NULL OR c.escritorio_id = $2 OR c.escritorio_id IS NULL)
       LIMIT 1`,
      [clienteId, escritorioId ?? null]
    );

    if (cliRes.rows.length === 0) return null;
    const row = cliRes.rows[0];
    const cliente = this.mapearResumoCliente(row);

    const msgsRes = await this.pool.query(
      `SELECT
        m.id,
        m.whatsapp_message_id,
        m.direcao,
        m.tipo,
        m.enviada_em,
        m.conteudo_cifrado, m.conteudo_nonce, m.conteudo_tag,
        m.transcricao_cifrada, m.transcricao_nonce, m.transcricao_tag,
        m.transcricao_estado,
        d.id AS doc_id,
        d.tipo_doc,
        d.media_kind,
        d.mime_type,
        d.estado AS doc_estado,
        d.caminho_local,
        d.nome_original_cifrado, d.nome_original_nonce, d.nome_original_tag,
        d.texto_ocr_cifrado, d.texto_ocr_nonce, d.texto_ocr_tag
       FROM operacional.mensagens m
       LEFT JOIN operacional.documentos d ON d.mensagem_id = m.id
       WHERE m.cliente_id = $1
       ORDER BY m.enviada_em ASC, m.criado_em ASC`,
      [clienteId]
    );

    const mensagens: MensagemDossie[] = msgsRes.rows.map(m => {
      const rawJson = this.safeDecryptText(m.conteudo_cifrado, m.conteudo_nonce, m.conteudo_tag);
      const transcricao =
        this.safeDecryptText(m.transcricao_cifrada, m.transcricao_nonce, m.transcricao_tag) ?? undefined;
      const nomeOriginal =
        this.safeDecryptText(m.nome_original_cifrado, m.nome_original_nonce, m.nome_original_tag) ?? undefined;
      const resumoOcr =
        this.safeDecryptText(m.texto_ocr_cifrado, m.texto_ocr_nonce, m.texto_ocr_tag) ?? undefined;

      let texto = '';
      if (rawJson) {
        try {
          const parsed = JSON.parse(rawJson) as JsonRecord;
          if (isRecord(parsed.text) && typeof parsed.text.body === 'string') {
            texto = parsed.text.body;
          } else if (isRecord(parsed.image) && typeof parsed.image.caption === 'string') {
            texto = parsed.image.caption;
          } else if (isRecord(parsed.document) && typeof parsed.document.caption === 'string') {
            texto = parsed.document.caption;
          }
        } catch {
          texto = rawJson;
        }
      }

      const normalizedTipo = (
        m.tipo === 'texto'
          ? 'text'
          : m.tipo === 'imagem'
          ? 'image'
          : m.tipo === 'documento'
          ? 'document'
          : m.tipo
      ) as MensagemDossie['tipo'];

      return {
        id: String(m.id),
        whatsappMessageId: String(m.whatsapp_message_id),
        direcao: m.direcao,
        tipo: normalizedTipo,
        enviadaEm: new Date(m.enviada_em).toISOString(),
        texto,
        ...(transcricao ? { transcricao } : {}),
        ...(m.transcricao_estado ? { transcricaoEstado: String(m.transcricao_estado) } : {}),
        ...(m.doc_id
          ? {
              midia: {
                id: String(m.doc_id),
                tipoDoc: String(m.tipo_doc),
                mediaKind: String(m.media_kind || normalizedTipo.toUpperCase()),
                mimeType: m.mime_type ? String(m.mime_type) : null,
                nomeArquivo:
                  nomeOriginal ??
                  (normalizedTipo === 'image'
                    ? 'Imagem_WhatsApp.jpg'
                    : normalizedTipo === 'audio'
                    ? 'Audio_Cliente.ogg'
                    : 'Documento_Anexo.pdf'),
                estado: String(m.doc_estado),
                caminhoLocal: m.caminho_local ? String(m.caminho_local) : null,
                resumoOcr: resumoOcr ?? null
              }
            }
          : {})
      };
    });

    // Vinculação inteligente de imagens/documentos avulsos com mensagens de texto explicativas subsequentes
    for (let i = 0; i < mensagens.length; i++) {
      const msg = mensagens[i]!;
      if ((msg.tipo === 'image' || msg.tipo === 'document') && !msg.texto) {
        for (let j = i + 1; j < Math.min(i + 4, mensagens.length); j++) {
          const nextMsg = mensagens[j]!;
          if (nextMsg.tipo === 'text' && nextMsg.texto) {
            msg.explicacaoContextual = nextMsg.texto;
            break;
          }
        }
      }
    }

    const checklistStatus = isRecord(row.checklist_status)
      ? (row.checklist_status as Record<string, boolean>)
      : {};
    const template = CHECKLIST_TEMPLATES[cliente.tipoCaso];
    const checklist = template.map(item => ({
      ...item,
      recebido: Boolean(checklistStatus[item.key])
    }));

    return {
      cliente,
      pastaFisicaRelativa: `storage/clientes/${cliente.id}`,
      checklist,
      mensagens
    };
  }

  /**
   * Retorna os bytes reais do arquivo (áudio .ogg, imagem .jpg ou PDF) armazenado na pasta física do cliente.
   */
  async obterArquivoMidia(
    documentoId: string,
    escritorioId?: string
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
    const res = await this.pool.query(
      `SELECT
        d.id,
        d.cliente_id,
        d.mime_type,
        d.media_kind,
        d.caminho_local,
        d.nome_original_cifrado, d.nome_original_nonce, d.nome_original_tag
       FROM operacional.documentos d
       JOIN operacional.clientes c ON c.id = d.cliente_id
       WHERE d.id = $1 AND ($2::uuid IS NULL OR c.escritorio_id = $2 OR c.escritorio_id IS NULL)
       LIMIT 1`,
      [documentoId, escritorioId ?? null]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    let localPath: string | null = row.caminho_local ?? null;
    if (!localPath || !existsSync(localPath)) {
      await this.processarMidiasPendentesCliente(String(row.cliente_id));
      const recheck = await this.pool.query(
        `SELECT caminho_local, nome_original_cifrado, nome_original_nonce, nome_original_tag
         FROM operacional.documentos WHERE id = $1`,
        [documentoId]
      );
      localPath = recheck.rows[0]?.caminho_local ?? null;
    }

    if (!localPath || !existsSync(localPath)) return null;

    const buffer = readFileSync(localPath);
    const mimeType = String(row.mime_type || 'application/octet-stream').split(';')[0]!.trim();
    const filename =
      this.safeDecryptText(row.nome_original_cifrado, row.nome_original_nonce, row.nome_original_tag) ??
      `Arquivo_${documentoId.slice(0, 8)}`;

    return { buffer, mimeType, filename };
  }

  /**
   * Gera um pacote .ZIP contendo todos os arquivos reais da pasta do cliente + Resumo de Triagem.
   */
  async gerarZipPastaCliente(
    clienteId: string,
    escritorioId?: string
  ): Promise<{ zipBuffer: Buffer; zipFilename: string } | null> {
    const dossie = await this.obterDossieCliente(clienteId, escritorioId);
    if (!dossie) return null;

    const entries: ZipEntryInput[] = [];

    const resumoTxt = [
      `=============================================================`,
      `PASTA DIGITAL DO CLIENTE - TRIAGEM WHATSAPP (GHFS JURÍDICO)`,
      `=============================================================`,
      `Cliente: ${dossie.cliente.nome}`,
      `Telefone: ${dossie.cliente.telefone}`,
      `Enquadramento / Área: ${dossie.cliente.tipoCaso}`,
      `Status Documental: ${dossie.cliente.status} (${dossie.cliente.checklistRecebidos}/${dossie.cliente.checklistTotal} obrigatórios)`,
      `Diretório Físico no Servidor: ${dossie.pastaFisicaRelativa}`,
      ``,
      `--- RESUMO CONSOLIDADO DOS FATOS (TEXTOS + ÁUDIOS TRANSCRITOS) ---`,
      dossie.cliente.resumoContexto,
      ``,
      `--- CHECKLIST DE DOCUMENTOS ---`,
      ...dossie.checklist.map(c => `[${c.recebido ? 'X' : ' '}] ${c.label} (${c.descricao})`),
      ``,
      `--- HISTÓRICO CRONOLÓGICO COMPLETO ---`,
      ...dossie.mensagens.map((m, idx) => {
        const dt = new Date(m.enviadaEm).toLocaleString('pt-BR');
        if (m.tipo === 'audio') {
          return `${idx + 1}. [${dt}] ÁUDIO (${m.midia?.nomeArquivo ?? 'audio.ogg'}): "${m.transcricao ?? 'Sem transcrição'}"`;
        }
        if (m.midia) {
          const ocr = m.midia.resumoOcr ? ` | IA: ${m.midia.resumoOcr}` : '';
          const exp = m.explicacaoContextual ? ` | Explicação do cliente: "${m.explicacaoContextual}"` : '';
          return `${idx + 1}. [${dt}] ARQUIVO (${m.midia.nomeArquivo} - ${m.midia.tipoDoc})${ocr}${exp}`;
        }
        return `${idx + 1}. [${dt}] TEXTO: "${m.texto}"`;
      })
    ].join('\r\n');

    entries.push({
      filename: '00_Resumo_Dossie_Cliente.txt',
      data: Buffer.from(resumoTxt, 'utf8')
    });

    for (const msg of dossie.mensagens) {
      if (msg.midia?.id) {
        const fileData = await this.obterArquivoMidia(msg.midia.id, escritorioId);
        if (fileData) {
          entries.push({
            filename: fileData.filename,
            data: fileData.buffer
          });
        }
      }
    }

    const safeClientName = dossie.cliente.nome.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      zipBuffer: buildZipBuffer(entries),
      zipFilename: `Pasta_Cliente_${safeClientName}.zip`
    };
  }

  /**
   * Gera o Kit Contratual Oficial (Procuração + Justiça Gratuita + Declaração de Residência + Contrato de Honorários ASO)
   * em formato HTML print-ready com a logo oficial ASO ADVOGADOS e o arquiva fisicamente na pasta do cliente.
   */
  async gerarKitContratualCliente(
    clienteId: string,
    escritorioId?: string
  ): Promise<{ html: string; filename: string; caminhoFisico: string } | null> {
    const dossie = await this.obterDossieCliente(clienteId, escritorioId);
    if (!dossie) return null;

    const clientFolder = join(this.storageRoot, clienteId);
    if (!existsSync(clientFolder)) {
      mkdirSync(clientFolder, { recursive: true });
    }

    const q = dossie.cliente.qualificacao;

    // Resolve dados do escritório ativo para personalizar contrato e procuração
    const escId = dossie.cliente.escritorioId || escritorioId;
    let dadosEscritorio: import('./documento-contratual.service').DadosContratuaisCliente['dadosEscritorio'] = undefined;
    if (escId) {
      const escRes = await this.pool.query<{ nome: string; logo_url: string | null }>(
        `SELECT nome, logo_url FROM escritorios WHERE id = $1`,
        [escId]
      );
      const advRes = await this.pool.query<{ nome: string; numero_oab: string; uf_oab: string }>(
        `SELECT nome, numero_oab, uf_oab FROM advogados WHERE escritorio_id = $1 LIMIT 1`,
        [escId]
      );
      if (escRes.rows.length > 0) {
        dadosEscritorio = {
          nomeEscritorio: escRes.rows[0].nome,
          logoUrl: escRes.rows[0].logo_url ?? undefined,
          ...(advRes.rows.length > 0 ? {
            advogadoTitular: advRes.rows[0].nome,
            oabNumero: advRes.rows[0].numero_oab,
            oabUf: advRes.rows[0].uf_oab
          } : {})
        };
      }
    }

    const html = gerarHtmlKitContratualAso({
      nomeCliente: dossie.cliente.nome,
      dadosEscritorio,
      telefone: dossie.cliente.telefone,
      cpf: q?.cpf ?? undefined,
      rg: q?.rg ? (q.orgaoEmissor ? `${q.rg} ${q.orgaoEmissor}` : q.rg) : undefined,
      nacionalidade: q?.nacionalidade ?? undefined,
      estadoCivil: q?.estadoCivil ?? undefined,
      profissao: q?.profissao ?? undefined,
      endereco: q?.endereco ?? undefined,
      cidade: q?.cidade ?? undefined,
      uf: q?.uf ?? undefined,
      cep: q?.cep ?? undefined,
      tipoCaso: dossie.cliente.tipoCaso,
      resumoFatos: dossie.cliente.resumoContexto
    });

    const safeClientName = dossie.cliente.nome.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeTenantSlug = (dadosEscritorio?.nomeEscritorio ?? 'Escritorio').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Kit_Contratual_${safeTenantSlug}_${safeClientName}.html`;
    const caminhoFisico = join(clientFolder, filename);

    // Grava fisicamente na pasta do cliente para constar no arquivo e no download .ZIP
    writeFileSync(caminhoFisico, Buffer.from(html, 'utf8'));

    return { html, filename, caminhoFisico };
  }

  async atualizarChecklistCliente(
    clienteId: string,
    payload: {
      tipoCaso?: TipoCasoJuridico;
      itemKey?: string;
      recebido?: boolean;
      status?: 'INCOMPLETO' | 'PRONTO_PROCURACAO' | 'COMPLETO';
      resumoContexto?: string;
    },
    escritorioId?: string
  ): Promise<DossieClienteCompleto | null> {
    const { encryptionKey } = this.ensureKeys();

    const cur = await this.pool.query(
      `SELECT tipo_caso, checklist_status, status FROM operacional.clientes
       WHERE id = $1 AND ($2::uuid IS NULL OR escritorio_id = $2 OR escritorio_id IS NULL)`,
      [clienteId, escritorioId ?? null]
    );
    if (cur.rows.length === 0) return null;

    const currentTipoCaso: TipoCasoJuridico = payload.tipoCaso
      ? normalizeTipoCaso(payload.tipoCaso)
      : normalizeTipoCaso(cur.rows[0].tipo_caso);

    const currentChecklist: Record<string, boolean> = isRecord(cur.rows[0].checklist_status)
      ? { ...(cur.rows[0].checklist_status as Record<string, boolean>) }
      : {};

    if (payload.itemKey !== undefined && typeof payload.recebido === 'boolean') {
      currentChecklist[payload.itemKey] = payload.recebido;
    }

    const template = CHECKLIST_TEMPLATES[currentTipoCaso];
    const faltando = template
      .filter(i => i.obrigatorio && !currentChecklist[i.key])
      .map(i => i.label);

    const nextStatus =
      payload.status ?? (faltando.length === 0 ? 'PRONTO_PROCURACAO' : 'INCOMPLETO');

    if (payload.resumoContexto !== undefined) {
      const enc = encryptValue(payload.resumoContexto, encryptionKey);
      await this.pool.query(
        `UPDATE operacional.clientes
         SET tipo_caso = $2,
             checklist_status = $3::jsonb,
             faltando = $4::jsonb,
             status = $5,
             resumo_cifrado = $6,
             resumo_nonce = $7,
             resumo_tag = $8,
             updated_at = clock_timestamp()
         WHERE id = $1`,
        [
          clienteId,
          currentTipoCaso,
          JSON.stringify(currentChecklist),
          JSON.stringify(faltando),
          nextStatus,
          enc.ciphertext,
          enc.nonce,
          enc.tag
        ]
      );
    } else {
      await this.pool.query(
        `UPDATE operacional.clientes
         SET tipo_caso = $2,
             checklist_status = $3::jsonb,
             faltando = $4::jsonb,
             status = $5,
             updated_at = clock_timestamp()
         WHERE id = $1`,
        [
          clienteId,
          currentTipoCaso,
          JSON.stringify(currentChecklist),
          JSON.stringify(faltando),
          nextStatus
        ]
      );
    }

    return this.obterDossieCliente(clienteId, escritorioId);
  }

  
  async processarExtracaoDocumentosCliente(clienteId: string, escritorioId?: string): Promise<QualificacaoCadastral | null> {
    const docsRes = await this.pool.query(
      `SELECT d.id, d.tipo_doc, d.media_kind, d.mime_type, d.caminho_local
       FROM operacional.documentos d
       JOIN operacional.clientes c ON c.id = d.cliente_id
       WHERE d.cliente_id = $1 AND ($2::uuid IS NULL OR c.escritorio_id = $2)
         AND d.media_kind IN ('IMAGE', 'DOCUMENT')
       ORDER BY d.created_at DESC`,
      [clienteId, escritorioId ?? null]
    );

    if (docsRes.rows.length === 0) return null;

    let dadosConsolidados: Record<string, any> = {};
    let cpfEncontrado: string | null = null;
    let rgEncontrado: string | null = null;
    let orgaoEmissorEncontrado: string | null = null;
    let cidadeEncontrada: string | null = null;
    let ufEncontrada: string | null = null;
    let enderecoEncontrado: string | null = null;
    let cepEncontrado: string | null = null;
    let docIdDetectado = false;

    for (const doc of docsRes.rows) {
      if (!doc.caminho_local || !existsSync(doc.caminho_local)) continue;
      const extraido = await extrairDadosDocumento(doc.caminho_local, doc.mime_type);
      if (!extraido) continue;

      dadosConsolidados = { ...dadosConsolidados, ...extraido };
      if (extraido.cpf && !cpfEncontrado) cpfEncontrado = extraido.cpf;
      if (extraido.rg && !rgEncontrado) rgEncontrado = extraido.rg;
      if (extraido.orgaoEmissor && !orgaoEmissorEncontrado) orgaoEmissorEncontrado = extraido.orgaoEmissor;
      if (extraido.cidade && !cidadeEncontrada) cidadeEncontrada = extraido.cidade;
      if (extraido.uf && !ufEncontrada) ufEncontrada = extraido.uf;
      if (extraido.endereco && !enderecoEncontrado) enderecoEncontrado = extraido.endereco;
      if (extraido.cep && !cepEncontrado) cepEncontrado = extraido.cep;

      if (extraido.tipoDocumentoDetectado === 'CNH' || extraido.tipoDocumentoDetectado === 'RG') {
        docIdDetectado = true;
      }
    }

    if (Object.keys(dadosConsolidados).length > 0) {
      await this.pool.query(
        `UPDATE operacional.clientes
         SET cpf = COALESCE(cpf, $2),
             rg = COALESCE(rg, $3),
             orgao_emissor = COALESCE(orgao_emissor, $4),
             cidade = COALESCE(cidade, $5),
             uf = COALESCE(uf, $6),
             endereco = COALESCE(endereco, $7),
             cep = COALESCE(cep, $8),
             dados_qualificacao = dados_qualificacao || $9::jsonb,
             checklist_status = CASE
               WHEN $10::boolean AND (checklist_status->>'DOC_IDENTIDADE') IS NULL
               THEN jsonb_set(checklist_status, '{DOC_IDENTIDADE}', 'true'::jsonb, true)
               ELSE checklist_status
             END,
             updated_at = clock_timestamp()
         WHERE id = $1`,
        [
          clienteId,
          cpfEncontrado,
          rgEncontrado,
          orgaoEmissorEncontrado,
          cidadeEncontrada,
          ufEncontrada,
          enderecoEncontrado,
          cepEncontrado,
          JSON.stringify(dadosConsolidados),
          docIdDetectado
        ]
      );
    }

    const dossie = await this.obterDossieCliente(clienteId, escritorioId);
    return dossie?.cliente.qualificacao ?? null;
  }

  async atualizarQualificacaoCliente(
    clienteId: string,
    dados: Partial<QualificacaoCadastral>,
    escritorioId?: string
  ): Promise<DossieClienteCompleto | null> {
    await this.pool.query(
      `UPDATE operacional.clientes
       SET cpf = COALESCE($2, cpf),
           rg = COALESCE($3, rg),
           orgao_emissor = COALESCE($4, orgao_emissor),
           nacionalidade = COALESCE($5, nacionalidade),
           estado_civil = COALESCE($6, estado_civil),
           profissao = COALESCE($7, profissao),
           endereco = COALESCE($8, endereco),
           cidade = COALESCE($9, cidade),
           uf = COALESCE($10, uf),
           cep = COALESCE($11, cep),
           updated_at = clock_timestamp()
       WHERE id = $1 AND ($12::uuid IS NULL OR escritorio_id = $12 OR escritorio_id IS NULL)`,
      [
        clienteId,
        dados.cpf ?? null,
        dados.rg ?? null,
        dados.orgaoEmissor ?? null,
        dados.nacionalidade ?? null,
        dados.estadoCivil ?? null,
        dados.profissao ?? null,
        dados.endereco ?? null,
        dados.cidade ?? null,
        dados.uf ?? null,
        dados.cep ?? null,
        escritorioId ?? null
      ]
    );

    return this.obterDossieCliente(clienteId, escritorioId);
  }

  async obterConfiguracaoTenant(escritorioId?: string) {
    const res = await this.pool.query(
      `SELECT id, nome, slug, plano, whatsapp_waba_id, whatsapp_phone_number_id, whatsapp_display_phone,
              whatsapp_access_token_cifrado IS NOT NULL AS has_token,
              whatsapp_status_conexao,
              whatsapp_ultimo_sync_em
       FROM escritorios
       WHERE ($1::uuid IS NULL OR id = $1)
       ORDER BY CASE WHEN plano = 'MASTER' THEN 0 ELSE 1 END, created_at ASC
       LIMIT 1`,
      [escritorioId ?? null]
    );
    const tenant = res.rows[0];
    const statsRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total, MAX(recebido_em) AS ultimo_em
       FROM operacional.webhook_eventos
       WHERE ($1::uuid IS NULL OR escritorio_id = $1)`,
      [tenant?.id ?? null]
    );
    const stats = statsRes.rows[0];
    return {
      escritorioId: tenant?.id ?? null,
      escritorioNome: tenant?.nome ?? 'Escritório Piloto',
      whatsappWabaId: tenant?.whatsapp_waba_id ?? (tenant?.plano === 'MASTER' ? process.env.WHATSAPP_WABA_ID ?? '' : ''),
      whatsappPhoneNumberId: tenant?.whatsapp_phone_number_id ?? '',
      whatsappDisplayPhone: tenant?.whatsapp_display_phone ?? '',
      tokenConfiguradoNoServidor: Boolean(tenant?.has_token || (tenant?.plano === 'MASTER' && process.env.WHATSAPP_ACCESS_TOKEN)),
      statusConexao: tenant?.whatsapp_status_conexao ?? (tenant?.has_token ? 'CONECTADO' : 'DESCONECTADO'),
      totalEventosRecebidos: Number(stats?.total ?? 0),
      ultimoWebhookEm: stats?.ultimo_em ? new Date(stats.ultimo_em).toISOString() : null
    };
  }

  async salvarConfiguracaoTenant(
    escritorioId: string | undefined,
    payload: {
      whatsappWabaId?: string;
      whatsappPhoneNumberId: string;
      whatsappDisplayPhone?: string;
      accessToken?: string;
    }
  ) {
    const target = await this.obterConfiguracaoTenant(escritorioId);
    if (!target.escritorioId) throw new Error('ESCRITORIO_NAO_ENCONTRADO');

    const cleanWabaId = payload.whatsappWabaId?.trim() || target.whatsappWabaId || null;
    const cleanId = payload.whatsappPhoneNumberId?.trim() || target.whatsappPhoneNumberId || null;
    const cleanPhone = payload.whatsappDisplayPhone?.trim() || null;

    if (payload.accessToken && payload.accessToken.trim()) {
      const { encryptionKey } = this.ensureKeys();
      const enc = encryptValue(payload.accessToken.trim(), encryptionKey);
      await this.pool.query(
        `UPDATE escritorios
         SET whatsapp_waba_id = $2,
             whatsapp_phone_number_id = $3,
             whatsapp_display_phone = $4,
             whatsapp_access_token_cifrado = $5,
             whatsapp_access_token_nonce = $6,
             whatsapp_access_token_tag = $7,
             whatsapp_status_conexao = 'CONECTADO',
             whatsapp_ultimo_sync_em = clock_timestamp(),
             updated_at = clock_timestamp()
         WHERE id = $1`,
        [target.escritorioId, cleanWabaId, cleanId, cleanPhone, enc.ciphertext, enc.nonce, enc.tag]
      );
    } else {
      await this.pool.query(
        `UPDATE escritorios
         SET whatsapp_waba_id = $2,
             whatsapp_phone_number_id = $3,
             whatsapp_display_phone = $4,
             updated_at = clock_timestamp()
         WHERE id = $1`,
        [target.escritorioId, cleanWabaId, cleanId, cleanPhone]
      );
    }

    const tokenToUse = payload.accessToken?.trim() || (await this.obterTokenAcessoTenant(target.escritorioId));
    let metaSubscribed = false;
    if (cleanWabaId && tokenToUse) {
      try {
        const resp = await fetch(`https://graph.facebook.com/v25.0/${cleanWabaId}/subscribed_apps`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenToUse}` }
        });
        metaSubscribed = resp.ok;
      } catch (err) {
        console.warn('⚠️ Falha ao chamar subscribed_apps na Meta:', err);
      }
    }

    const updated = await this.obterConfiguracaoTenant(target.escritorioId);
    return {
      ...updated,
      metaSubscribed
    };
  }
}

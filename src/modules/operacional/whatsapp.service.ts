import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { decryptValue, encryptValue, phoneHmac } from './whatsapp.crypto';

type JsonRecord = Record<string, unknown>;

export interface WhatsAppSecrets {
  encryptionKey?: Buffer;
  phoneHashKey?: Buffer;
}

export type TipoCasoJuridico = 'RCV_BANCARIO' | 'ECOMMERCE_ML' | 'GERAL';

export interface ChecklistTemplateItem {
  key: string;
  label: string;
  obrigatorio: boolean;
  descricao: string;
}

export const CHECKLIST_TEMPLATES: Record<TipoCasoJuridico, ChecklistTemplateItem[]> = {
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
      label: 'Prints da Reclamação / Mediação Mercado Livre',
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
  RCV_BANCARIO: [
    {
      key: 'DOC_IDENTIDADE',
      label: 'RG ou CNH do Financiado',
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
      label: 'Contrato do Financiamento / Cédula de Crédito Bancário (CCB)',
      obrigatorio: true,
      descricao: 'Cópia do contrato com taxas de juros, CET e tarifas embutidas ( seguro prestamista / avaliação )'
    },
    {
      key: 'DOCUMENTO_VEICULO_CRLV',
      label: 'CRLV do Veículo Financiado',
      obrigatorio: true,
      descricao: 'Documento do veículo com indicação da alienação fiduciária'
    },
    {
      key: 'CARNE_COMPROVANTES_PARCELAS',
      label: 'Carnê ou Extrato de Parcelas Pagas / Em Atraso',
      obrigatorio: false,
      descricao: 'Histórico de evolução do saldo devedor ou notificações do banco'
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
  explicacaoContextual?: string;
  midia?: {
    id: string;
    tipoDoc: string;
    mediaKind: string;
    mimeType: string | null;
    nomeArquivo: string;
    estado: string;
  };
}

export interface DossieClienteCompleto {
  cliente: ClienteTriagemResumo;
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
    combined.includes('residencia')
  ) {
    return 'COMPROVANTE_ENDERECO';
  }
  if (combined.includes('contrato') || combined.includes('ccb') || combined.includes('financiamento')) {
    return 'CONTRATO';
  }
  if (combined.includes('procuracao') || combined.includes('procuração')) {
    return 'PROCURACAO';
  }
  return 'DOCUMENTO_COMPROBATORIO';
}

function detectCaseTypeFromText(allText: string, currentType?: string): TipoCasoJuridico {
  const lower = allText.toLowerCase();
  if (
    lower.includes('veículo') ||
    lower.includes('veiculo') ||
    lower.includes('financiamento') ||
    lower.includes('juros abusivos') ||
    lower.includes('busca e apreensão') ||
    lower.includes('parcela do carro') ||
    lower.includes('ccb')
  ) {
    return 'RCV_BANCARIO';
  }
  if (
    lower.includes('mercado livre') ||
    lower.includes('mercado pago') ||
    lower.includes('comprador') ||
    lower.includes('devolução') ||
    lower.includes('correios') ||
    lower.includes('venda')
  ) {
    return 'ECOMMERCE_ML';
  }
  if (currentType === 'RCV_BANCARIO' || currentType === 'ECOMMERCE_ML' || currentType === 'GERAL') {
    return currentType;
  }
  return 'ECOMMERCE_ML';
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
    lower.includes('rg')
  ) {
    next.DOC_IDENTIDADE = true;
  }
  if (
    docTypes.includes('COMPROVANTE_ENDERECO') ||
    lower.includes('comprovante de endereço') ||
    lower.includes('comprovante de residencia') ||
    lower.includes('conta de luz') ||
    lower.includes('copel')
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
    if (lower.includes('crlv') || lower.includes('documento do carro') || lower.includes('documento do veículo')) {
      next.DOCUMENTO_VEICULO_CRLV = true;
    }
    if (lower.includes('carnê') || lower.includes('carne') || lower.includes('parcela') || lower.includes('boleto')) {
      next.CARNE_COMPROVANTES_PARCELAS = true;
    }
  }

  return next;
}

/** Processa eventos recebidos e persiste dados sensíveis cifrados numa transação. */
export class WhatsAppWebhookService {
  constructor(
    private readonly pool: Pool,
    private readonly secrets: WhatsAppSecrets
  ) {}

  private ensureKeys(): { encryptionKey: Buffer; phoneHashKey: Buffer } {
    const encryptionKey = this.secrets.encryptionKey;
    const phoneHashKey = this.secrets.phoneHashKey;
    if (!encryptionKey || !phoneHashKey) {
      throw new Error('CONFIGURACAO_DE_CIFRAGEM_AUSENTE');
    }
    return { encryptionKey, phoneHashKey };
  }

  private safeDecryptText(ciphertext?: Buffer | null, nonce?: Buffer | null, tag?: Buffer | null): string | null {
    if (!ciphertext || !nonce || !tag || !this.secrets.encryptionKey) return null;
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

    try {
      await client.query('BEGIN');

      // Resolve o escritório (Multi-tenant) pelo phone_number_id da Meta ou usa o escritório piloto padrão
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
      const touchedClients = new Set<string>();

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
              nome_cifrado, nome_nonce, nome_tag, origem, primeiro_ad_id, primeiro_ctwa_clid, escritorio_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
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
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PRONTO', 'REGRA')`,
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

      // Atualiza automaticamente o dossiê, checklist e resumo cronológico para cada cliente impactado
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
      return { mensagens: persistedMessages, duplicado: false };
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
        narratives.push(`[Áudio Transcrito]: ${transcricao}`);
      }
    }

    const combinedText = narratives.join(' | ');
    const docTypes = docsRes.rows.map(r => String(r.tipo_doc));
    const currentTipoCaso = String(clienteRow.rows[0].tipo_caso || 'ECOMMERCE_ML');
    const detectedTipoCaso = detectCaseTypeFromText(combinedText, currentTipoCaso);

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
        ? narratives.slice(-5).join('\n• ')
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
    // Suporta tanto o envelope WABA completo (entry[].changes[]) quanto o formato direto do botão "Teste" do painel da Meta (field + value na raiz)
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

    const tipoCaso: TipoCasoJuridico =
      row.tipo_caso === 'RCV_BANCARIO' || row.tipo_caso === 'ECOMMERCE_ML' || row.tipo_caso === 'GERAL'
        ? row.tipo_caso
        : 'ECOMMERCE_ML';

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
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  async obterDossieCliente(clienteId: string, escritorioId?: string): Promise<DossieClienteCompleto | null> {
    const cliRes = await this.pool.query(
      `SELECT
        c.id,
        c.nome_cifrado, c.nome_nonce, c.nome_tag,
        c.origem, c.tipo_caso, c.status, c.checklist_status, c.faltando,
        c.resumo_cifrado, c.resumo_nonce, c.resumo_tag, c.updated_at,
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
        d.id AS doc_id,
        d.tipo_doc,
        d.media_kind,
        d.mime_type,
        d.estado AS doc_estado,
        d.nome_original_cifrado, d.nome_original_nonce, d.nome_original_tag
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
                    ? 'Imagem enviada no WhatsApp.jpg'
                    : normalizedTipo === 'audio'
                    ? 'Áudio de voz do cliente.ogg'
                    : 'Documento_Anexo.pdf'),
                estado: String(m.doc_estado)
              }
            }
          : {})
      };
    });

    // Vinculação inteligente de imagens/documentos avulsos com mensagens de texto explicativas subsequentes
    for (let i = 0; i < mensagens.length; i++) {
      const msg = mensagens[i]!;
      if ((msg.tipo === 'image' || msg.tipo === 'document') && !msg.texto) {
        // Procura a próxima mensagem de texto enviada pelo cliente logo em seguida para contextualizar a imagem avulsa
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
      checklist,
      mensagens
    };
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

    const currentTipoCaso: TipoCasoJuridico = payload.tipoCaso ?? cur.rows[0].tipo_caso ?? 'ECOMMERCE_ML';
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

  async obterConfiguracaoTenant(escritorioId?: string) {
    const res = await this.pool.query(
      `SELECT id, nome, whatsapp_waba_id, whatsapp_phone_number_id, whatsapp_display_phone
       FROM escritorios
       WHERE ($1::uuid IS NULL OR id = $1)
       ORDER BY created_at ASC
       LIMIT 1`,
      [escritorioId ?? null]
    );
    const tenant = res.rows[0];
    const statsRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total, MAX(recebido_em) AS ultimo_em
       FROM operacional.webhook_eventos`
    );
    const stats = statsRes.rows[0];
    return {
      escritorioId: tenant?.id ?? null,
      escritorioNome: tenant?.nome ?? 'Escritório Piloto',
      whatsappWabaId: tenant?.whatsapp_waba_id ?? process.env.WHATSAPP_WABA_ID ?? '',
      whatsappPhoneNumberId: tenant?.whatsapp_phone_number_id ?? '',
      whatsappDisplayPhone: tenant?.whatsapp_display_phone ?? '',
      tokenConfiguradoNoServidor: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
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
    const cleanId = payload.whatsappPhoneNumberId.trim() || null;
    const cleanPhone = payload.whatsappDisplayPhone?.trim() || null;

    await this.pool.query(
      `UPDATE escritorios
       SET whatsapp_waba_id = $2,
           whatsapp_phone_number_id = $3,
           whatsapp_display_phone = $4
       WHERE id = $1`,
      [target.escritorioId, cleanWabaId, cleanId, cleanPhone]
    );

    const tokenToUse = payload.accessToken?.trim() || process.env.WHATSAPP_ACCESS_TOKEN;
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

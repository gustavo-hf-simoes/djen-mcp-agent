import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { encryptValue, phoneHmac } from './whatsapp.crypto';

type JsonRecord = Record<string, unknown>;

export interface WhatsAppSecrets {
  encryptionKey?: Buffer;
  phoneHashKey?: Buffer;
}

interface IncomingMessage {
  id: string;
  phone: string;
  type: string;
  timestamp: Date;
  encryptedContent: ReturnType<typeof encryptValue>;
  encryptedName?: ReturnType<typeof encryptValue>;
  media?: {
    type: string;
    mediaId: string;
    mimeType?: string;
    encryptedFilename?: ReturnType<typeof encryptValue>;
  };
  adId?: string;
  ctwaClid?: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function encryptedColumns(prefix: string, value: ReturnType<typeof encryptValue> | undefined) {
  return value
    ? [value.ciphertext, value.nonce, value.tag]
    : [null, null, null];
}

/** Processa eventos recebidos e persiste dados sensíveis cifrados numa transação. */
export class WhatsAppWebhookService {
  constructor(
    private readonly pool: Pool,
    private readonly secrets: WhatsAppSecrets
  ) {}

  async receberWebhook(rawBody: Buffer): Promise<{ mensagens: number; duplicado: boolean }> {
    const encryptionKey = this.secrets.encryptionKey;
    const phoneHashKey = this.secrets.phoneHashKey;
    if (!encryptionKey || !phoneHashKey) {
      throw new Error('CONFIGURACAO_DE_CIFRAGEM_AUSENTE');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new Error('JSON_INVALIDO');
    }
    if (!isRecord(payload)) throw new Error('PAYLOAD_INVALIDO');

    const messages = this.extrairMensagens(payload, encryptionKey);
    const eventHash = createHash('sha256').update(rawBody).digest('hex');
    const encryptedEvent = encryptValue(rawBody, encryptionKey);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const eventInsert = await client.query(
        `INSERT INTO operacional.webhook_eventos (
          sha256_corpo, payload_cifrado, payload_nonce, payload_tag, assinatura_validada
        ) VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (sha256_corpo) DO NOTHING
        RETURNING id`,
        [eventHash, encryptedEvent.ciphertext, encryptedEvent.nonce, encryptedEvent.tag]
      );

      if (eventInsert.rows.length === 0) {
        await client.query('COMMIT');
        return { mensagens: 0, duplicado: true };
      }

      const eventId = eventInsert.rows[0].id as string;
      let persistedMessages = 0;
      for (const message of messages) {
        const phone = phoneHmac(message.phone, phoneHashKey);
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          [phone.hash]
        );

        let contact = await client.query(
          `SELECT cliente_id FROM operacional.cliente_telefones
           WHERE telefone_hmac = $1 FOR UPDATE`,
          [phone.hash]
        );

        let clientId: string;
        let source: 'LEAD' | 'ANTIGO' | 'NOVO';
        if (contact.rows.length > 0) {
          clientId = contact.rows[0].cliente_id as string;
          source = message.adId || message.ctwaClid ? 'LEAD' : 'ANTIGO';
        } else {
          source = message.adId || message.ctwaClid ? 'LEAD' : 'NOVO';
          const clientName = message.encryptedName;
          const clientInsert = await client.query(
            `INSERT INTO operacional.clientes (
              nome_cifrado, nome_nonce, nome_tag, origem, primeiro_ad_id, primeiro_ctwa_clid
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id`,
            [
              ...encryptedColumns('nome', clientName),
              source,
              message.adId ?? null,
              message.ctwaClid ?? null
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

        const messageInsert = await client.query(
          `INSERT INTO operacional.mensagens (
            whatsapp_message_id, webhook_evento_id, cliente_id, telefone_hmac,
            tipo, origem, ad_id, ctwa_clid, enviada_em,
            conteudo_cifrado, conteudo_nonce, conteudo_tag
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
            message.encryptedContent.tag
          ]
        );

        if (messageInsert.rows.length === 0) continue;
        persistedMessages++;

        if (message.media) {
          const encryptedMediaId = encryptValue(message.media.mediaId, encryptionKey);
          const encryptedFilename = message.media.encryptedFilename;
          await client.query(
            `INSERT INTO operacional.documentos (
              cliente_id, mensagem_id, media_kind, mime_type,
              media_id_cifrado, media_id_nonce, media_id_tag,
              nome_original_cifrado, nome_original_nonce, nome_original_tag
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              clientId,
              messageInsert.rows[0].id,
              message.media.type.toUpperCase(),
              message.media.mimeType ?? null,
              encryptedMediaId.ciphertext,
              encryptedMediaId.nonce,
              encryptedMediaId.tag,
              ...encryptedColumns('nome_original', encryptedFilename)
            ]
          );
        }
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

  private extrairMensagens(payload: JsonRecord, encryptionKey: Buffer): IncomingMessage[] {
    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    const result: IncomingMessage[] = [];

    for (const entry of entries) {
      if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
      for (const change of entry.changes) {
        if (!isRecord(change) || !isRecord(change.value)) continue;
        const value = change.value;
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
          const mimeType = optionalString(content.mime_type);
          const isMedia = ['audio', 'document', 'image', 'video', 'sticker'].includes(type);

          result.push({
            id,
            phone,
            type: ['text', 'audio', 'image', 'document', 'video', 'sticker'].includes(type) ? type : 'outro',
            timestamp: new Date(timestamp * 1000),
            encryptedContent: encryptValue(JSON.stringify(rawMessage), encryptionKey),
            ...(namesByPhone.has(phone)
              ? { encryptedName: encryptValue(namesByPhone.get(phone)!, encryptionKey) }
              : {}),
            ...(isMedia && mediaId
              ? { media: {
                  type,
                  mediaId,
                  ...(mimeType ? { mimeType } : {}),
                  ...(filename ? { encryptedFilename: encryptValue(filename, encryptionKey) } : {})
                } }
              : {}),
            ...(adId ? { adId } : {}),
            ...(ctwaClid ? { ctwaClid } : {})
          });
        }
      }
    }
    return result;
  }
}
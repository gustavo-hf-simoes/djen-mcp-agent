import type { Request, Response } from 'express';
import { constantTimeTextEqual, verifyMetaSignature } from './whatsapp.crypto';

export interface WhatsAppWebhookServicePort {
  receberWebhook(rawBody: Buffer): Promise<{ mensagens: number; duplicado: boolean }>;
}

export interface WhatsAppWebhookConfig {
  verifyToken?: string;
  appSecret?: string;
}

/** Implementa o handshake e a validação HTTP do webhook da Meta. */
export class WhatsAppWebhookController {
  constructor(
    private readonly service: WhatsAppWebhookServicePort,
    private readonly config: WhatsAppWebhookConfig
  ) {}

  verificar(req: Request, res: Response) {
    if (!this.config.verifyToken) {
      return res.status(503).send('WhatsApp webhook não configurado.');
    }
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (
      mode === 'subscribe' &&
      typeof token === 'string' &&
      typeof challenge === 'string' &&
      constantTimeTextEqual(token, this.config.verifyToken)
    ) {
      return res.status(200).type('text/plain').send(challenge);
    }
    return res.sendStatus(403);
  }

  async receber(req: Request, res: Response) {
    if (!this.config.appSecret) {
      return res.status(503).json({ error: 'WhatsApp webhook não configurado.' });
    }
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'Corpo JSON bruto obrigatório.' });
    }
    if (!verifyMetaSignature(req.body, req.header('x-hub-signature-256'), this.config.appSecret)) {
      return res.status(401).json({ error: 'Assinatura inválida.' });
    }

    try {
      const resultado = await this.service.receberWebhook(req.body);
      return res.status(200).json({ success: true, ...resultado });
    } catch (error) {
      const codigo = error instanceof Error ? error.message : 'ERRO_DESCONHECIDO';
      console.error('Falha ao persistir webhook WhatsApp:', codigo);
      const status = codigo === 'CONFIGURACAO_DE_CIFRAGEM_AUSENTE' ? 503 : 500;
      return res.status(status).json({ error: 'Não foi possível persistir o webhook.' });
    }
  }
}
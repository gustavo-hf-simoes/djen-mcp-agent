import type { Request, Response } from 'express';
import { constantTimeTextEqual, verifyMetaSignature } from './whatsapp.crypto';
import type {
  ClienteTriagemResumo,
  DossieClienteCompleto,
  TipoCasoJuridico
} from './whatsapp.service';

export interface WhatsAppWebhookServicePort {
  receberWebhook(rawBody: Buffer): Promise<{ mensagens: number; duplicado: boolean }>;
  listarClientes?(escritorioId?: string): Promise<ClienteTriagemResumo[]>;
  obterDossieCliente?(clienteId: string, escritorioId?: string): Promise<DossieClienteCompleto | null>;
  atualizarChecklistCliente?(
    clienteId: string,
    payload: {
      tipoCaso?: TipoCasoJuridico;
      itemKey?: string;
      recebido?: boolean;
      status?: 'INCOMPLETO' | 'PRONTO_PROCURACAO' | 'COMPLETO';
      resumoContexto?: string;
    },
    escritorioId?: string
  ): Promise<DossieClienteCompleto | null>;
  obterConfiguracaoTenant?(escritorioId?: string): Promise<{
    escritorioId: string | null;
    escritorioNome: string;
    whatsappPhoneNumberId: string;
    whatsappDisplayPhone: string;
  }>;
  salvarConfiguracaoTenant?(
    escritorioId: string | undefined,
    payload: { whatsappPhoneNumberId: string; whatsappDisplayPhone?: string }
  ): Promise<{
    escritorioId: string | null;
    escritorioNome: string;
    whatsappPhoneNumberId: string;
    whatsappDisplayPhone: string;
  }>;
  simularFluxoRealista?(
    cenario?: 'ECOMMERCE_ML' | 'RCV_BANCARIO'
  ): Promise<{ mensagens: number; duplicado: boolean }>;
}

export interface WhatsAppWebhookConfig {
  verifyToken?: string;
  appSecret?: string;
  allowSandboxWithoutAppSecret?: boolean;
}

/** Implementa o handshake da Meta e as rotas autenticadas da Estação de Triagem e Dossiê. */
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
    if (!this.config.appSecret && !this.config.allowSandboxWithoutAppSecret) {
      return res.status(503).json({ error: 'WhatsApp webhook não configurado.' });
    }
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'Corpo JSON bruto obrigatório.' });
    }
    if (
      this.config.appSecret &&
      !verifyMetaSignature(req.body, req.header('x-hub-signature-256'), this.config.appSecret)
    ) {
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

  async listarClientes(req: Request, res: Response) {
    try {
      if (!this.service.listarClientes) {
        return res.status(501).json({ error: 'Listagem de clientes não implementada.' });
      }
      const escritorioId = req.authUser?.role === 'MASTER' ? undefined : (req.authUser?.escritorioId ?? undefined);
      const items = await this.service.listarClientes(escritorioId);
      return res.status(200).json({ items });
    } catch (error) {
      console.error('Erro ao listar clientes da triagem WhatsApp:', error);
      return res.status(500).json({ error: 'Erro ao carregar fila de clientes do WhatsApp.' });
    }
  }

  async obterDossieCliente(req: Request, res: Response) {
    try {
      if (!this.service.obterDossieCliente) {
        return res.status(501).json({ error: 'Dossiê não implementado.' });
      }
      const clienteId = String(req.params.id || '');
      const escritorioId = req.authUser?.role === 'MASTER' ? undefined : (req.authUser?.escritorioId ?? undefined);
      const dossie = await this.service.obterDossieCliente(clienteId, escritorioId);
      if (!dossie) {
        return res.status(404).json({ error: 'Dossiê do cliente não encontrado.' });
      }
      return res.status(200).json(dossie);
    } catch (error) {
      console.error('Erro ao obter dossiê do cliente WhatsApp:', error);
      return res.status(500).json({ error: 'Erro ao carregar histórico e checklist do cliente.' });
    }
  }

  async atualizarChecklistCliente(req: Request, res: Response) {
    try {
      if (!this.service.atualizarChecklistCliente) {
        return res.status(501).json({ error: 'Atualização de checklist não implementada.' });
      }
      const clienteId = String(req.params.id || '');
      const escritorioId = req.authUser?.role === 'MASTER' ? undefined : (req.authUser?.escritorioId ?? undefined);
      const atualizado = await this.service.atualizarChecklistCliente(clienteId, req.body ?? {}, escritorioId);
      if (!atualizado) {
        return res.status(404).json({ error: 'Cliente não encontrado.' });
      }
      return res.status(200).json(atualizado);
    } catch (error) {
      console.error('Erro ao atualizar checklist do cliente:', error);
      return res.status(500).json({ error: 'Erro ao atualizar checklist do cliente.' });
    }
  }

  async obterConfiguracao(req: Request, res: Response) {
    try {
      const escritorioId = req.authUser?.escritorioId ?? undefined;
      const tenantConfig = this.service.obterConfiguracaoTenant
        ? await this.service.obterConfiguracaoTenant(escritorioId)
        : {
            escritorioId: escritorioId ?? null,
            escritorioNome: 'Escritório Piloto',
            whatsappPhoneNumberId: '',
            whatsappDisplayPhone: ''
          };

      return res.status(200).json({
        ...tenantConfig,
        verifyToken: this.config.verifyToken ?? 'djen-meta-verify-2026',
        hmacAtivo: Boolean(this.config.appSecret),
        webhookPath: '/webhook/whatsapp'
      });
    } catch (error) {
      console.error('Erro ao obter configuração WhatsApp do tenant:', error);
      return res.status(500).json({ error: 'Erro ao consultar configuração do webhook.' });
    }
  }

  async salvarConfiguracao(req: Request, res: Response) {
    try {
      if (!this.service.salvarConfiguracaoTenant) {
        return res.status(501).json({ error: 'Salvamento de configuração não suportado.' });
      }
      const escritorioId = req.authUser?.escritorioId ?? undefined;
      const { whatsappPhoneNumberId, whatsappDisplayPhone } = req.body ?? {};
      const salvo = await this.service.salvarConfiguracaoTenant(escritorioId, {
        whatsappPhoneNumberId: String(whatsappPhoneNumberId ?? ''),
        ...(whatsappDisplayPhone ? { whatsappDisplayPhone: String(whatsappDisplayPhone) } : {})
      });
      return res.status(200).json({
        ...salvo,
        verifyToken: this.config.verifyToken ?? 'djen-meta-verify-2026',
        hmacAtivo: Boolean(this.config.appSecret),
        webhookPath: '/webhook/whatsapp'
      });
    } catch (error) {
      console.error('Erro ao salvar Phone Number ID da Meta:', error);
      return res.status(500).json({ error: 'Não foi possível salvar o Phone Number ID.' });
    }
  }

  async simularFluxo(req: Request, res: Response) {
    try {
      if (!this.service.simularFluxoRealista) {
        return res.status(501).json({ error: 'Simulador não disponível.' });
      }
      const cenario = req.body?.cenario === 'RCV_BANCARIO' ? 'RCV_BANCARIO' : 'ECOMMERCE_ML';
      const resultado = await this.service.simularFluxoRealista(cenario);
      return res.status(200).json({
        success: true,
        cenario,
        ...resultado
      });
    } catch (error) {
      console.error('Erro ao simular fluxo realista WhatsApp:', error);
      return res.status(500).json({ error: 'Erro ao simular mensagens no pipeline do WhatsApp.' });
    }
  }
}

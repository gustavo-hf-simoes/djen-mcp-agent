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
  obterArquivoMidia?(
    documentoId: string,
    escritorioId?: string
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null>;
  gerarZipPastaCliente?(
    clienteId: string,
    escritorioId?: string
  ): Promise<{ zipBuffer: Buffer; zipFilename: string } | null>;
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
    whatsappWabaId?: string;
    whatsappPhoneNumberId: string;
    whatsappDisplayPhone: string;
    tokenConfiguradoNoServidor?: boolean;
    totalEventosRecebidos?: number;
    ultimoWebhookEm?: string | null;
  }>;
  salvarConfiguracaoTenant?(
    escritorioId: string | undefined,
    payload: {
      whatsappWabaId?: string;
      whatsappPhoneNumberId: string;
      whatsappDisplayPhone?: string;
      accessToken?: string;
    }
  ): Promise<{
    escritorioId: string | null;
    escritorioNome: string;
    whatsappWabaId?: string;
    whatsappPhoneNumberId: string;
    whatsappDisplayPhone: string;
    tokenConfiguradoNoServidor?: boolean;
    metaSubscribed?: boolean;
    totalEventosRecebidos?: number;
    ultimoWebhookEm?: string | null;
  }>;
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

  private extrairEscritorioId(req: Request): string | undefined {
    if (req.authUser?.escritorioId) {
      return req.authUser.escritorioId;
    }
    if (req.authUser?.role === 'MASTER') {
      const headerTenant = req.headers['x-tenant-id'];
      if (typeof headerTenant === 'string' && headerTenant.trim()) {
        return headerTenant.trim();
      }
      const queryTenant = req.query.escritorioId;
      if (typeof queryTenant === 'string' && queryTenant.trim()) {
        return queryTenant.trim();
      }
    }
    return undefined;
  }

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
      console.log('✅ [Meta Webhook] Handshake GET verificado com sucesso.');
      return res.status(200).type('text/plain').send(challenge);
    }
    console.warn('⚠️ [Meta Webhook] Falha na verificação GET (token divergente).');
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
      console.warn('⚠️ [Meta Webhook] Assinatura x-hub-signature-256 inválida.');
      return res.status(401).json({ error: 'Assinatura inválida.' });
    }

    try {
      const resultado = await this.service.receberWebhook(req.body);
      console.log(
        `📲 [Meta Webhook] Evento processado: ${resultado.mensagens} mensagem(ns) salva(s) (duplicado=${resultado.duplicado}).`
      );
      return res.status(200).json({ success: true, ...resultado });
    } catch (error) {
      const codigo = error instanceof Error ? error.message : 'ERRO_DESCONHECIDO';
      console.error('❌ [Meta Webhook] Falha ao persistir webhook WhatsApp:', codigo);
      const status = codigo === 'CONFIGURACAO_DE_CIFRAGEM_AUSENTE' ? 503 : 500;
      return res.status(status).json({ error: 'Não foi possível persistir o webhook.' });
    }
  }

  async listarClientes(req: Request, res: Response) {
    try {
      if (!this.service.listarClientes) {
        return res.status(501).json({ error: 'Listagem de clientes não implementada.' });
      }
      const escritorioId = this.extrairEscritorioId(req);
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
      const escritorioId = this.extrairEscritorioId(req);
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

  async servirArquivoMidia(req: Request, res: Response) {
    try {
      if (!this.service.obterArquivoMidia) {
        return res.status(501).json({ error: 'Download de mídia não implementado.' });
      }
      const documentoId = String(req.params.id || '');
      const escritorioId = this.extrairEscritorioId(req);
      const arquivo = await this.service.obterArquivoMidia(documentoId, escritorioId);
      if (!arquivo) {
        return res.status(404).json({ error: 'Arquivo não encontrado na pasta do cliente.' });
      }
      const disposition = req.query.download === '1' ? 'attachment' : 'inline';
      res.setHeader('Content-Type', arquivo.mimeType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${arquivo.filename}"`);
      return res.status(200).send(arquivo.buffer);
    } catch (error) {
      console.error('Erro ao servir arquivo da pasta do cliente:', error);
      return res.status(500).json({ error: 'Não foi possível abrir o arquivo da pasta do cliente.' });
    }
  }

  async baixarZipPastaCliente(req: Request, res: Response) {
    try {
      if (!this.service.gerarZipPastaCliente) {
        return res.status(501).json({ error: 'Exportação ZIP não implementada.' });
      }
      const clienteId = String(req.params.id || '');
      const escritorioId = this.extrairEscritorioId(req);
      const pacote = await this.service.gerarZipPastaCliente(clienteId, escritorioId);
      if (!pacote) {
        return res.status(404).json({ error: 'Pasta do cliente não encontrada.' });
      }
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${pacote.zipFilename}"`);
      return res.status(200).send(pacote.zipBuffer);
    } catch (error) {
      console.error('Erro ao gerar ZIP da pasta do cliente:', error);
      return res.status(500).json({ error: 'Erro ao gerar pacote ZIP da pasta do cliente.' });
    }
  }

  async atualizarChecklistCliente(req: Request, res: Response) {
    try {
      if (!this.service.atualizarChecklistCliente) {
        return res.status(501).json({ error: 'Atualização de checklist não implementada.' });
      }
      const clienteId = String(req.params.id || '');
      const escritorioId = this.extrairEscritorioId(req);
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

  
  
  async reprocessarMidiasCliente(req: Request, res: Response) {
    try {
      const id = String(req.params.id ?? '').trim();
      if (!id) return res.status(400).json({ error: 'ID do cliente inválido.' });
      const escritorioId = this.extrairEscritorioId(req);
      const resultado = await this.service.processarMidiasPendentesCliente(id);
      const dossie = await this.service.obterDossieCliente(id, escritorioId);
      return res.json({ success: true, processados: resultado.processados, dossie });
    } catch (error) {
      console.error('Erro ao reprocessar mídias do cliente:', error);
      return res.status(500).json({ error: 'Falha ao reprocessar mídias.' });
    }
  }

  async extrairDocumentosCliente(req: Request, res: Response) {
    try {
      const id = String(req.params.id ?? '').trim();
      if (!id) return res.status(400).json({ error: 'ID do cliente inválido.' });
      const escritorioId = this.extrairEscritorioId(req);
      const qualificacao = await this.service.processarExtracaoDocumentosCliente(id, escritorioId);
      return res.json({ success: true, qualificacao });
    } catch (error) {
      console.error('Erro ao extrair dados de documentos do cliente:', error);
      return res.status(500).json({ error: 'Falha no processamento de OCR/IA dos documentos.' });
    }
  }

  async atualizarQualificacaoCliente(req: Request, res: Response) {
    try {
      const id = String(req.params.id ?? '').trim();
      if (!id) return res.status(400).json({ error: 'ID do cliente inválido.' });
      const escritorioId = this.extrairEscritorioId(req);
      const dossieAtualizado = await this.service.atualizarQualificacaoCliente(id, req.body ?? {}, escritorioId);
      if (!dossieAtualizado) return res.status(404).json({ error: 'Cliente não encontrado.' });
      return res.json(dossieAtualizado);
    } catch (error) {
      console.error('Erro ao atualizar qualificação do cliente:', error);
      return res.status(500).json({ error: 'Erro ao atualizar dados de qualificação.' });
    }
  }

  async gerarKitContratual(req: Request, res: Response) {
    try {
      const id = String(req.params.id ?? '').trim();
      if (!id) return res.status(400).json({ error: 'ID do cliente inválido.' });
      const escritorioId = this.extrairEscritorioId(req);
      const doc = await this.service.gerarKitContratualCliente(id, escritorioId);
      if (!doc) return res.status(404).json({ error: 'Cliente não encontrado para emissão do kit contratual.' });

      if (req.query.format === 'json') {
        return res.json({ success: true, filename: doc.filename, caminhoFisico: doc.caminhoFisico });
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(doc.html);
    } catch (error) {
      console.error('Erro ao gerar kit contratual ASO:', error);
      return res.status(500).json({ error: 'Falha ao gerar procuração e contrato de honorários.' });
    }
  }

  async obterConfiguracao(req: Request, res: Response) {
    try {
      const escritorioId = this.extrairEscritorioId(req);
      const tenantConfig = this.service.obterConfiguracaoTenant
        ? await this.service.obterConfiguracaoTenant(escritorioId)
        : {
            escritorioId: escritorioId ?? null,
            escritorioNome: 'Escritório Piloto',
            whatsappPhoneNumberId: '',
            whatsappDisplayPhone: '',
            totalEventosRecebidos: 0,
            ultimoWebhookEm: null
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
      const escritorioId = this.extrairEscritorioId(req);
      const { whatsappWabaId, whatsappPhoneNumberId, whatsappDisplayPhone, accessToken } = req.body ?? {};
      const salvo = await this.service.salvarConfiguracaoTenant(escritorioId, {
        whatsappPhoneNumberId: String(whatsappPhoneNumberId ?? ''),
        ...(whatsappWabaId ? { whatsappWabaId: String(whatsappWabaId) } : {}),
        ...(whatsappDisplayPhone ? { whatsappDisplayPhone: String(whatsappDisplayPhone) } : {}),
        ...(accessToken ? { accessToken: String(accessToken) } : {})
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
}

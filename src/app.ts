import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DjenController } from './modules/djen/djen.controller';
import type { DjenReadController } from './modules/djen/djen-read.controller';
import type { WhatsAppWebhookController } from './modules/operacional/whatsapp.controller';
import { AuthController, requireAuth, requireRole } from './modules/auth/auth.controller';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';

export const API_ENDPOINTS = {
  swagger: '/api-docs',
  openapi: '/openapi.json',
  authLogin: '/api/v1/auth/login',
  authMe: '/api/v1/auth/me',
  authUsuarios: '/api/v1/auth/usuarios',
  authEscritorio: '/api/v1/auth/escritorio',
  djenComunicacoes: '/api/v1/comunicacao',
  djenStatus: '/api/djen/intimacoes/:id/status',
  publicacaoStatus: '/api/v1/publicacoes/:id/status',
  publicacoesSincronizar: '/api/v1/publicacoes/sincronizar',
  publicacoesDashboard: '/api/v1/publicacoes/dashboard',
  publicacoes: '/api/v1/publicacoes',
  processos: '/api/v1/processos',
  processoPublicacoes: '/api/v1/processos/:id/publicacoes',
  processoCertidoesZip: '/api/v1/processos/:id/certidoes-zip',
  tribunais: '/api/v1/tribunais',
  operacionalClientes: '/api/v1/operacional/clientes',
  operacionalClienteDossie: '/api/v1/operacional/clientes/:id/dossie',
  operacionalClienteChecklist: '/api/v1/operacional/clientes/:id/checklist',
  operacionalClientePastaZip: '/api/v1/operacional/clientes/:id/pasta-zip',
  operacionalMidia: '/api/v1/operacional/midia/:id',
  operacionalConfig: '/api/v1/operacional/config',
  politicaPrivacidade: '/politica-de-privacidade',
  whatsappWebhook: '/webhook/whatsapp'
} as const;

export function mapearEndpoints(baseUrl: string, incluirWhatsApp = true): string {
  const endpoints = [
    { nome: 'Swagger UI', metodo: 'GET', caminho: API_ENDPOINTS.swagger },
    { nome: 'OpenAPI JSON', metodo: 'GET', caminho: API_ENDPOINTS.openapi },
    { nome: 'Login SaaS', metodo: 'POST', caminho: API_ENDPOINTS.authLogin },
    { nome: 'Sessão Atual', metodo: 'GET', caminho: API_ENDPOINTS.authMe },
    { nome: 'Gestão SaaS (Master/Admin)', metodo: 'GET', caminho: API_ENDPOINTS.authUsuarios },
    { nome: 'Consulta de Comunicações', metodo: 'GET', caminho: API_ENDPOINTS.djenComunicacoes },
    { nome: 'Sincronizar DJEN Agora', metodo: 'POST', caminho: API_ENDPOINTS.publicacoesSincronizar },
    { nome: 'Dashboard de publicações', metodo: 'GET', caminho: API_ENDPOINTS.publicacoesDashboard },
    { nome: 'Lista de processos', metodo: 'GET', caminho: API_ENDPOINTS.processos },
    { nome: 'Publicações do processo', metodo: 'GET', caminho: API_ENDPOINTS.processoPublicacoes },
    { nome: 'Atualização de status', metodo: 'PATCH', caminho: API_ENDPOINTS.publicacaoStatus },
    { nome: 'Tribunais', metodo: 'GET', caminho: API_ENDPOINTS.tribunais },
    ...(incluirWhatsApp
      ? [
          { nome: 'Verificação do webhook WhatsApp', metodo: 'GET', caminho: API_ENDPOINTS.whatsappWebhook },
          { nome: 'Recebimento do webhook WhatsApp', metodo: 'POST', caminho: API_ENDPOINTS.whatsappWebhook }
        ]
      : [])
  ];

  return endpoints
    .map(endpoint => `🔗 ${endpoint.nome}: ${endpoint.metodo} ${baseUrl}${endpoint.caminho}`)
    .join('\n');
}

export function createApp(
  djenController: DjenController,
  whatsappController?: WhatsAppWebhookController,
  djenReadController?: DjenReadController,
  authController?: AuthController
) {
  const app = express();
  app.use(cors());
  app.use(API_ENDPOINTS.swagger, swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get(API_ENDPOINTS.openapi, (_req, res) => res.json(openApiDocument));

  if (whatsappController) {
    app.get(API_ENDPOINTS.whatsappWebhook, (req, res) => whatsappController.verificar(req, res));
    app.post(
      API_ENDPOINTS.whatsappWebhook,
      express.raw({ type: 'application/json', limit: '3mb' }),
      (req, res) => whatsappController.receber(req, res)
    );
  }

  app.use(express.json({ limit: '5mb' }));

  const protect = requireAuth(Boolean(authController));

  if (authController) {
    app.post(API_ENDPOINTS.authLogin, (req, res) => authController.login(req, res));
    app.get(API_ENDPOINTS.authMe, protect, (req, res) => authController.me(req, res));
    app.patch(API_ENDPOINTS.authEscritorio, protect, (req, res) => authController.atualizarEscritorio(req, res));
    app.get(
      API_ENDPOINTS.authUsuarios,
      protect,
      requireRole('MASTER'),
      (req, res) => authController.listarUsuariosETenants(req, res)
    );
  }

  app.get(API_ENDPOINTS.djenComunicacoes, protect, (req, res) => djenController.listar(req, res));
  app.post(API_ENDPOINTS.publicacoesSincronizar, protect, (req, res) => djenController.sincronizar(req, res));
  app.patch(API_ENDPOINTS.djenStatus, protect, (req, res) => djenController.atualizarStatus(req, res));
  app.patch(API_ENDPOINTS.publicacaoStatus, protect, (req, res) => djenController.atualizarStatus(req, res));

  if (djenReadController) {
    app.get(API_ENDPOINTS.publicacoesDashboard, protect, (req, res) => djenReadController.dashboard(req, res));
    app.get(API_ENDPOINTS.processos, protect, (req, res) => djenReadController.listarProcessos(req, res));
    app.get(API_ENDPOINTS.processoPublicacoes, protect, (req, res) => djenReadController.listarPublicacoesDoProcesso(req, res));
    app.get(API_ENDPOINTS.processoCertidoesZip, protect, (req, res) => djenReadController.baixarCertidoesDoProcesso(req, res));
    app.get(API_ENDPOINTS.publicacoes, protect, (req, res) => djenReadController.listarPublicacoes(req, res));
    app.get(API_ENDPOINTS.tribunais, protect, (req, res) => djenReadController.listarTribunais(req, res));
  }

  if (whatsappController) {
    app.get(API_ENDPOINTS.operacionalClientes, protect, (req, res) => whatsappController.listarClientes(req, res));
    app.get(API_ENDPOINTS.operacionalClienteDossie, protect, (req, res) => whatsappController.obterDossieCliente(req, res));
    app.patch(API_ENDPOINTS.operacionalClienteChecklist, protect, (req, res) => whatsappController.atualizarChecklistCliente(req, res));
    app.get(API_ENDPOINTS.operacionalClientePastaZip, protect, (req, res) => whatsappController.baixarZipPastaCliente(req, res));
    app.get(API_ENDPOINTS.operacionalMidia, protect, (req, res) => whatsappController.servirArquivoMidia(req, res));
    app.get(API_ENDPOINTS.operacionalConfig, protect, (req, res) => whatsappController.obterConfiguracao(req, res));
    app.put(API_ENDPOINTS.operacionalConfig, protect, (req, res) => whatsappController.salvarConfiguracao(req, res));
  }

  app.get(API_ENDPOINTS.politicaPrivacidade, (_req, res) => {
    res
      .status(200)
      .type('text/html; charset=utf-8')
      .send(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Política de Privacidade - GHFS Jurídico SaaS</title></head>
<body style="font-family:sans-serif;max-width:720px;margin:40px auto;line-height:1.6;color:#111">
  <h1>Política de Privacidade e Proteção de Dados (LGPD) — GHFS Jurídico</h1>
  <p>O sistema <strong>GHFS Jurídico</strong> processa comunicações judiciais (DJEN) e mensagens de triagem via WhatsApp Business Cloud API exclusivamente em nome dos escritórios de advocacia contratantes.</p>
  <p>Todos os dados pessoais, números de telefone, áudios e documentos são armazenados com criptografia autenticada (AES-256-GCM) e utilizados unicamente para instrução processual e atendimento jurídico autorizado pelo titular.</p>
  <p>Para solicitar exclusão de dados ou esclarecimentos: <code>gustavo@ghfs.adv.br</code>.</p>
</body>
</html>`);
  });

  // Serve o build estático do Frontend (Monorepo unificado para Túnel ou Deploy em Nuvem)
  const frontendDistPath = join(process.cwd(), 'frontend', 'dist');
  if (existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    app.get(/^(?!\/api\/|\/webhook\/|\/api-docs|\/openapi\.json).*/, (_req, res) => {
      res.sendFile(join(frontendDistPath, 'index.html'));
    });
  }

  return app;
}

import express from 'express';
import cors from 'cors';
import type { DjenController } from './modules/djen/djen.controller';
import type { DjenReadController } from './modules/djen/djen-read.controller';
import type { WhatsAppWebhookController } from './modules/operacional/whatsapp.controller';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';

export const API_ENDPOINTS = {
  swagger: '/api-docs',
  openapi: '/openapi.json',
  djenComunicacoes: '/api/v1/comunicacao',
  djenStatus: '/api/djen/intimacoes/:id/status',
  publicacaoStatus: '/api/v1/publicacoes/:id/status',
  publicacoesDashboard: '/api/v1/publicacoes/dashboard',
  publicacoes: '/api/v1/publicacoes',
  processos: '/api/v1/processos',
  processoPublicacoes: '/api/v1/processos/:id/publicacoes',
  tribunais: '/api/v1/tribunais',
  whatsappWebhook: '/webhook/whatsapp'
} as const;

export function mapearEndpoints(baseUrl: string, incluirWhatsApp = true): string {
  const endpoints = [
    { nome: 'Swagger UI', metodo: 'GET', caminho: API_ENDPOINTS.swagger },
    { nome: 'OpenAPI JSON', metodo: 'GET', caminho: API_ENDPOINTS.openapi },
    { nome: 'Consulta de Comunicações', metodo: 'GET', caminho: API_ENDPOINTS.djenComunicacoes },
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
  djenReadController?: DjenReadController
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

  app.use(express.json());

  app.get(API_ENDPOINTS.djenComunicacoes, (req, res) => djenController.listar(req, res));
  app.patch(API_ENDPOINTS.djenStatus, (req, res) => djenController.atualizarStatus(req, res));
  app.patch(API_ENDPOINTS.publicacaoStatus, (req, res) => djenController.atualizarStatus(req, res));

  if (djenReadController) {
    app.get(API_ENDPOINTS.publicacoesDashboard, (req, res) => djenReadController.dashboard(req, res));
    app.get(API_ENDPOINTS.processos, (req, res) => djenReadController.listarProcessos(req, res));
    app.get(API_ENDPOINTS.processoPublicacoes, (req, res) => djenReadController.listarPublicacoesDoProcesso(req, res));
    app.get(API_ENDPOINTS.publicacoes, (req, res) => djenReadController.listarPublicacoes(req, res));
    app.get(API_ENDPOINTS.tribunais, (req, res) => djenReadController.listarTribunais(req, res));
  }

  return app;
}
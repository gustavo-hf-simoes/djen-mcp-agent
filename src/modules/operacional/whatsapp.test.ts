import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { createApp } from '../../app';
import { DjenController, type DjenServicePort } from '../djen/djen.controller';
import { WhatsAppWebhookController } from './whatsapp.controller';

async function startServer(whatsappController: WhatsAppWebhookController) {
  const djenService: DjenServicePort = {
    async consultarDjen() { return { items: [] }; },
    async atualizarStatus() { return { success: true }; }
  };
  const server = createApp(new DjenController(djenService), whatsappController)
    .listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: ReturnType<typeof createApp> extends never ? never : import('node:http').Server) {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

test('serve a especificação OpenAPI das rotas documentadas', async () => {
  const controller = new WhatsAppWebhookController(
    { async receberWebhook() { return { mensagens: 0, duplicado: false }; } },
    { verifyToken: 'verify-secret', appSecret: 'app-secret' }
  );
  const { server, baseUrl } = await startServer(controller);

  try {
    const response = await fetch(`${baseUrl}/openapi.json`);
    const document = await response.json() as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    assert.equal(response.status, 200);
    assert.equal(document.openapi, '3.0.3');
    assert.ok(document.paths['/api/v1/comunicacao']);
    assert.ok(document.paths['/api/djen/intimacoes/{id}/status']);
    assert.ok(document.paths['/webhook/whatsapp']);
  } finally {
    await closeServer(server);
  }
});

test('GET webhook valida token da Meta e devolve o challenge', async () => {
  const controller = new WhatsAppWebhookController(
    { async receberWebhook() { return { mensagens: 0, duplicado: false }; } },
    { verifyToken: 'verify-secret', appSecret: 'app-secret' }
  );
  const { server, baseUrl } = await startServer(controller);

  try {
    const response = await fetch(
      `${baseUrl}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=verify-secret&hub.challenge=test-challenge`
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'test-challenge');
  } finally {
    await closeServer(server);
  }
});

test('POST webhook valida HMAC sobre o corpo bruto antes de processar', async () => {
  const appSecret = 'test-app-secret';
  const body = Buffer.from('{"object":"whatsapp_business_account","entry":[]}', 'utf8');
  let receivedBody: Buffer | undefined;
  const controller = new WhatsAppWebhookController(
    {
      async receberWebhook(rawBody) {
        receivedBody = Buffer.from(rawBody);
        return { mensagens: 0, duplicado: false };
      }
    },
    { verifyToken: 'verify-secret', appSecret }
  );
  const { server, baseUrl } = await startServer(controller);

  try {
    const signature = `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`;
    const response = await fetch(`${baseUrl}/webhook/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
      body
    });
    assert.equal(response.status, 200);
    assert.deepEqual(receivedBody, body);

    const invalidSignature = await fetch(`${baseUrl}/webhook/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=00' },
      body
    });
    assert.equal(invalidSignature.status, 401);
    assert.deepEqual(receivedBody, body);
  } finally {
    await closeServer(server);
  }
});

import { gerarHtmlKitContratualAso } from './documento-contratual.service';

test('gerarHtmlKitContratualAso monta kit documental com procuração, declarações e contrato ASO', () => {
  const html = gerarHtmlKitContratualAso({
    nomeCliente: 'Maria da Silva',
    cpf: '123.456.789-00',
    rg: '9876543 SSP/PR',
    endereco: 'Av. Brasil, nº 1000, Centro',
    cidade: 'Maringá',
    uf: 'PR',
    telefone: '(44) 99999-8888',
    objetoContrato: 'Ação Revisional de Contrato de Empréstimo Bancário'
  });

  assert.ok(html.includes('PROCURAÇÃO'));
  assert.ok(html.includes('AD JUDICIA'));
  assert.ok(html.includes('DECLARAÇÃO DE HIPOSSUFICIÊNCIA'));
  assert.ok(html.includes('DECLARAÇÃO DE RESIDÊNCIA'));
  assert.ok(html.includes('CONTRATO DE HONORÁRIOS'));
  assert.ok(html.includes('MARIA DA SILVA'));
  assert.ok(html.includes('123.456.789-00'));
  assert.ok(html.includes('Av. Brasil, nº 1000'));
  assert.ok(html.includes('ANDRÉ SANTOS DE OLIVEIRA'));
  assert.ok(html.includes('69.161'));
  assert.ok(html.includes('Londrina'));
  assert.ok(html.includes('window.print()'));
});

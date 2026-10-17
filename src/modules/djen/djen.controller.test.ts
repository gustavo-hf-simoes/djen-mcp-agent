import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { createApp } from '../../app';
import { DjenController, type DjenServicePort } from './djen.controller';
import { htmlParaTexto } from './html-text';
import { respostaPodeSerCacheadaIndefinidamente } from './djen-cache';
import { parseOfficialDjenResponse } from './official-response';

test('preserva o corpo original e calcula hash verificável', () => {
  const body = Buffer.from('{\n  "items": []\n}', 'utf8');
  const response = parseOfficialDjenResponse(body);

  assert.strictEqual(response.body, body);
  assert.equal(response.sha256, '3a42d346c00ddcf61ff8b82dfe2cd58419f7fdddc203eaec775dd5582468d937');
  assert.deepEqual(response.json, { items: [] });
});

test('cacheia sem expiração somente pesquisas com data final passada', () => {
  const hoje = new Date('2026-10-14T12:00:00.000Z');

  assert.equal(
    respostaPodeSerCacheadaIndefinidamente(new URLSearchParams('dataDisponibilizacaoFim=2026-10-13'), hoje),
    true
  );
  assert.equal(
    respostaPodeSerCacheadaIndefinidamente(new URLSearchParams('dataDisponibilizacaoFim=2026-10-14'), hoje),
    false
  );
  assert.equal(respostaPodeSerCacheadaIndefinidamente(new URLSearchParams(), hoje), false);
});

test('converte o HTML do DJEN em texto legível e decodifica entidades', () => {
  const texto = htmlParaTexto(
    '<section><b>DESPACHO/DECIS&Atilde;O</b></section><p>Vistos.</p><p>Intime-se.</p>'
  );

  assert.doesNotMatch(texto, /<[^>]+>/);
  assert.match(texto, /DESPACHO\/DECISÃO/);
  assert.match(texto, /Vistos\.\s+Intime-se\./);
});

test('GET /api/v1/comunicacao encaminha filtros e retorna o JSON sem alterações', async () => {
  const respostaDjen = {
    count: 1,
    items: [{ id: 987, numero_processo: '0000000-00.2026.8.16.0000' }],
    pagination: { page: 3, pageSize: 20 }
  };
  let chamadas = 0;
  let filtrosRecebidos: URLSearchParams | undefined;
  const service: DjenServicePort = {
    async consultarDjen(filtros) {
      chamadas++;
      filtrosRecebidos = new URLSearchParams(filtros);
      return respostaDjen;
    },
    async atualizarStatus() {
      return { success: true };
    }
  };
  const server = createApp(new DjenController(service)).listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/comunicacao?numeroOab=69161&ufOab=PR&pagina=3&itensPorPagina=20&numeroProcesso=0000000-00.2026.8.16.0000`
    );
    const corpoResposta = await response.json();

    assert.equal(response.status, 200);
    assert.equal(chamadas, 1);
    assert.equal(filtrosRecebidos?.get('pagina'), '3');
    assert.equal(filtrosRecebidos?.get('itensPorPagina'), '20');
    assert.equal(filtrosRecebidos?.get('numeroProcesso'), '0000000-00.2026.8.16.0000');
    assert.deepEqual(corpoResposta, respostaDjen);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});

test('GET /api/v1/comunicacao responde 500 quando a consulta falha', async () => {
  const service: DjenServicePort = {
    async consultarDjen() {
      throw new Error('Falha simulada');
    },
    async atualizarStatus() {
      return { success: true };
    }
  };
  const server = createApp(new DjenController(service)).listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/comunicacao`);

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Falha simulada' });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});
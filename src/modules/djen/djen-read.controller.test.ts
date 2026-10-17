import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { createApp } from '../../app';
import { DjenReadController } from './djen-read.controller';
import { DjenReadService } from './application/djen-read.service';
import type { PublicacaoRow } from './application/publicacao.dto';
import type {
  DashboardCounts,
  DjenReadFilters,
  DjenReadRepositoryPort,
  PaginatedRows,
  ProcessoResumoRow
} from './infrastructure/djen-read.repository';
import { DjenController, type DjenServicePort } from './djen.controller';

const processoId = '11111111-1111-4111-8111-111111111111';

const publication: PublicacaoRow = {
  id: '22222222-2222-4222-8222-222222222222',
  processo_id: processoId,
  numero_cnj: '0000000-00.2026.8.16.0000',
  tribunal: 'TJPR',
  orgao_julgador: 'Turma Recursal',
  data_disponibilizacao: '2026-10-16',
  data_publicacao: '2026-10-19',
  teor_comunicacao: 'Prazo de 2 dias úteis.',
  status_leitura: 'PENDENTE',
  dados_djen: {
    tipoComunicacao: 'Intimação',
    texto: '<p>Prazo de 2 dias úteis.</p>',
    hash: 'certificate-hash',
    destinatarios: [{ nome: 'Parte autora', polo: 'A' }]
  }
};

const processSummary: ProcessoResumoRow = {
  id: processoId,
  numero_cnj: publication.numero_cnj,
  tribunal: 'TJPR',
  orgao_julgador: 'Turma Recursal',
  quantidade_publicacoes: 2,
  ultima_data_publicacao: '2026-10-19',
  ultima_publicacao_id: publication.id,
  ultimo_status: 'PENDENTE',
  ultima_tipo: 'Intimação'
};

class FakeReadRepository implements DjenReadRepositoryPort {
  async listarProcessos(): Promise<PaginatedRows<ProcessoResumoRow>> {
    return { total: 1, items: [processSummary] };
  }

  async listarPublicacoesDoProcesso(): Promise<PaginatedRows<PublicacaoRow>> {
    return { total: 1, items: [publication] };
  }

  async listarPublicacoes(
    _filters: DjenReadFilters,
    _pagina: number,
    _itensPorPagina: number
  ): Promise<PaginatedRows<PublicacaoRow>> {
    return { total: 1, items: [publication] };
  }

  async contarDashboard(): Promise<DashboardCounts> {
    return { totalPublicacoes: 1, totalProcessos: 1, porStatus: { PENDENTE: 1 } };
  }
}

test('expõe processos agrupados, publicações limpas e resumo para dashboard', async () => {
  const djenService: DjenServicePort = {
    async consultarDjen() { return { items: [] }; },
    async atualizarStatus() { return { success: true }; }
  };
  const app = createApp(
    new DjenController(djenService),
    undefined,
    new DjenReadController(new DjenReadService(new FakeReadRepository()))
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const processResponse = await fetch(`${baseUrl}/api/v1/processos?numeroOab=69161&ufOab=PR`);
    const processBody = await processResponse.json() as {
      items: Array<{ id: string; quantidadePublicacoes: number; homepageTribunal: string }>;
      pagination: { totalItems: number };
    };
    assert.equal(processResponse.status, 200);
    assert.equal(processBody.items[0]?.id, processoId);
    assert.equal(processBody.items[0]?.quantidadePublicacoes, 2);
    assert.equal(processBody.items[0]?.homepageTribunal, 'https://www.tjpr.jus.br/');
    assert.equal(processBody.pagination.totalItems, 1);

    const publicationsResponse = await fetch(`${baseUrl}/api/v1/processos/${processoId}/publicacoes`);
    const publicationsBody = await publicationsResponse.json() as {
      items: Array<{ texto: string; textoParaCopiar: string; estimativaPrazoFinal: { dataFinal: string | null } }>;
    };
    assert.equal(publicationsResponse.status, 200);
    assert.equal(publicationsBody.items[0]?.texto, 'Prazo de 2 dias úteis.');
    assert.doesNotMatch(publicationsBody.items[0]?.textoParaCopiar ?? '', /Parte autora/);
    assert.equal(publicationsBody.items[0]?.estimativaPrazoFinal.dataFinal, '2026-10-21');

    const dashboardResponse = await fetch(`${baseUrl}/api/v1/publicacoes/dashboard`);
    const dashboardBody = await dashboardResponse.json() as {
      contagens: { totalPublicacoes: number; totalProcessos: number };
      ultimasPublicacoes: unknown[];
    };
    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboardBody.contagens.totalPublicacoes, 1);
    assert.equal(dashboardBody.contagens.totalProcessos, 1);
    assert.equal(dashboardBody.ultimasPublicacoes.length, 1);

    const publicListResponse = await fetch(`${baseUrl}/api/v1/publicacoes?status=PENDENTE`);
    const publicListBody = await publicListResponse.json() as { items: Array<{ texto: string }> };
    assert.equal(publicListResponse.status, 200);
    assert.equal(publicListBody.items[0]?.texto, 'Prazo de 2 dias úteis.');

    const tribunalsResponse = await fetch(`${baseUrl}/api/v1/tribunais`);
    const tribunalsBody = await tribunalsResponse.json() as { items: Array<{ sigla: string; homepage: string }> };
    assert.equal(tribunalsResponse.status, 200);
    assert.ok(tribunalsBody.items.some(item => item.sigla === 'TJPR'));

    const statusResponse = await fetch(`${baseUrl}/api/v1/publicacoes/${publication.id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'LIDO' })
    });
    assert.equal(statusResponse.status, 200);
    assert.deepEqual(await statusResponse.json(), { success: true });

    const specResponse = await fetch(`${baseUrl}/openapi.json`);
    const spec = await specResponse.json() as { paths: Record<string, unknown> };
    assert.ok(spec.paths['/api/v1/processos']);
    assert.ok(spec.paths['/api/v1/processos/{id}/publicacoes']);
    assert.ok(spec.paths['/api/v1/publicacoes/dashboard']);
    assert.ok(spec.paths['/api/v1/publicacoes/{id}/status']);
    assert.ok(spec.paths['/api/v1/tribunais']);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});

test('rejeita ID de processo inválido sem consultar o repositório', async () => {
  const djenService: DjenServicePort = {
    async consultarDjen() { return { items: [] }; },
    async atualizarStatus() { return { success: true }; }
  };
  const app = createApp(
    new DjenController(djenService),
    undefined,
    new DjenReadController(new DjenReadService(new FakeReadRepository()))
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/processos/invalid/publicacoes`);
    assert.equal(response.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});
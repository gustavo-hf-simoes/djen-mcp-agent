import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adicionarDiasUteis, dataPublicacaoCalculada, mapearPublicacao } from './publicacao.dto';

const baseRow = {
  id: 'publicacao-id',
  processo_id: 'processo-id',
  numero_cnj: '0000000-00.2026.8.16.0000',
  tribunal: 'TJPR',
  orgao_julgador: 'Turma Recursal',
  data_disponibilizacao: '2026-10-16',
  data_publicacao: null,
  teor_comunicacao: null,
  status_leitura: 'PENDENTE'
};

test('calcula a publicação no próximo dia útil sem considerar feriados', () => {
  assert.equal(dataPublicacaoCalculada('2026-10-16'), '2026-10-19');
  assert.equal(dataPublicacaoCalculada('2026-10-17'), '2026-10-19');
  assert.equal(dataPublicacaoCalculada('2026-10-19'), '2026-10-20');
});

test('estima prazo expresso em dias úteis e pula fins de semana', () => {
  const publicacao = mapearPublicacao({
    ...baseRow,
    data_publicacao: '2026-10-19',
    dados_djen: {
      tipoComunicacao: 'Intimação',
      texto: '<p>Manifestem-se em 2 (dois) dias úteis.</p>',
      destinatarios: [{ nome: 'Parte autora', polo: 'A' }]
    }
  });

  assert.equal(publicacao.estimativaPrazoFinal.status, 'CALCULADA_POR_PRAZO_EXPRESSO');
  assert.equal(publicacao.estimativaPrazoFinal.dataFinal, '2026-10-21');
  assert.doesNotMatch(publicacao.textoParaCopiar, /Parte autora/);
  assert.doesNotMatch(publicacao.textoParaCopiar, /<p>/);
  assert.equal(publicacao.homepageTribunal, 'https://www.tjpr.jus.br/');
});

test('reconhece prazo de dias úteis escrito por extenso', () => {
  const publicacao = mapearPublicacao({
    ...baseRow,
    data_publicacao: '2026-10-19',
    dados_djen: {
      tipoComunicacao: 'Intimação',
      texto: '<p>Manifestem-se no prazo de dois dias úteis.</p>'
    }
  });

  assert.equal(publicacao.estimativaPrazoFinal.diasUteis, 2);
  assert.equal(publicacao.estimativaPrazoFinal.dataFinal, '2026-10-21');
});

test('inclui todas as partes no texto de cópia para lista de distribuição', () => {
  const publicacao = mapearPublicacao({
    ...baseRow,
    dados_djen: {
      tipoComunicacao: 'Lista de distribuição',
      texto: '<p>Distribuição realizada.</p>',
      destinatarios: [
        { nome: 'Parte 1', polo: 'A' },
        { nome: 'Parte 2', polo: 'P' },
        { nome: 'Parte 3', polo: 'T' }
      ]
    }
  });

  assert.equal(publicacao.estimativaPrazoFinal.status, 'REGRA_LEGAL_PENDENTE');
  assert.match(publicacao.textoParaCopiar, /Parte 1/);
  assert.match(publicacao.textoParaCopiar, /Parte 2/);
  assert.match(publicacao.textoParaCopiar, /Parte 3/);
  assert.equal(adicionarDiasUteis('2026-10-16', 1), '2026-10-19');
});
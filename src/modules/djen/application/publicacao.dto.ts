import { htmlParaTexto } from '../html-text';
import { homepageTribunal } from './tribunal-links';

export interface PublicacaoRow {
  id: string;
  processo_id: string;
  numero_cnj: string;
  tribunal: string | null;
  orgao_julgador: string | null;
  data_disponibilizacao: string | null;
  data_publicacao: string | null;
  teor_comunicacao: string | null;
  status_leitura: string;
  dados_djen: unknown;
}

export interface PartePublicacao {
  nome: string;
  polo: string | null;
}

export interface EstimativaPrazoFinal {
  status: 'CALCULADA_POR_PRAZO_EXPRESSO' | 'REGRA_LEGAL_PENDENTE' | 'SEM_DATA_PUBLICACAO';
  dataFinal: string | null;
  diasUteis: number | null;
  mensagem: string;
}

export interface PublicacaoDto {
  id: string;
  processoId: string;
  numeroProcesso: string;
  tribunal: string | null;
  homepageTribunal: string | null;
  linkInteiroTeor: string | null;
  nomeOrgao: string | null;
  nomeClasse: string | null;
  tipoComunicacao: string;
  dataDisponibilizacao: string | null;
  dataPublicacao: string | null;
  texto: string;
  partes: PartePublicacao[];
  hash: string | null;
  statusLeitura: string;
  textoParaCopiar: string;
  estimativaPrazoFinal: EstimativaPrazoFinal;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function dateOnly(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  if (!match) return null;
  const parsed = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === match[1]
    ? match[1]
    : null;
}

export function adicionarDiasUteis(data: string, quantidade: number): string {
  if (!Number.isSafeInteger(quantidade) || quantidade < 0) {
    throw new Error('A quantidade de dias úteis deve ser um inteiro não negativo.');
  }
  const resultado = new Date(`${data}T00:00:00.000Z`);
  if (!Number.isFinite(resultado.getTime()) || resultado.toISOString().slice(0, 10) !== data) {
    throw new Error('A data-base não é válida.');
  }

  let adicionados = 0;
  while (adicionados < quantidade) {
    resultado.setUTCDate(resultado.getUTCDate() + 1);
    const diaDaSemana = resultado.getUTCDay();
    if (diaDaSemana !== 0 && diaDaSemana !== 6) adicionados++;
  }
  return resultado.toISOString().slice(0, 10);
}

export function dataPublicacaoCalculada(dataDisponibilizacao: string | null): string | null {
  if (!dataDisponibilizacao) return null;
  let data = dateOnly(dataDisponibilizacao);
  if (!data) return null;
  do {
    data = adicionarDiasUteis(data, 1);
    const dia = new Date(`${data}T00:00:00.000Z`).getUTCDay();
    if (dia !== 0 && dia !== 6) return data;
  } while (true);
}

const NUMEROS_POR_EXTENSO: Readonly<Record<string, number>> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30,
  quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80,
  noventa: 90, cem: 100
};

function parsePrazoDiasUteis(texto: string): number | null {
  const semAcentos = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const numero = Object.keys(NUMEROS_POR_EXTENSO).join('|');
  const prazo = new RegExp(
    `\\b(\\d{1,3}|(?:${numero})(?:\\s+e\\s+(?:${numero}))?)\\s*(?:\\([^)]*\\)\\s*)?dias?\\s+uteis?\\b`
  ).exec(semAcentos);
  if (!prazo?.[1]) return null;
  if (/^\d+$/.test(prazo[1])) return Number(prazo[1]);

  const componentes = prazo[1].split(/\s+e\s+/).map(palavra => NUMEROS_POR_EXTENSO[palavra]);
  if (!componentes.every((valor): valor is number => typeof valor === 'number')) return null;
  return componentes.reduce((total, valor) => total + valor, 0);
}

function estimarPrazo(texto: string, dataPublicacao: string | null): EstimativaPrazoFinal {
  const diasUteisExplicitos = parsePrazoDiasUteis(texto);
  if (diasUteisExplicitos !== null && dataPublicacao) {
    const diasUteis = diasUteisExplicitos;
    return {
      status: 'CALCULADA_POR_PRAZO_EXPRESSO',
      dataFinal: adicionarDiasUteis(dataPublicacao, diasUteis),
      diasUteis,
      mensagem: 'Estimativa baseada no prazo expresso no texto; não inclui feriados.'
    };
  }
  if (!dataPublicacao) {
    return {
      status: 'SEM_DATA_PUBLICACAO',
      dataFinal: null,
      diasUteis: null,
      mensagem: 'Não há data de publicação válida para estimar o prazo.'
    };
  }
  return {
    status: 'REGRA_LEGAL_PENDENTE',
    dataFinal: null,
    diasUteis: null,
    mensagem: 'Não foi identificado prazo explícito em dias úteis; a regra legal aplicável precisa ser configurada.'
  };
}

function mapearPartes(value: unknown): PartePublicacao[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(parte => {
    if (!isRecord(parte)) return [];
    const nome = firstString(parte.nome);
    if (!nome) return [];
    return [{ nome: htmlParaTexto(nome), polo: firstString(parte.polo) }];
  });
}

export function mapearPublicacao(row: PublicacaoRow): PublicacaoDto {
  const dados = isRecord(row.dados_djen) ? row.dados_djen : {};
  const tribunal = firstString(dados.siglaTribunal, row.tribunal)?.toUpperCase() ?? null;
  const dataDisponibilizacao = dateOnly(
    row.data_disponibilizacao ?? dados.data_disponibilizacao ?? dados.datadisponibilizacao
  );
  const dataPublicacao = dateOnly(row.data_publicacao ?? dados.data_publicacao)
    ?? dataPublicacaoCalculada(dataDisponibilizacao);
  const texto = htmlParaTexto(firstString(dados.texto, row.teor_comunicacao));
  const tipoComunicacao = firstString(dados.tipoComunicacao, dados.tipo_comunicacao) ?? 'Publicação';
  const nomeOrgao = firstString(dados.nomeOrgao, row.orgao_julgador);
  const nomeClasse = firstString(dados.nomeClasse, dados.classe);
  const partes = mapearPartes(dados.destinatarios);
  const link = firstString(dados.link);
  const linkSeguro = link && /^https?:\/\//i.test(link) ? link : null;
  const linhas = [
    `Processo: ${firstString(dados.numeroprocessocommascara) ?? row.numero_cnj}`,
    tribunal ? `Tribunal: ${tribunal}` : null,
    nomeOrgao ? `Órgão julgador: ${htmlParaTexto(nomeOrgao)}` : null,
    nomeClasse ? `Classe: ${htmlParaTexto(nomeClasse)}` : null,
    `Tipo: ${tipoComunicacao}`,
    dataDisponibilizacao ? `Disponibilização: ${dataDisponibilizacao}` : null,
    `Texto da publicação:\n${texto}`
  ].filter((linha): linha is string => linha !== null);
  if (tipoComunicacao.trim().toLocaleLowerCase('pt-BR') !== 'intimação' && partes.length > 0) {
    linhas.push(`Partes:\n${partes.map(parte => `${parte.polo ? `[${parte.polo}] ` : ''}${parte.nome}`).join('\n')}`);
  }

  return {
    id: row.id,
    processoId: row.processo_id,
    numeroProcesso: firstString(dados.numeroprocessocommascara, dados.numero_processo) ?? row.numero_cnj,
    tribunal,
    homepageTribunal: homepageTribunal(tribunal),
    linkInteiroTeor: linkSeguro,
    nomeOrgao,
    nomeClasse,
    tipoComunicacao,
    dataDisponibilizacao,
    dataPublicacao,
    texto,
    partes,
    hash: firstString(dados.hash),
    statusLeitura: row.status_leitura,
    textoParaCopiar: linhas.join('\n\n'),
    estimativaPrazoFinal: estimarPrazo(texto, dataPublicacao)
  };
}
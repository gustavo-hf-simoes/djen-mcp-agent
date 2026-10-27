import axios from 'axios';
import { mapearPublicacao, type PublicacaoDto, type PartePublicacao } from './publicacao.dto';
import { htmlParaTexto } from '../html-text';
import { listarTribunaisMapeados, homepageTribunal } from './tribunal-links';
import { buildZipBuffer, type ZipEntryInput } from './zip-builder';
import type {
  DjenReadFilters,
  DjenReadRepositoryPort,
  ProcessoResumoRow
} from '../infrastructure/djen-read.repository';

export interface DjenReadQuery {
  numeroOab?: string;
  ufOab?: string;
  pagina?: string;
  itensPorPagina?: string;
  numeroProcesso?: string;
  tribunal?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export class DjenReadValidationError extends Error {}

function positiveInteger(value: string | undefined, fallback: number, name: string, max: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new DjenReadValidationError(`${name} deve ser um inteiro entre 1 e ${max}.`);
  }
  return parsed;
}

function validDate(value: string | undefined, name: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DjenReadValidationError(`${name} deve usar o formato YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new DjenReadValidationError(`${name} não é uma data válida.`);
  }
  return value;
}

function filtersFrom(query: DjenReadQuery): DjenReadFilters {
  const numeroOab = query.numeroOab?.trim() || '69161';
  const ufOab = (query.ufOab?.trim() || 'PR').toUpperCase();
  if (!/^[0-9A-Za-z.-]{1,30}$/.test(numeroOab)) {
    throw new DjenReadValidationError('numeroOab tem formato inválido.');
  }
  if (!/^[A-Z]{2}$/.test(ufOab)) {
    throw new DjenReadValidationError('ufOab deve conter duas letras.');
  }
  const dataInicio = validDate(query.dataInicio, 'dataInicio');
  const dataFim = validDate(query.dataFim, 'dataFim');
  if (dataInicio && dataFim && dataInicio > dataFim) {
    throw new DjenReadValidationError('dataInicio não pode ser posterior a dataFim.');
  }
  return {
    numeroOab,
    ufOab,
    ...(query.numeroProcesso?.trim() ? { numeroProcesso: query.numeroProcesso.trim() } : {}),
    ...(query.tribunal?.trim() ? { tribunal: query.tribunal.trim().toUpperCase() } : {}),
    ...(query.status?.trim() ? { status: query.status.trim().toUpperCase() } : {}),
    ...(dataInicio ? { dataInicio } : {}),
    ...(dataFim ? { dataFim } : {})
  };
}

function formatarMascaraCnj(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length === 20) {
    return `${digitos.slice(0, 7)}-${digitos.slice(7, 9)}.${digitos.slice(9, 13)}.${digitos.slice(13, 14)}.${digitos.slice(14, 16)}.${digitos.slice(16, 20)}`;
  }
  return valor;
}

function extrairPartesEClasse(dadosDjen: unknown): {
  numeroFormatado: string | null;
  nomeClasse: string | null;
  partes: PartePublicacao[];
  tituloPartes: string | null;
} {
  if (!dadosDjen || typeof dadosDjen !== 'object' || Array.isArray(dadosDjen)) {
    return { numeroFormatado: null, nomeClasse: null, partes: [], tituloPartes: null };
  }
  const rec = dadosDjen as Record<string, unknown>;
  const numeroFormatado = typeof rec.numeroprocessocommascara === 'string' && rec.numeroprocessocommascara.trim()
    ? rec.numeroprocessocommascara.trim()
    : null;
  const nomeClasse = typeof rec.nomeClasse === 'string' && rec.nomeClasse.trim()
    ? htmlParaTexto(rec.nomeClasse.trim())
    : null;

  const partes: PartePublicacao[] = Array.isArray(rec.destinatarios)
    ? rec.destinatarios.flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const p = item as Record<string, unknown>;
        if (typeof p.nome !== 'string' || !p.nome.trim()) return [];
        return [{
          nome: htmlParaTexto(p.nome.trim()),
          polo: typeof p.polo === 'string' ? p.polo.trim() : null
        }];
      })
    : [];

  const poloAtivo = partes.find(p => p.polo === 'A')?.nome ?? partes[0]?.nome ?? null;
  const poloPassivo = partes.find(p => p.polo === 'P')?.nome ?? (partes.length > 1 ? partes[1]?.nome : null);
  const tituloPartes = poloAtivo && poloPassivo
    ? `${poloAtivo} × ${poloPassivo}`
    : poloAtivo ?? poloPassivo ?? null;

  return { numeroFormatado, nomeClasse, partes, tituloPartes };
}

function processoResumo(row: ProcessoResumoRow) {
  const extra = extrairPartesEClasse(row.ultima_dados_djen);
  const numeroFormatado = extra.numeroFormatado ?? formatarMascaraCnj(row.numero_cnj);
  return {
    id: row.id,
    numeroProcesso: row.numero_cnj,
    numeroProcessoFormatado: numeroFormatado,
    nomeClasse: extra.nomeClasse,
    tituloPartes: extra.tituloPartes,
    partes: extra.partes,
    tribunal: row.tribunal,
    homepageTribunal: homepageTribunal(row.tribunal),
    orgaoJulgador: row.orgao_julgador ? htmlParaTexto(row.orgao_julgador) : null,
    quantidadePublicacoes: row.quantidade_publicacoes,
    ultimaPublicacao: row.ultima_publicacao_id
      ? {
          id: row.ultima_publicacao_id,
          data: row.ultima_data_publicacao,
          tipoComunicacao: row.ultima_tipo,
          statusLeitura: row.ultimo_status
        }
      : null
  };
}

export class DjenReadService {
  constructor(private readonly repository: DjenReadRepositoryPort) {}

  async listarProcessos(query: DjenReadQuery) {
    const filters = filtersFrom(query);
    const pagina = positiveInteger(query.pagina, 1, 'pagina', 1_000_000);
    const itensPorPagina = positiveInteger(query.itensPorPagina, 25, 'itensPorPagina', 100);
    const result = await this.repository.listarProcessos(filters, pagina, itensPorPagina);
    return {
      items: result.items.map(processoResumo),
      pagination: {
        page: pagina,
        pageSize: itensPorPagina,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / itensPorPagina)
      }
    };
  }

  async listarPublicacoesDoProcesso(processoId: string, query: DjenReadQuery) {
    const filters = filtersFrom(query);
    const pagina = positiveInteger(query.pagina, 1, 'pagina', 1_000_000);
    const itensPorPagina = positiveInteger(query.itensPorPagina, 25, 'itensPorPagina', 100);
    const result = await this.repository.listarPublicacoesDoProcesso(
      processoId,
      filters,
      pagina,
      itensPorPagina
    );
    return paginatedPublications(result.items.map(mapearPublicacao), result.total, pagina, itensPorPagina);
  }

  async listarPublicacoes(query: DjenReadQuery) {
    const filters = filtersFrom(query);
    const pagina = positiveInteger(query.pagina, 1, 'pagina', 1_000_000);
    const itensPorPagina = positiveInteger(query.itensPorPagina, 25, 'itensPorPagina', 100);
    const result = await this.repository.listarPublicacoes(filters, pagina, itensPorPagina);
    return paginatedPublications(result.items.map(mapearPublicacao), result.total, pagina, itensPorPagina);
  }

  async dashboard(query: DjenReadQuery) {
    const filters = filtersFrom(query);
    const [contagens, recentes] = await Promise.all([
      this.repository.contarDashboard(filters),
      this.repository.listarPublicacoes(filters, 1, 10)
    ]);
    return {
      contagens,
      ultimasPublicacoes: recentes.items.map(mapearPublicacao)
    };
  }

  listarTribunais(): Array<{ sigla: string; homepage: string }> {
    return listarTribunaisMapeados();
  }

  async gerarZipCertidoesDoProcesso(
    processoId: string,
    query: DjenReadQuery
  ): Promise<{ filename: string; zipBuffer: Buffer; totalArquivos: number }> {
    const filters = filtersFrom(query);
    const result = await this.repository.listarPublicacoesDoProcesso(processoId, filters, 1, 100);
    const publicacoes = result.items.map(mapearPublicacao);
    const numeroLimpo = (publicacoes[0]?.numeroProcesso ?? processoId).replace(/[^0-9A-Za-z.-]/g, '_');

    const entries: ZipEntryInput[] = [];
    for (const [idx, pub] of publicacoes.entries()) {
      const ordem = String(idx + 1).padStart(2, '0');
      const dataStr = pub.dataDisponibilizacao ?? pub.dataPublicacao ?? 'sem-data';
      const tipoLimpo = pub.tipoComunicacao
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^0-9A-Za-z_-]/g, '_');

      if (pub.hash) {
        try {
          const urlCertidao = `https://comunicaapi.pje.jus.br/api/v1/comunicacao/${encodeURIComponent(pub.hash)}/certidao`;
          const resp = await axios.get<ArrayBuffer>(urlCertidao, {
            responseType: 'arraybuffer',
            timeout: 20_000,
            validateStatus: s => s >= 200 && s < 300
          });
          entries.push({
            filename: `${ordem}_${dataStr}_${tipoLimpo}_Certidao.pdf`,
            data: Buffer.from(resp.data)
          });
        } catch {
          entries.push({
            filename: `${ordem}_${dataStr}_${tipoLimpo}_Teor.txt`,
            data: Buffer.from(pub.textoParaCopiar, 'utf8')
          });
        }
      } else {
        entries.push({
          filename: `${ordem}_${dataStr}_${tipoLimpo}_Teor.txt`,
          data: Buffer.from(pub.textoParaCopiar, 'utf8')
        });
      }
    }

    const resumoGeral = publicacoes
      .map((p, i) => `=== [${i + 1}] ${p.dataDisponibilizacao ?? ''} - ${p.tipoComunicacao} ===\n${p.textoParaCopiar}`)
      .join('\n\n------------------------------------------------------------\n\n');

    entries.push({
      filename: `00_RESUMO_COMPLETO_PROCESSO_${numeroLimpo}.txt`,
      data: Buffer.from(resumoGeral || 'Nenhuma publicação encontrada.', 'utf8')
    });

    return {
      filename: `Certidoes_Processo_${numeroLimpo}.zip`,
      zipBuffer: buildZipBuffer(entries),
      totalArquivos: entries.length
    };
  }
}

function paginatedPublications(
  items: PublicacaoDto[],
  total: number,
  pagina: number,
  itensPorPagina: number
) {
  return {
    items,
    pagination: {
      page: pagina,
      pageSize: itensPorPagina,
      totalItems: total,
      totalPages: Math.ceil(total / itensPorPagina)
    }
  };
}
import axios from 'axios';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { htmlParaTexto } from '../html-text';
import { parseOfficialDjenResponse } from '../official-response';
import { dataPublicacaoCalculada } from './publicacao.dto';

interface DjenComunicacaoItem extends Record<string, unknown> {
  id?: unknown;
  numero_processo?: unknown;
  siglaTribunal?: unknown;
  nomeOrgao?: unknown;
  data_disponibilizacao?: unknown;
  data_publicacao?: unknown;
  texto?: unknown;
}

export interface CapturarPaginaDjenCommand {
  url: string;
  filtros: URLSearchParams;
  advogadoId: string;
}

/** Consulta a fonte oficial e persiste resposta e publicações numa transação. */
export class CapturarPaginaDjenCommandHandler {
  constructor(private readonly pool: Pool) {}

  async execute(command: CapturarPaginaDjenCommand): Promise<Record<string, unknown>> {
    const response = await axios.get<ArrayBuffer>(command.url, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      validateStatus: () => true
    });
    const corpoOriginal = Buffer.from(response.data);
    const respostaArquivada = await this.arquivarResposta(
      command.url,
      command.filtros,
      response.status,
      String(response.headers['content-type'] ?? ''),
      corpoOriginal
    );
    const respostaId = respostaArquivada.id;

    if (response.status < 200 || response.status >= 300) {
      const error = new Error(`DJEN respondeu com HTTP ${response.status}.`);
      await this.marcarErro(respostaId, error);
      throw error;
    }

    let respostaOficial;
    try {
      respostaOficial = parseOfficialDjenResponse(corpoOriginal);
    } catch (error) {
      await this.marcarErro(respostaId, error);
      throw error;
    }

    const itens = respostaOficial.json.items;
    if (!Array.isArray(itens)) {
      const error = new Error('A resposta do DJEN não contém uma lista items válida.');
      await this.marcarErro(respostaId, error);
      throw error;
    }
    if (respostaArquivada.jaCompleta) return respostaOficial.json;

    const client = await this.pool.connect();
    let novosItens = 0;
    try {
      await client.query('BEGIN');
      for (const [indice, itemJson] of itens.entries()) {
        const item = this.validarItem(itemJson, indice);
        const processoCnj = String(item.numero_processo);
        const idDjen = String(item.id);
        const jsonItem = JSON.stringify(item);
        const hashItem = createHash('sha256').update(jsonItem, 'utf8').digest('hex');
        const dataDisponibilizacao = typeof item.data_disponibilizacao === 'string'
          ? item.data_disponibilizacao
          : typeof item.datadisponibilizacao === 'string'
            ? item.datadisponibilizacao
            : null;
        const dataPublicacao = typeof item.data_publicacao === 'string' && item.data_publicacao.trim()
          ? item.data_publicacao
          : dataPublicacaoCalculada(dataDisponibilizacao);
        const processoResult = await client.query(
          `INSERT INTO processos (numero_cnj, tribunal, orgao_julgador, dados_djen)
           VALUES ($1, $2, $3, $4::jsonb)
           ON CONFLICT (numero_cnj) DO NOTHING
           RETURNING id`,
          [processoCnj, item.siglaTribunal ?? null, item.nomeOrgao ?? null, jsonItem]
        );
        const processoId = processoResult.rows[0]?.id ?? (await client.query(
          'SELECT id FROM processos WHERE numero_cnj = $1',
          [processoCnj]
        )).rows[0]?.id;
        if (!processoId) throw new Error(`Não foi possível recuperar o processo ${processoCnj}.`);

        const intimacaoResult = await client.query(
          `INSERT INTO intimacoes (
            id_djen_externo, processo_id, advogado_id,
            data_disponibilizacao, data_publicacao, teor_comunicacao,
            status_leitura, categoria_ia, urgencia_ia, resumo_ia,
            dados_djen, sha256_djen, primeira_resposta_djen_id
          ) VALUES ($1, $2, $3, $4, $5, $6,
                    'PENDENTE', 'GERAL', 'MEDIA', 'Não analisado', $7::jsonb, $8, $9)
          ON CONFLICT (id_djen_externo) DO NOTHING
          RETURNING id`,
          [
            idDjen,
            processoId,
            command.advogadoId,
            dataDisponibilizacao,
            dataPublicacao,
            htmlParaTexto(item.texto),
            jsonItem,
            hashItem,
            respostaId
          ]
        );

        const intimacaoId = intimacaoResult.rows[0]?.id;
        if (!intimacaoId) {
          const existente = await client.query(
            `SELECT id, processo_id, dados_djen = $2::jsonb AS mesmo_payload
             FROM intimacoes
             WHERE id_djen_externo = $1
             FOR SHARE`,
            [idDjen, jsonItem]
          );
          const registro = existente.rows[0];
          if (!registro || registro.mesmo_payload !== true || registro.processo_id !== processoId) {
            throw new Error(`O DJEN retornou conteúdo divergente para o ID ${idDjen}; o registro existente foi preservado.`);
          }
          continue;
        }

        await client.query(
          `INSERT INTO djen_intimacao_origens (intimacao_id, resposta_id, indice_item, sha256_item)
           VALUES ($1, $2, $3, $4)`,
          [intimacaoId, respostaId, indice, hashItem]
        );
        novosItens++;
      }

      await client.query(
        `UPDATE djen_respostas_processamento
         SET status = 'COMPLETO', tentativas = tentativas + 1,
             erro = NULL, concluido_em = clock_timestamp()
         WHERE resposta_id = $1`,
        [respostaId]
      );
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Falha ao reverter transação de persistência DJEN:', rollbackError);
      }
      await this.marcarErro(respostaId, error);
      throw error;
    } finally {
      client.release();
    }

    console.log(`✅ Resposta DJEN ${respostaId} arquivada; ${novosItens} novas intimações persistidas.`);
    return respostaOficial.json;
  }

  private validarItem(item: unknown, indice: number): DjenComunicacaoItem {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Item ${indice} da resposta DJEN não é um objeto.`);
    }
    const comunicacao = item as DjenComunicacaoItem;
    if (comunicacao.id === undefined || comunicacao.id === null ||
        typeof comunicacao.numero_processo !== 'string' || !comunicacao.numero_processo.trim()) {
      throw new Error(`Item ${indice} da resposta DJEN não possui ID e número do processo.`);
    }
    return comunicacao;
  }

  private async arquivarResposta(
    url: string,
    filtros: URLSearchParams,
    statusHttp: number,
    contentType: string,
    corpoOriginal: Buffer
  ): Promise<{ id: string; jaCompleta: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const hashResposta = createHash('sha256').update(corpoOriginal).digest('hex');
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        [url, `${statusHttp}:${hashResposta}`]
      );
      const existente = await client.query(
        `SELECT r.id, p.status
         FROM djen_resposta_chaves AS k
         JOIN djen_respostas AS r ON r.id = k.resposta_id
         JOIN djen_respostas_processamento AS p ON p.resposta_id = r.id
         WHERE k.url_solicitada = $1 AND k.status_http = $2 AND k.sha256 = $3
         FOR UPDATE OF p`,
        [url, statusHttp, hashResposta]
      );
      if (existente.rows.length > 0) {
        const id = String(existente.rows[0].id);
        const jaCompleta = existente.rows[0].status === 'COMPLETO';
        if (!jaCompleta) {
          await client.query(
            `UPDATE djen_respostas_processamento
             SET status = 'PENDENTE', erro = NULL, concluido_em = NULL
             WHERE resposta_id = $1`,
            [id]
          );
        }
        await client.query('COMMIT');
        return { id, jaCompleta };
      }

      const result = await client.query(
        `INSERT INTO djen_respostas (
          url_solicitada, parametros, status_http, content_type, corpo_original, sha256
        ) VALUES ($1, $2::jsonb, $3, $4, $5, $6)
        RETURNING id`,
        [url, JSON.stringify(Array.from(filtros.entries())), statusHttp, contentType,
          corpoOriginal, hashResposta]
      );
      const id = result.rows[0].id;
      await client.query(
        `INSERT INTO djen_respostas_processamento (resposta_id, status)
         VALUES ($1, 'PENDENTE')`,
        [id]
      );
      await client.query(
        `INSERT INTO djen_resposta_chaves (url_solicitada, status_http, sha256, resposta_id)
         VALUES ($1, $2, $3, $4)`,
        [url, statusHttp, hashResposta, id]
      );
      await client.query('COMMIT');
      return { id: String(id), jaCompleta: false };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Falha ao reverter transação de arquivamento DJEN:', rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async marcarErro(respostaId: string, error: unknown): Promise<void> {
    const mensagem = error instanceof Error ? error.message : String(error);
    try {
      await this.pool.query(
        `UPDATE djen_respostas_processamento
         SET status = 'ERRO', tentativas = tentativas + 1,
             erro = $2, concluido_em = clock_timestamp()
         WHERE resposta_id = $1`,
        [respostaId, mensagem.slice(0, 4000)]
      );
    } catch (persistenciaErro) {
      console.error('Falha ao registrar erro do processamento DJEN:', persistenciaErro);
    }
  }
}
import type { Pool, PoolClient } from 'pg';

export type DjenSyncRunType = 'INCREMENTAL' | 'BACKFILL';

export interface DjenSyncCheckpoint {
  proximaDataBackfill: string;
}

export interface DjenSyncRepositoryPort {
  buscarAdvogadoId(numeroOab: string, ufOab: string): Promise<string>;
  inicializarCheckpoint(numeroOab: string, ufOab: string, dataInicioBackfill: string): Promise<DjenSyncCheckpoint>;
  tentarAdquirirLock(numeroOab: string, ufOab: string): Promise<PoolClient | null>;
  liberarLock(client: PoolClient, numeroOab: string, ufOab: string): Promise<void>;
  iniciarExecucao(numeroOab: string, ufOab: string, tipo: DjenSyncRunType, dataInicio: string, dataFim: string): Promise<string>;
  concluirExecucao(execucaoId: string, tipo: DjenSyncRunType, paginas: number, itens: number, proximaDataBackfill?: string): Promise<void>;
  registrarFalha(execucaoId: string, error: unknown): Promise<void>;
}

export class DjenSyncRepository implements DjenSyncRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async buscarAdvogadoId(numeroOab: string, ufOab: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      'SELECT id FROM advogados WHERE numero_oab = $1 AND uf_oab = $2',
      [numeroOab, ufOab]
    );
    if (!result.rows[0]) throw new Error(`Advogado com a OAB ${numeroOab}/${ufOab} não encontrado.`);
    return String(result.rows[0].id);
  }

  async inicializarCheckpoint(
    numeroOab: string,
    ufOab: string,
    dataInicioBackfill: string
  ): Promise<DjenSyncCheckpoint> {
    await this.pool.query(
      `INSERT INTO djen_sync_checkpoints (
        numero_oab, uf_oab, data_inicio_backfill, proxima_data_backfill
      ) VALUES ($1, $2, $3, $3)
      ON CONFLICT (numero_oab, uf_oab) DO NOTHING`,
      [numeroOab, ufOab, dataInicioBackfill]
    );
    const result = await this.pool.query<{ proxima_data_backfill: string }>(
      `SELECT proxima_data_backfill::text
       FROM djen_sync_checkpoints
       WHERE numero_oab = $1 AND uf_oab = $2`,
      [numeroOab, ufOab]
    );
    if (!result.rows[0]) throw new Error(`Checkpoint DJEN da OAB ${numeroOab}/${ufOab} não foi criado.`);
    return { proximaDataBackfill: result.rows[0].proxima_data_backfill };
  }

  async tentarAdquirirLock(numeroOab: string, ufOab: string): Promise<PoolClient | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ adquirido: boolean }>(
        'SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS adquirido',
        [`djen-sync:${numeroOab}`, ufOab]
      );
      if (result.rows[0]?.adquirido) return client;
      client.release();
      return null;
    } catch (error) {
      client.release(error instanceof Error ? error : true);
      throw error;
    }
  }

  async liberarLock(client: PoolClient, numeroOab: string, ufOab: string): Promise<void> {
    try {
      await client.query(
        'SELECT pg_advisory_unlock(hashtext($1), hashtext($2))',
        [`djen-sync:${numeroOab}`, ufOab]
      );
      client.release();
    } catch (error) {
      client.release(error instanceof Error ? error : true);
      throw error;
    }
  }

  async iniciarExecucao(
    numeroOab: string,
    ufOab: string,
    tipo: DjenSyncRunType,
    dataInicio: string,
    dataFim: string
  ): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO djen_sync_execucoes (
        numero_oab, uf_oab, tipo, data_inicio, data_fim, status
      ) VALUES ($1, $2, $3, $4, $5, 'EM_ANDAMENTO')
      RETURNING id::text`,
      [numeroOab, ufOab, tipo, dataInicio, dataFim]
    );
    const execucao = result.rows[0];
    if (!execucao) throw new Error('Não foi possível registrar a execução de sincronização DJEN.');
    return execucao.id;
  }

  async concluirExecucao(
    execucaoId: string,
    tipo: DjenSyncRunType,
    paginas: number,
    itens: number,
    proximaDataBackfill?: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const execucao = await client.query<{ numero_oab: string; uf_oab: string }>(
        `SELECT numero_oab, uf_oab
         FROM djen_sync_execucoes
         WHERE id = $1 AND status = 'EM_ANDAMENTO'
         FOR UPDATE`,
        [execucaoId]
      );
      if (!execucao.rows[0]) throw new Error(`Execução DJEN ${execucaoId} não está em andamento.`);

      await client.query(
        `UPDATE djen_sync_execucoes
         SET status = 'COMPLETO', paginas_consultadas = $2,
             itens_recebidos = $3, concluida_em = clock_timestamp()
         WHERE id = $1`,
        [execucaoId, paginas, itens]
      );

      if (tipo === 'BACKFILL') {
        if (!proximaDataBackfill) throw new Error('Próxima data do backfill é obrigatória.');
        await client.query(
          `UPDATE djen_sync_checkpoints
           SET proxima_data_backfill = $3, atualizado_em = clock_timestamp()
           WHERE numero_oab = $1 AND uf_oab = $2`,
          [execucao.rows[0].numero_oab, execucao.rows[0].uf_oab, proximaDataBackfill]
        );
      } else {
        await client.query(
          `UPDATE djen_sync_checkpoints
           SET ultima_sincronizacao_incremental_em = clock_timestamp(),
               atualizado_em = clock_timestamp()
           WHERE numero_oab = $1 AND uf_oab = $2`,
          [execucao.rows[0].numero_oab, execucao.rows[0].uf_oab]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Falha ao reverter conclusão da sincronização DJEN:', rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async registrarFalha(execucaoId: string, error: unknown): Promise<void> {
    const mensagem = error instanceof Error ? error.message : String(error);
    await this.pool.query(
      `UPDATE djen_sync_execucoes
       SET status = 'ERRO', erro = $2, concluida_em = clock_timestamp()
       WHERE id = $1 AND status = 'EM_ANDAMENTO'`,
      [execucaoId, mensagem.slice(0, 4000)]
    );
  }
}
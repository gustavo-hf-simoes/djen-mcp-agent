import { setTimeout as delay } from 'node:timers/promises';
import { pool } from '../../database';
import { CapturarPaginaDjenCommandHandler } from './application/capturar-pagina-djen.command';
import { carregarDjenSyncConfig } from './application/sync/djen-sync.config';
import { DjenSyncWorker } from './application/sync/djen-sync.worker';
import { DjenSyncRepository } from './infrastructure/djen-sync.repository';

async function main(): Promise<void> {
  const abortController = new AbortController();
  const solicitarParada = () => abortController.abort();
  process.once('SIGINT', solicitarParada);
  process.once('SIGTERM', solicitarParada);

  try {
    const config = carregarDjenSyncConfig();
    const worker = new DjenSyncWorker(
      new DjenSyncRepository(pool),
      new CapturarPaginaDjenCommandHandler(pool),
      config
    );
    const executarUmaVez = process.argv.includes('--once');

    do {
      try {
        await worker.executarCiclo();
      } catch (error) {
        console.error('Falha no ciclo de sincronização DJEN:', error);
        if (executarUmaVez) throw error;
      }

      if (executarUmaVez || abortController.signal.aborted) break;
      try {
        await delay(config.intervaloMinutos * 60_000, undefined, {
          signal: abortController.signal
        });
      } catch (error) {
        if (!abortController.signal.aborted) throw error;
      }
    } while (!abortController.signal.aborted);
  } finally {
    process.off('SIGINT', solicitarParada);
    process.off('SIGTERM', solicitarParada);
    await pool.end();
  }
}

void main().catch(error => {
  console.error('Não foi possível iniciar o worker DJEN:', error);
  process.exitCode = 1;
});
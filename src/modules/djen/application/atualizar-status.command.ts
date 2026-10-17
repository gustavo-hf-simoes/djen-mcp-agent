import type { Pool } from 'pg';

export interface AtualizarStatusCommand {
  intimacaoId: string;
  status: string;
}

/** Executa a alteração do status de leitura de uma publicação. */
export class AtualizarStatusCommandHandler {
  constructor(private readonly pool: Pool) {}

  async execute(command: AtualizarStatusCommand): Promise<{ success: true }> {
    await this.pool.query(
      'UPDATE intimacoes SET status_leitura = $1, data_leitura = NOW() WHERE id = $2',
      [command.status, command.intimacaoId]
    );
    return { success: true };
  }
}
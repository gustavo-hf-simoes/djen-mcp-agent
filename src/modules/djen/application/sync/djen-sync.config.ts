export interface DjenSyncConfig {
  numeroOab: string;
  ufOab: string;
  dataInicioBackfill: string;
  diasLookback: number;
  diasBackfillPorCiclo: number;
  intervaloMinutos: number;
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }
  return parsed;
}

function validDate(value: string | undefined, name: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} deve ser informada no formato YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} não é uma data válida.`);
  }
  return value;
}

export function carregarDjenSyncConfig(env: NodeJS.ProcessEnv = process.env): DjenSyncConfig {
  const numeroOab = env.DJEN_SYNC_NUMERO_OAB?.trim() || '69161';
  const ufOab = (env.DJEN_SYNC_UF_OAB?.trim() || 'PR').toUpperCase();
  if (!numeroOab) throw new Error('DJEN_SYNC_NUMERO_OAB não pode ser vazio.');
  if (!/^[A-Z]{2}$/.test(ufOab)) throw new Error('DJEN_SYNC_UF_OAB deve conter duas letras.');

  return {
    numeroOab,
    ufOab,
    dataInicioBackfill: validDate(env.DJEN_SYNC_DATA_INICIO_BACKFILL, 'DJEN_SYNC_DATA_INICIO_BACKFILL'),
    diasLookback: positiveInteger(env.DJEN_SYNC_DIAS_LOOKBACK, 3, 'DJEN_SYNC_DIAS_LOOKBACK'),
    diasBackfillPorCiclo: positiveInteger(env.DJEN_SYNC_DIAS_BACKFILL_POR_CICLO, 3, 'DJEN_SYNC_DIAS_BACKFILL_POR_CICLO'),
    intervaloMinutos: positiveInteger(env.DJEN_SYNC_INTERVALO_MINUTOS, 60, 'DJEN_SYNC_INTERVALO_MINUTOS')
  };
}
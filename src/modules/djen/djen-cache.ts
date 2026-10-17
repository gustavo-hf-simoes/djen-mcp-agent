export const DJEN_CACHE_TTL_SECONDS = 15 * 60;

export function respostaPodeSerCacheadaIndefinidamente(
  filtros: URLSearchParams,
  hoje = new Date()
): boolean {
  const fim = filtros.get('dataDisponibilizacaoFim') ?? filtros.get('data_disponibilizacao_fim');
  if (!fim || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) return false;

  return fim < hoje.toISOString().slice(0, 10);
}
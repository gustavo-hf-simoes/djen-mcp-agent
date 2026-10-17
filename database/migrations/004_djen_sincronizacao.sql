BEGIN;

CREATE TABLE IF NOT EXISTS djen_sync_checkpoints (
  numero_oab TEXT NOT NULL,
  uf_oab TEXT NOT NULL,
  data_inicio_backfill DATE NOT NULL,
  proxima_data_backfill DATE NOT NULL,
  ultima_sincronizacao_incremental_em TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (numero_oab, uf_oab),
  CHECK (proxima_data_backfill >= data_inicio_backfill)
);

CREATE TABLE IF NOT EXISTS djen_sync_execucoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero_oab TEXT NOT NULL,
  uf_oab TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('INCREMENTAL', 'BACKFILL')),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('EM_ANDAMENTO', 'COMPLETO', 'ERRO')),
  paginas_consultadas INTEGER NOT NULL DEFAULT 0,
  itens_recebidos INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  iniciada_em TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  concluida_em TIMESTAMPTZ,
  FOREIGN KEY (numero_oab, uf_oab)
    REFERENCES djen_sync_checkpoints (numero_oab, uf_oab),
  CHECK (data_fim >= data_inicio),
  CHECK (paginas_consultadas >= 0),
  CHECK (itens_recebidos >= 0)
);

CREATE INDEX IF NOT EXISTS ix_djen_sync_execucoes_advogado_inicio
  ON djen_sync_execucoes (numero_oab, uf_oab, iniciada_em DESC);

COMMIT;
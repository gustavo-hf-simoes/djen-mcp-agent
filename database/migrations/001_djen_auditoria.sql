BEGIN;

CREATE TABLE IF NOT EXISTS djen_respostas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consultado_em TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  url_solicitada TEXT NOT NULL,
  parametros JSONB NOT NULL,
  status_http SMALLINT NOT NULL,
  content_type TEXT,
  corpo_original BYTEA NOT NULL,
  sha256 CHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_djen_respostas_consultado_em
  ON djen_respostas (consultado_em DESC);

CREATE INDEX IF NOT EXISTS ix_djen_respostas_sha256
  ON djen_respostas (sha256);

CREATE TABLE IF NOT EXISTS djen_respostas_processamento (
  resposta_id BIGINT PRIMARY KEY REFERENCES djen_respostas(id),
  status TEXT NOT NULL CHECK (status IN ('PENDENTE', 'COMPLETO', 'ERRO')),
  tentativas INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  concluido_em TIMESTAMPTZ
);

ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS dados_djen JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE intimacoes
  ADD COLUMN IF NOT EXISTS dados_djen JSONB,
  ADD COLUMN IF NOT EXISTS sha256_djen CHAR(64),
  ADD COLUMN IF NOT EXISTS ultima_resposta_djen_id BIGINT REFERENCES djen_respostas(id);

ALTER TABLE intimacoes
  ALTER COLUMN data_publicacao DROP NOT NULL;

CREATE TABLE IF NOT EXISTS djen_resposta_itens (
  resposta_id BIGINT NOT NULL REFERENCES djen_respostas(id),
  indice_item INTEGER NOT NULL,
  intimacao_id UUID NOT NULL REFERENCES intimacoes(id),
  processo_id UUID NOT NULL REFERENCES processos(id),
  id_djen_externo TEXT NOT NULL,
  processo_cnj TEXT NOT NULL,
  dados_djen JSONB NOT NULL,
  sha256_item CHAR(64) NOT NULL,
  PRIMARY KEY (resposta_id, indice_item)
);

CREATE INDEX IF NOT EXISTS ix_djen_resposta_itens_intimacao
  ON djen_resposta_itens (intimacao_id);

CREATE INDEX IF NOT EXISTS ix_djen_resposta_itens_processo
  ON djen_resposta_itens (processo_id, processo_cnj);

CREATE OR REPLACE FUNCTION djen_impedir_alteracao_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'O histórico original do DJEN é imutável.';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_djen_respostas_imutaveis ON djen_respostas;
CREATE TRIGGER trg_djen_respostas_imutaveis
  BEFORE UPDATE OR DELETE OR TRUNCATE ON djen_respostas
  FOR EACH STATEMENT EXECUTE FUNCTION djen_impedir_alteracao_historico();

DROP TRIGGER IF EXISTS trg_djen_resposta_itens_imutaveis ON djen_resposta_itens;
CREATE TRIGGER trg_djen_resposta_itens_imutaveis
  BEFORE UPDATE OR DELETE OR TRUNCATE ON djen_resposta_itens
  FOR EACH STATEMENT EXECUTE FUNCTION djen_impedir_alteracao_historico();

COMMIT;
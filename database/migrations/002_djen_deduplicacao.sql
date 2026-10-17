BEGIN;

ALTER TABLE intimacoes
  ADD COLUMN IF NOT EXISTS primeira_resposta_djen_id BIGINT REFERENCES djen_respostas(id);

CREATE TABLE IF NOT EXISTS djen_resposta_chaves (
  url_solicitada TEXT NOT NULL,
  status_http SMALLINT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  resposta_id BIGINT NOT NULL REFERENCES djen_respostas(id),
  PRIMARY KEY (url_solicitada, status_http, sha256),
  UNIQUE (resposta_id)
);

INSERT INTO djen_resposta_chaves (url_solicitada, status_http, sha256, resposta_id)
SELECT DISTINCT ON (url_solicitada, status_http, sha256)
  url_solicitada, status_http, sha256, id
FROM djen_respostas
ORDER BY url_solicitada, status_http, sha256, id
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS djen_intimacao_origens (
  intimacao_id UUID PRIMARY KEY REFERENCES intimacoes(id),
  resposta_id BIGINT NOT NULL REFERENCES djen_respostas(id),
  indice_item INTEGER NOT NULL,
  sha256_item CHAR(64) NOT NULL,
  UNIQUE (resposta_id, indice_item)
);

INSERT INTO djen_intimacao_origens (intimacao_id, resposta_id, indice_item, sha256_item)
SELECT DISTINCT ON (intimacao_id)
  intimacao_id, resposta_id, indice_item, sha256_item
FROM djen_resposta_itens
ORDER BY intimacao_id, resposta_id, indice_item
ON CONFLICT DO NOTHING;

UPDATE intimacoes AS i
SET primeira_resposta_djen_id = o.resposta_id
FROM djen_intimacao_origens AS o
WHERE i.id = o.intimacao_id
  AND i.primeira_resposta_djen_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_djen_respostas_url_consultado
  ON djen_respostas (url_solicitada, consultado_em DESC);

CREATE INDEX IF NOT EXISTS ix_djen_intimacao_origens_resposta
  ON djen_intimacao_origens (resposta_id);

DROP TRIGGER IF EXISTS trg_djen_intimacao_origens_imutaveis ON djen_intimacao_origens;
CREATE TRIGGER trg_djen_intimacao_origens_imutaveis
  BEFORE UPDATE OR DELETE OR TRUNCATE ON djen_intimacao_origens
  FOR EACH STATEMENT EXECUTE FUNCTION djen_impedir_alteracao_historico();

DROP TRIGGER IF EXISTS trg_djen_resposta_chaves_imutaveis ON djen_resposta_chaves;
CREATE TRIGGER trg_djen_resposta_chaves_imutaveis
  BEFORE UPDATE OR DELETE OR TRUNCATE ON djen_resposta_chaves
  FOR EACH STATEMENT EXECUTE FUNCTION djen_impedir_alteracao_historico();

COMMIT;
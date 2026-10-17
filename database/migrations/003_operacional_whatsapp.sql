BEGIN;

CREATE SCHEMA IF NOT EXISTS operacional;

CREATE TABLE IF NOT EXISTS operacional.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cifrado BYTEA,
  nome_nonce BYTEA,
  nome_tag BYTEA,
  origem TEXT NOT NULL CHECK (origem IN ('LEAD', 'ANTIGO', 'NOVO')),
  primeiro_ad_id TEXT,
  primeiro_ctwa_clid TEXT,
  status TEXT NOT NULL DEFAULT 'INCOMPLETO'
    CHECK (status IN ('INCOMPLETO', 'PRONTO_PROCURACAO', 'COMPLETO')),
  faltando JSONB NOT NULL DEFAULT '[]'::JSONB,
  resumo_cifrado BYTEA,
  resumo_nonce BYTEA,
  resumo_tag BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (nome_cifrado IS NULL AND nome_nonce IS NULL AND nome_tag IS NULL)
    OR
    (nome_cifrado IS NOT NULL AND nome_nonce IS NOT NULL AND nome_tag IS NOT NULL)
  ),
  CHECK (
    (resumo_cifrado IS NULL AND resumo_nonce IS NULL AND resumo_tag IS NULL)
    OR
    (resumo_cifrado IS NOT NULL AND resumo_nonce IS NOT NULL AND resumo_tag IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS operacional.cliente_telefones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES operacional.clientes(id) ON DELETE RESTRICT,
  telefone_hmac CHAR(64) NOT NULL UNIQUE,
  telefone_cifrado BYTEA NOT NULL,
  telefone_nonce BYTEA NOT NULL,
  telefone_tag BYTEA NOT NULL,
  principal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS ix_operacional_cliente_telefones_cliente
  ON operacional.cliente_telefones (cliente_id);

CREATE TABLE IF NOT EXISTS operacional.webhook_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256_corpo CHAR(64) NOT NULL UNIQUE,
  payload_cifrado BYTEA NOT NULL,
  payload_nonce BYTEA NOT NULL,
  payload_tag BYTEA NOT NULL,
  assinatura_validada BOOLEAN NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'COMPLETO', 'ERRO')),
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  processado_em TIMESTAMPTZ,
  erro_codigo TEXT
);

CREATE INDEX IF NOT EXISTS ix_operacional_webhook_eventos_status
  ON operacional.webhook_eventos (status, recebido_em);

CREATE TABLE IF NOT EXISTS operacional.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_message_id TEXT NOT NULL UNIQUE,
  webhook_evento_id UUID NOT NULL REFERENCES operacional.webhook_eventos(id),
  cliente_id UUID NOT NULL REFERENCES operacional.clientes(id) ON DELETE RESTRICT,
  telefone_hmac CHAR(64) NOT NULL,
  direcao TEXT NOT NULL DEFAULT 'ENTRADA'
    CHECK (direcao IN ('ENTRADA', 'SAIDA')),
  tipo TEXT NOT NULL CHECK (
    tipo IN ('texto', 'audio', 'imagem', 'documento', 'video', 'sticker', 'outro')
  ),
  origem TEXT NOT NULL CHECK (origem IN ('LEAD', 'ANTIGO', 'NOVO')),
  ad_id TEXT,
  ctwa_clid TEXT,
  enviada_em TIMESTAMPTZ NOT NULL,
  conteudo_cifrado BYTEA NOT NULL,
  conteudo_nonce BYTEA NOT NULL,
  conteudo_tag BYTEA NOT NULL,
  transcricao_cifrada BYTEA,
  transcricao_nonce BYTEA,
  transcricao_tag BYTEA,
  transcricao_estado TEXT NOT NULL DEFAULT 'NAO_APLICAVEL'
    CHECK (transcricao_estado IN ('NAO_APLICAVEL', 'PENDENTE', 'PRONTA', 'ERRO')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (transcricao_cifrada IS NULL AND transcricao_nonce IS NULL AND transcricao_tag IS NULL)
    OR
    (transcricao_cifrada IS NOT NULL AND transcricao_nonce IS NOT NULL AND transcricao_tag IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS ix_operacional_mensagens_cliente_data
  ON operacional.mensagens (cliente_id, enviada_em DESC);

CREATE TABLE IF NOT EXISTS operacional.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES operacional.clientes(id) ON DELETE RESTRICT,
  mensagem_id UUID NOT NULL UNIQUE REFERENCES operacional.mensagens(id) ON DELETE RESTRICT,
  tipo_doc TEXT NOT NULL DEFAULT 'NAO_CLASSIFICADO'
    CHECK (tipo_doc IN (
      'RG', 'CPF', 'CNH', 'COMPROVANTE_ENDERECO', 'CONTRATO',
      'PROCURACAO', 'PROCURACAO_ASSINADA', 'DOCUMENTO_COMPROBATORIO',
      'OUTRO', 'NAO_CLASSIFICADO'
    )),
  mime_type TEXT,
  media_id_cifrado BYTEA,
  media_id_nonce BYTEA,
  media_id_tag BYTEA,
  nome_original_cifrado BYTEA,
  nome_original_nonce BYTEA,
  nome_original_tag BYTEA,
  caminho_local TEXT,
  sha256_arquivo CHAR(64),
  texto_ocr_cifrado BYTEA,
  texto_ocr_nonce BYTEA,
  texto_ocr_tag BYTEA,
  estado TEXT NOT NULL DEFAULT 'PENDENTE_DOWNLOAD'
    CHECK (estado IN ('PENDENTE_DOWNLOAD', 'QUARENTENA', 'PROCESSANDO', 'PRONTO', 'ERRO')),
  classificado_por TEXT NOT NULL DEFAULT 'REVISAO_PENDENTE'
    CHECK (classificado_por IN ('REGRA', 'REVISAO_HUMANA', 'REVISAO_PENDENTE')),
  erro_codigo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (media_id_cifrado IS NULL AND media_id_nonce IS NULL AND media_id_tag IS NULL)
    OR
    (media_id_cifrado IS NOT NULL AND media_id_nonce IS NOT NULL AND media_id_tag IS NOT NULL)
  ),
  CHECK (
    (nome_original_cifrado IS NULL AND nome_original_nonce IS NULL AND nome_original_tag IS NULL)
    OR
    (nome_original_cifrado IS NOT NULL AND nome_original_nonce IS NOT NULL AND nome_original_tag IS NOT NULL)
  ),
  CHECK (
    (texto_ocr_cifrado IS NULL AND texto_ocr_nonce IS NULL AND texto_ocr_tag IS NULL)
    OR
    (texto_ocr_cifrado IS NOT NULL AND texto_ocr_nonce IS NOT NULL AND texto_ocr_tag IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS ix_operacional_documentos_cliente_estado
  ON operacional.documentos (cliente_id, estado, created_at DESC);

COMMIT;
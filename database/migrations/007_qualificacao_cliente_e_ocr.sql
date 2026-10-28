BEGIN;

-- 1. Colunas de Qualificação Civil e Cadastral do Cliente para Emissão de Procuração e Contratos
ALTER TABLE operacional.clientes
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS rg VARCHAR(30),
  ADD COLUMN IF NOT EXISTS orgao_emissor VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nacionalidade VARCHAR(60) DEFAULT 'brasileiro(a)',
  ADD COLUMN IF NOT EXISTS estado_civil VARCHAR(40) DEFAULT 'solteiro(a)',
  ADD COLUMN IF NOT EXISTS profissao VARCHAR(100),
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
  ADD COLUMN IF NOT EXISTS uf VARCHAR(2),
  ADD COLUMN IF NOT EXISTS cep VARCHAR(12),
  ADD COLUMN IF NOT EXISTS dados_qualificacao JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS ix_operacional_clientes_cpf
  ON operacional.clientes (cpf)
  WHERE cpf IS NOT NULL;

COMMIT;

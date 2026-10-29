BEGIN;

-- 1. Permite o plano MASTER nos escritórios
ALTER TABLE escritorios
  DROP CONSTRAINT IF EXISTS escritorios_plano_check;

ALTER TABLE escritorios
  ADD CONSTRAINT escritorios_plano_check CHECK (
    plano IN ('PILOTO', 'SOLO', 'PRO', 'ENTERPRISE', 'MASTER')
  );

-- 2. Adiciona colunas para armazenamento criptografado (AES-256-GCM) do Token da Meta por Tenant (BYON)
ALTER TABLE escritorios
  ADD COLUMN IF NOT EXISTS whatsapp_access_token_cifrado BYTEA,
  ADD COLUMN IF NOT EXISTS whatsapp_access_token_nonce BYTEA,
  ADD COLUMN IF NOT EXISTS whatsapp_access_token_tag BYTEA,
  ADD COLUMN IF NOT EXISTS whatsapp_status_conexao VARCHAR(30) DEFAULT 'DESCONECTADO',
  ADD COLUMN IF NOT EXISTS whatsapp_ultimo_sync_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT clock_timestamp();

-- 3. Índice para busca ultra-rápida do escritório pelo phone_number_id nos webhooks da Meta
CREATE INDEX IF NOT EXISTS ix_escritorios_phone_number_id
  ON escritorios (whatsapp_phone_number_id)
  WHERE whatsapp_phone_number_id IS NOT NULL;

COMMIT;

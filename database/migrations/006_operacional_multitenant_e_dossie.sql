BEGIN;

-- 1. Vínculo do número oficial da Meta (Phone Number ID e WABA ID) e Identidade Visual (Logo) ao Escritório (Tenant)
ALTER TABLE escritorios
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_waba_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id VARCHAR(80) UNIQUE,
  ADD COLUMN IF NOT EXISTS whatsapp_display_phone VARCHAR(40);

-- 2. Isolamento Multi-tenant e Tipo de Caso no schema operacional (Padrão: NAO_CLASSIFICADO)
ALTER TABLE operacional.clientes
  ADD COLUMN IF NOT EXISTS escritorio_id UUID REFERENCES escritorios(id),
  ADD COLUMN IF NOT EXISTS tipo_caso VARCHAR(40) NOT NULL DEFAULT 'NAO_CLASSIFICADO',
  ADD COLUMN IF NOT EXISTS checklist_status JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE operacional.clientes
  ALTER COLUMN tipo_caso SET DEFAULT 'NAO_CLASSIFICADO';

ALTER TABLE operacional.clientes
  DROP CONSTRAINT IF EXISTS clientes_tipo_caso_check;

ALTER TABLE operacional.clientes
  ADD CONSTRAINT clientes_tipo_caso_check CHECK (
    tipo_caso IN (
      'NAO_CLASSIFICADO',
      'RCV_BANCARIO',
      'ECOMMERCE_ML',
      'CIVEL_CONSUMIDOR',
      'TRIBUTARIO',
      'TRABALHISTA',
      'PENAL',
      'GERAL'
    )
  );

CREATE INDEX IF NOT EXISTS ix_operacional_clientes_escritorio
  ON operacional.clientes (escritorio_id, updated_at DESC);

ALTER TABLE operacional.webhook_eventos
  ADD COLUMN IF NOT EXISTS escritorio_id UUID REFERENCES escritorios(id),
  ADD COLUMN IF NOT EXISTS phone_number_id VARCHAR(80);

-- 3. Correção do constraint de tipo de mensagem para aceitar tanto PT quanto EN da Meta Cloud API
ALTER TABLE operacional.mensagens
  DROP CONSTRAINT IF EXISTS mensagens_tipo_check;

ALTER TABLE operacional.mensagens
  ADD CONSTRAINT mensagens_tipo_check CHECK (
    tipo IN (
      'texto', 'audio', 'imagem', 'documento', 'video', 'sticker', 'outro',
      'text', 'image', 'document'
    )
  );

-- 4. Correção da coluna media_kind em operacional.documentos
ALTER TABLE operacional.documentos
  ADD COLUMN IF NOT EXISTS media_kind VARCHAR(30) NOT NULL DEFAULT 'DOCUMENT';

COMMIT;

BEGIN;

-- 1. Vínculo do número oficial da Meta (Phone Number ID) ao Escritório (Tenant)
ALTER TABLE escritorios
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id VARCHAR(80) UNIQUE,
  ADD COLUMN IF NOT EXISTS whatsapp_display_phone VARCHAR(40);

-- 2. Isolamento Multi-tenant e Tipo de Caso no schema operacional
ALTER TABLE operacional.clientes
  ADD COLUMN IF NOT EXISTS escritorio_id UUID REFERENCES escritorios(id),
  ADD COLUMN IF NOT EXISTS tipo_caso VARCHAR(40) NOT NULL DEFAULT 'ECOMMERCE_ML'
    CHECK (tipo_caso IN ('RCV_BANCARIO', 'ECOMMERCE_ML', 'GERAL')),
  ADD COLUMN IF NOT EXISTS checklist_status JSONB NOT NULL DEFAULT '{}'::JSONB;

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

-- 4. Correção da coluna media_kind em operacional.documentos (mapeada como bug no README)
ALTER TABLE operacional.documentos
  ADD COLUMN IF NOT EXISTS media_kind VARCHAR(30) NOT NULL DEFAULT 'DOCUMENT';

COMMIT;

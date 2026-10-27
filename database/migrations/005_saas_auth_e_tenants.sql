BEGIN;

CREATE TABLE IF NOT EXISTS escritorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(160) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  plano VARCHAR(40) NOT NULL DEFAULT 'PILOTO'
    CHECK (plano IN ('PILOTO', 'SOLO', 'PRO', 'ENTERPRISE')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE advogados
  ADD COLUMN IF NOT EXISTS escritorio_id UUID REFERENCES escritorios(id);

ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS escritorio_id UUID REFERENCES escritorios(id);

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID REFERENCES escritorios(id) ON DELETE RESTRICT,
  advogado_id UUID REFERENCES advogados(id) ON DELETE SET NULL,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL
    CHECK (role IN ('MASTER', 'ADMIN_DEV', 'ADVOGADO')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS ix_usuarios_escritorio_role
  ON usuarios (escritorio_id, role);

-- Garante que um usuário MASTER nunca seja rebaixado ou excluído por acidente via trigger
CREATE OR REPLACE FUNCTION auth_proteger_usuario_master()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'MASTER' THEN
    RAISE EXCEPTION 'Operação bloqueada: O usuário proprietário MASTER não pode ser removido.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.role = 'MASTER' AND (NEW.role <> 'MASTER' OR NEW.ativo = FALSE) THEN
    RAISE EXCEPTION 'Operação bloqueada: O usuário proprietário MASTER não pode ser desativado ou perder privilégios.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_usuario_master ON usuarios;
CREATE TRIGGER trg_proteger_usuario_master
  BEFORE UPDATE OR DELETE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION auth_proteger_usuario_master();

COMMIT;

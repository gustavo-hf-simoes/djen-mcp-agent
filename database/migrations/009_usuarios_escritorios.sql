BEGIN;

-- 1. Tabela de associação multi-tenant N:N entre usuários e escritórios
CREATE TABLE IF NOT EXISTS usuarios_escritorios (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  escritorio_id UUID NOT NULL REFERENCES escritorios(id) ON DELETE CASCADE,
  papel VARCHAR(30) DEFAULT 'MASTER',
  created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  PRIMARY KEY (usuario_id, escritorio_id)
);

-- 2. Popula os vínculos:
-- Usuário MASTER (Gustavo) vinculado a TODOS os escritórios (Master e ASO Advogados)
INSERT INTO usuarios_escritorios (usuario_id, escritorio_id, papel)
SELECT u.id, e.id, 'MASTER'
FROM usuarios u
CROSS JOIN escritorios e
WHERE u.role = 'MASTER'
ON CONFLICT (usuario_id, escritorio_id) DO NOTHING;

-- Usuário ADMIN_DEV (Alessandro) vinculado aos escritórios da plataforma
INSERT INTO usuarios_escritorios (usuario_id, escritorio_id, papel)
SELECT u.id, e.id, 'ADMIN_DEV'
FROM usuarios u
CROSS JOIN escritorios e
WHERE u.role = 'ADMIN_DEV'
ON CONFLICT (usuario_id, escritorio_id) DO NOTHING;

-- Usuário ADVOGADO (Dr. André) vinculado exclusivamente ao escritório ASO Advogados
INSERT INTO usuarios_escritorios (usuario_id, escritorio_id, papel)
SELECT u.id, u.escritorio_id, 'ADVOGADO'
FROM usuarios u
WHERE u.role = 'ADVOGADO' AND u.escritorio_id IS NOT NULL
ON CONFLICT (usuario_id, escritorio_id) DO NOTHING;

COMMIT;

import type { Pool } from 'pg';
import { hashPassword, signAuthToken, verifyPassword, type AuthTokenPayload, type UserRole } from './auth.crypto';

export interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  role: UserRole;
  ativo: boolean;
  escritorio_id: string | null;
  escritorio_nome: string | null;
  escritorio_slug: string | null;
  escritorio_plano: string | null;
  advogado_id: string | null;
  numero_oab: string | null;
  uf_oab: string | null;
  ultimo_login_em: string | null;
  created_at: string;
}

export interface UsuarioPublicoDto {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  escritorio: {
    id: string | null;
    nome: string | null;
    slug: string | null;
    plano: string | null;
  };
  oab: {
    numero: string;
    uf: string;
  };
  ultimoLoginEm: string | null;
}

export interface AuthServicePort {
  login(email: string, senha: string): Promise<{ token: string; usuario: UsuarioPublicoDto }>;
  obterPerfil(usuarioId: string): Promise<UsuarioPublicoDto | null>;
  listarUsuariosETenants(): Promise<{
    usuarios: UsuarioPublicoDto[];
    escritorios: Array<{ id: string; nome: string; slug: string; plano: string; ativo: boolean; totalProcessos: number; totalUsuarios: number }>;
  }>;
  garantirSeedInicial(): Promise<void>;
}

export class AuthUnauthorizedError extends Error {}

function mapearUsuarioPublico(row: UsuarioRow): UsuarioPublicoDto {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    role: row.role,
    ativo: row.ativo,
    escritorio: {
      id: row.escritorio_id,
      nome: row.escritorio_nome,
      slug: row.escritorio_slug,
      plano: row.escritorio_plano
    },
    oab: {
      numero: row.numero_oab ?? '69161',
      uf: row.uf_oab ?? 'PR'
    },
    ultimoLoginEm: row.ultimo_login_em
  };
}

export class AuthService implements AuthServicePort {
  constructor(private readonly pool: Pool) {}

  async login(email: string, senha: string): Promise<{ token: string; usuario: UsuarioPublicoDto }> {
    const emailLimpo = email.trim().toLowerCase();
    const result = await this.pool.query<UsuarioRow>(
      `SELECT u.id::text AS id, u.nome, u.email, u.senha_hash, u.role, u.ativo,
              u.escritorio_id::text AS escritorio_id,
              e.nome AS escritorio_nome, e.slug AS escritorio_slug, e.plano AS escritorio_plano,
              u.advogado_id::text AS advogado_id,
              a.numero_oab, a.uf_oab,
              u.ultimo_login_em::text AS ultimo_login_em,
              u.created_at::text AS created_at
       FROM usuarios u
       LEFT JOIN escritorios e ON e.id = u.escritorio_id
       LEFT JOIN advogados a ON a.id = u.advogado_id
       WHERE LOWER(u.email) = $1`,
      [emailLimpo]
    );

    const row = result.rows[0];
    if (!row || !row.ativo || !verifyPassword(senha, row.senha_hash)) {
      throw new AuthUnauthorizedError('E-mail ou senha inválidos.');
    }

    await this.pool.query(
      'UPDATE usuarios SET ultimo_login_em = clock_timestamp() WHERE id = $1::uuid',
      [row.id]
    );

    const usuario = mapearUsuarioPublico({
      ...row,
      ultimo_login_em: new Date().toISOString()
    });

    const payload: Omit<AuthTokenPayload, 'exp'> = {
      sub: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      role: usuario.role,
      escritorioId: usuario.escritorio.id,
      escritorioNome: usuario.escritorio.nome,
      numeroOab: usuario.oab.numero,
      ufOab: usuario.oab.uf
    };

    return {
      token: signAuthToken(payload),
      usuario
    };
  }

  async obterPerfil(usuarioId: string): Promise<UsuarioPublicoDto | null> {
    const result = await this.pool.query<UsuarioRow>(
      `SELECT u.id::text AS id, u.nome, u.email, u.senha_hash, u.role, u.ativo,
              u.escritorio_id::text AS escritorio_id,
              e.nome AS escritorio_nome, e.slug AS escritorio_slug, e.plano AS escritorio_plano,
              u.advogado_id::text AS advogado_id,
              a.numero_oab, a.uf_oab,
              u.ultimo_login_em::text AS ultimo_login_em,
              u.created_at::text AS created_at
       FROM usuarios u
       LEFT JOIN escritorios e ON e.id = u.escritorio_id
       LEFT JOIN advogados a ON a.id = u.advogado_id
       WHERE u.id = $1::uuid AND u.ativo = TRUE`,
      [usuarioId]
    );
    const row = result.rows[0];
    return row ? mapearUsuarioPublico(row) : null;
  }

  async listarUsuariosETenants() {
    const [usuariosRes, escritoriosRes] = await Promise.all([
      this.pool.query<UsuarioRow>(
        `SELECT u.id::text AS id, u.nome, u.email, u.senha_hash, u.role, u.ativo,
                u.escritorio_id::text AS escritorio_id,
                e.nome AS escritorio_nome, e.slug AS escritorio_slug, e.plano AS escritorio_plano,
                u.advogado_id::text AS advogado_id,
                a.numero_oab, a.uf_oab,
                u.ultimo_login_em::text AS ultimo_login_em,
                u.created_at::text AS created_at
         FROM usuarios u
         LEFT JOIN escritorios e ON e.id = u.escritorio_id
         LEFT JOIN advogados a ON a.id = u.advogado_id
         ORDER BY CASE u.role WHEN 'MASTER' THEN 1 WHEN 'ADMIN_DEV' THEN 2 ELSE 3 END, u.nome`
      ),
      this.pool.query<{
        id: string;
        nome: string;
        slug: string;
        plano: string;
        ativo: boolean;
        total_processos: string;
        total_usuarios: string;
      }>(
        `SELECT e.id::text AS id, e.nome, e.slug, e.plano, e.ativo,
                (SELECT COUNT(*)::text FROM processos p WHERE p.escritorio_id = e.id) AS total_processos,
                (SELECT COUNT(*)::text FROM usuarios u WHERE u.escritorio_id = e.id) AS total_usuarios
         FROM escritorios e
         ORDER BY e.created_at ASC`
      )
    ]);

    return {
      usuarios: usuariosRes.rows.map(mapearUsuarioPublico),
      escritorios: escritoriosRes.rows.map(e => ({
        id: e.id,
        nome: e.nome,
        slug: e.slug,
        plano: e.plano,
        ativo: e.ativo,
        totalProcessos: Number(e.total_processos ?? 0),
        totalUsuarios: Number(e.total_usuarios ?? 0)
      }))
    };
  }

  async garantirSeedInicial(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const escritorioRes = await client.query<{ id: string }>(
        `INSERT INTO escritorios (nome, slug, plano, ativo)
         VALUES ('André Oliveira Advocacia (Piloto)', 'andre-oliveira', 'PILOTO', TRUE)
         ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome
         RETURNING id::text AS id`
      );
      const escritorioId = escritorioRes.rows[0]?.id;

      const advogadoRes = await client.query<{ id: string }>(
        `SELECT id::text AS id FROM advogados WHERE numero_oab = '69161' AND uf_oab = 'PR' LIMIT 1`
      );
      let advogadoId = advogadoRes.rows[0]?.id ?? null;

      if (!advogadoId) {
        const novoAdv = await client.query<{ id: string }>(
          `INSERT INTO advogados (nome, numero_oab, uf_oab, socio_principal, escritorio_id)
           VALUES ('André Santos de Oliveira', '69161', 'PR', TRUE, $1::uuid)
           RETURNING id::text AS id`,
          [escritorioId]
        );
        advogadoId = novoAdv.rows[0]?.id ?? null;
      } else if (escritorioId) {
        await client.query(
          `UPDATE advogados SET escritorio_id = $1::uuid WHERE id = $2::uuid AND escritorio_id IS NULL`,
          [escritorioId, advogadoId]
        );
      }

      if (escritorioId) {
        await client.query(
          `UPDATE processos SET escritorio_id = $1::uuid WHERE escritorio_id IS NULL`,
          [escritorioId]
        );
      }

      const usuariosSeed: Array<{
        nome: string;
        email: string;
        senha: string;
        role: UserRole;
      }> = [
        {
          nome: 'Gustavo Simões (Proprietário Master)',
          email: 'gustavo@ghfs.adv.br',
          senha: process.env.SEED_MASTER_PASSWORD || 'Master@2026',
          role: 'MASTER'
        },
        {
          nome: 'André Santos de Oliveira',
          email: 'andre@oliveira.adv.br',
          senha: process.env.SEED_ANDRE_PASSWORD || 'Andre@2026',
          role: 'ADVOGADO'
        },
        {
          nome: 'Alessandro (Dev Front-end)',
          email: 'alessandro@ghfs.adv.br',
          senha: process.env.SEED_ALESSANDRO_PASSWORD || 'Alessandro@2026',
          role: 'ADMIN_DEV'
        }
      ];

      for (const u of usuariosSeed) {
        const existe = await client.query(
          'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)',
          [u.email]
        );
        if (existe.rows.length === 0) {
          await client.query(
            `INSERT INTO usuarios (escritorio_id, advogado_id, nome, email, senha_hash, role, ativo)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, TRUE)`,
            [escritorioId, advogadoId, u.nome, u.email, hashPassword(u.senha), u.role]
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

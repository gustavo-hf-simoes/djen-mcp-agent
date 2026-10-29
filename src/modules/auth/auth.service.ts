import type { Pool } from 'pg';
import { hashPassword, signAuthToken, verifyPassword, type AuthTokenPayload, type UserRole } from './auth.crypto';

/**
 * Logo oficial vetorizada ASO ADVOGADOS (extraída e isolada em SVG nítido sem fundo fotográfico).
 */
export const DEFAULT_ASO_LOGO_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">
      <rect width="240" height="160" rx="20" fill="#211E4A"/>
      <rect x="22" y="22" width="120" height="84" fill="#FFFFFF"/>
      <rect x="142" y="22" width="76" height="84" fill="#FF1E1E"/>
      <text x="82" y="86" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="500" fill="#211E4A" letter-spacing="2">AS</text>
      <text x="180" y="86" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="500" fill="#211E4A">O</text>
      <text x="120" y="136" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18.5" font-weight="600" fill="#FFFFFF" letter-spacing="7.5">ADVOGADOS</text>
    </svg>`
  );

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
  escritorio_logo_url?: string | null;
  advogado_id: string | null;
  numero_oab: string | null;
  uf_oab: string | null;
  ultimo_login_em: string | null;
  created_at: string;
}

export interface EscritorioResumoDto {
  id: string;
  nome: string;
  slug: string;
  plano: string;
  logoUrl?: string | null;
  whatsappDisplayPhone?: string | null;
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
    logoUrl?: string | null;
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
    escritorios: Array<{
      id: string;
      nome: string;
      slug: string;
      plano: string;
      logoUrl?: string | null;
      ativo: boolean;
      totalProcessos: number;
      totalUsuarios: number;
    }>;
  }>;
  trocarEscritorio?(
    usuarioId: string,
    escritorioId: string
  ): Promise<{ token: string; usuario: UsuarioPublicoDto }>;
  atualizarEscritorio?(
    escritorioId: string,
    dados: { nome?: string; logoUrl?: string | null }
  ): Promise<{ id: string; nome: string; logoUrl: string | null }>;
  garantirSeedInicial(): Promise<void>;
}

export class AuthUnauthorizedError extends Error {}

function mapearUsuarioPublico(row: UsuarioRow, escritoriosDisponiveis?: EscritorioResumoDto[]): UsuarioPublicoDto {
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
      plano: row.escritorio_plano,
      logoUrl: row.escritorio_logo_url ?? DEFAULT_ASO_LOGO_DATA_URL
    },
    oab: {
      numero: row.numero_oab ?? '69161',
      uf: row.uf_oab ?? 'PR'
    },
    ultimoLoginEm: row.ultimo_login_em,
    ...(escritoriosDisponiveis ? { escritoriosDisponiveis } : {})
  };
}

export class AuthService implements AuthServicePort {
  constructor(private readonly pool: Pool) {}

  private async listarEscritoriosDisponiveis(usuarioId: string, role: UserRole): Promise<EscritorioResumoDto[]> {
    if (role === 'MASTER' || role === 'ADMIN_DEV') {
      const res = await this.pool.query<{
        id: string;
        nome: string;
        slug: string;
        plano: string;
        logo_url: string | null;
        whatsapp_display_phone: string | null;
      }>(
        `SELECT id::text AS id, nome, slug, plano, logo_url, whatsapp_display_phone
         FROM escritorios
         WHERE ativo = TRUE
         ORDER BY CASE WHEN slug = 'ghfs-master' THEN 0 ELSE 1 END, nome ASC`
      );
      return res.rows.map(r => ({
        id: r.id,
        nome: r.nome,
        slug: r.slug,
        plano: r.plano,
        logoUrl: r.logo_url ?? (r.slug === 'andre-oliveira' ? DEFAULT_ASO_LOGO_DATA_URL : null),
        whatsappDisplayPhone: r.whatsapp_display_phone
      }));
    }

    const res = await this.pool.query<{
      id: string;
      nome: string;
      slug: string;
      plano: string;
      logo_url: string | null;
      whatsapp_display_phone: string | null;
    }>(
      `SELECT DISTINCT e.id::text AS id, e.nome, e.slug, e.plano, e.logo_url, e.whatsapp_display_phone
       FROM escritorios e
       LEFT JOIN usuarios_escritorios ue ON ue.escritorio_id = e.id AND ue.usuario_id = $1::uuid
       LEFT JOIN usuarios u ON u.escritorio_id = e.id AND u.id = $1::uuid
       WHERE e.ativo = TRUE AND (ue.escritorio_id IS NOT NULL OR u.id IS NOT NULL)
       ORDER BY e.nome ASC`,
      [usuarioId]
    );
    return res.rows.map(r => ({
      id: r.id,
      nome: r.nome,
      slug: r.slug,
      plano: r.plano,
      logoUrl: r.logo_url ?? (r.slug === 'andre-oliveira' ? DEFAULT_ASO_LOGO_DATA_URL : null),
      whatsappDisplayPhone: r.whatsapp_display_phone
    }));
  }

  async trocarEscritorio(
    usuarioId: string,
    escritorioId: string
  ): Promise<{ token: string; usuario: UsuarioPublicoDto }> {
    const userRes = await this.pool.query<UsuarioRow>(
      `SELECT u.id::text AS id, u.nome, u.email, u.senha_hash, u.role, u.ativo
       FROM usuarios u WHERE u.id = $1::uuid AND u.ativo = TRUE`,
      [usuarioId]
    );
    const user = userRes.rows[0];
    if (!user) throw new AuthUnauthorizedError('Usuário não encontrado.');

    const escRes = await this.pool.query<{
      id: string;
      nome: string;
      slug: string;
      plano: string;
      logo_url: string | null;
    }>(
      `SELECT id::text AS id, nome, slug, plano, logo_url FROM escritorios WHERE id = $1::uuid AND ativo = TRUE`,
      [escritorioId]
    );
    const esc = escRes.rows[0];
    if (!esc) throw new Error('Escritório selecionado não encontrado ou inativo.');

    if (user.role === 'ADVOGADO') {
      const permRes = await this.pool.query(
        `SELECT 1 FROM usuarios_escritorios WHERE usuario_id = $1::uuid AND escritorio_id = $2::uuid`,
        [usuarioId, escritorioId]
      );
      if (permRes.rows.length === 0) {
        throw new Error('Acesso não autorizado a este escritório.');
      }
    }

    let numeroOab = '69161';
    let ufOab = 'PR';
    let advogadoId: string | null = null;
    const advRes = await this.pool.query<{ id: string; numero_oab: string; uf_oab: string }>(
      `SELECT id::text AS id, numero_oab, uf_oab FROM advogados WHERE escritorio_id = $1::uuid LIMIT 1`,
      [escritorioId]
    );
    if (advRes.rows.length > 0) {
      advogadoId = advRes.rows[0].id;
      numeroOab = advRes.rows[0].numero_oab;
      ufOab = advRes.rows[0].uf_oab;
    }

    await this.pool.query(
      `UPDATE usuarios SET escritorio_id = $1::uuid, advogado_id = $2::uuid WHERE id = $3::uuid`,
      [escritorioId, advogadoId, usuarioId]
    );

    await this.pool.query(
      `INSERT INTO usuarios_escritorios (usuario_id, escritorio_id, papel)
       VALUES ($1::uuid, $2::uuid, $3)
       ON CONFLICT (usuario_id, escritorio_id) DO NOTHING`,
      [usuarioId, escritorioId, user.role]
    );

    const payload: Omit<AuthTokenPayload, 'exp'> = {
      sub: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role,
      escritorioId: esc.id,
      escritorioNome: esc.nome,
      numeroOab,
      ufOab
    };

    const perfil = await this.obterPerfil(user.id);
    if (!perfil) throw new Error('Falha ao recarregar perfil.');

    return {
      token: signAuthToken(payload),
      usuario: perfil
    };
  }


  async login(email: string, senha: string): Promise<{ token: string; usuario: UsuarioPublicoDto }> {
    const emailLimpo = email.trim().toLowerCase();
    const result = await this.pool.query<UsuarioRow>(
      `SELECT u.id::text AS id, u.nome, u.email, u.senha_hash, u.role, u.ativo,
              u.escritorio_id::text AS escritorio_id,
              e.nome AS escritorio_nome, e.slug AS escritorio_slug, e.plano AS escritorio_plano,
              e.logo_url AS escritorio_logo_url,
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

    const escritoriosDisponiveis = await this.listarEscritoriosDisponiveis(row.id, row.role);
    const usuario = mapearUsuarioPublico({
      ...row,
      ultimo_login_em: new Date().toISOString()
    }, escritoriosDisponiveis);

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
              e.logo_url AS escritorio_logo_url,
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
    if (!row) return null;
    const escritoriosDisponiveis = await this.listarEscritoriosDisponiveis(row.id, row.role);
    return mapearUsuarioPublico(row, escritoriosDisponiveis);
  }

  async listarUsuariosETenants() {
    const [usuariosRes, escritoriosRes] = await Promise.all([
      this.pool.query<UsuarioRow>(
        `SELECT u.id::text AS id, u.nome, u.email, u.senha_hash, u.role, u.ativo,
                u.escritorio_id::text AS escritorio_id,
                e.nome AS escritorio_nome, e.slug AS escritorio_slug, e.plano AS escritorio_plano,
                e.logo_url AS escritorio_logo_url,
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
        logo_url: string | null;
        ativo: boolean;
        total_processos: string;
        total_usuarios: string;
      }>(
        `SELECT e.id::text AS id, e.nome, e.slug, e.plano, e.logo_url, e.ativo,
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
        logoUrl: e.logo_url ?? DEFAULT_ASO_LOGO_DATA_URL,
        ativo: e.ativo,
        totalProcessos: Number(e.total_processos ?? 0),
        totalUsuarios: Number(e.total_usuarios ?? 0)
      }))
    };
  }

  async atualizarEscritorio(
    escritorioId: string,
    dados: { nome?: string; logoUrl?: string | null }
  ): Promise<{ id: string; nome: string; logoUrl: string | null }> {
    const nomeLimpo = typeof dados.nome === 'string' && dados.nome.trim() ? dados.nome.trim() : undefined;
    const logoLimpo =
      dados.logoUrl === null
        ? DEFAULT_ASO_LOGO_DATA_URL
        : typeof dados.logoUrl === 'string' && dados.logoUrl.trim()
        ? dados.logoUrl.trim()
        : undefined;

    const res = await this.pool.query<{ id: string; nome: string; logo_url: string | null }>(
      `UPDATE escritorios
       SET nome = COALESCE($2, nome),
           logo_url = COALESCE($3, logo_url),
           updated_at = clock_timestamp()
       WHERE id = $1::uuid
       RETURNING id::text AS id, nome, logo_url`,
      [escritorioId, nomeLimpo ?? null, logoLimpo ?? null]
    );

    if (res.rows.length === 0) {
      throw new Error('Escritório não encontrado.');
    }

    return {
      id: res.rows[0]!.id,
      nome: res.rows[0]!.nome,
      logoUrl: res.rows[0]!.logo_url ?? DEFAULT_ASO_LOGO_DATA_URL
    };
  }

  async garantirSeedInicial(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`ALTER TABLE escritorios ADD COLUMN IF NOT EXISTS logo_url TEXT`);

      // 1. Escritório Piloto ASO Advogados (Dr. André Santos de Oliveira)
      const escritorioRes = await client.query<{ id: string }>(
        `INSERT INTO escritorios (nome, slug, plano, logo_url, ativo)
         VALUES ('ASO Advogados', 'andre-oliveira', 'PILOTO', $1, TRUE)
         ON CONFLICT (slug) DO UPDATE
           SET nome = CASE WHEN escritorios.nome = 'André Oliveira Advocacia (Piloto)' THEN 'ASO Advogados' ELSE escritorios.nome END,
               logo_url = COALESCE(escritorios.logo_url, EXCLUDED.logo_url)
         RETURNING id::text AS id`,
        [DEFAULT_ASO_LOGO_DATA_URL]
      );
      const asoEscritorioId = escritorioRes.rows[0]?.id;

      // 2. Escritório Master (Gustavo Simões - Sede / Plataforma SaaS)
      const masterRes = await client.query<{ id: string }>(
        `INSERT INTO escritorios (
           nome, slug, plano, ativo,
           whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_display_phone,
           whatsapp_status_conexao
         ) VALUES (
           'GHFS Tecnologia Jurídica (Master)', 'ghfs-master', 'MASTER', TRUE,
           $1, $2, $3, 'CONECTADO'
         )
         ON CONFLICT (slug) DO UPDATE
           SET plano = 'MASTER',
               whatsapp_phone_number_id = COALESCE(escritorios.whatsapp_phone_number_id, EXCLUDED.whatsapp_phone_number_id),
               whatsapp_waba_id = COALESCE(escritorios.whatsapp_waba_id, EXCLUDED.whatsapp_waba_id),
               whatsapp_display_phone = COALESCE(escritorios.whatsapp_display_phone, EXCLUDED.whatsapp_display_phone)
         RETURNING id::text AS id`,
        [
          process.env.WHATSAPP_PHONE_NUMBER_ID || '1461573947028881',
          process.env.WHATSAPP_WABA_ID || '2346185095786771',
          process.env.WHATSAPP_DISPLAY_PHONE || '5543996034632'
        ]
      );
      const masterEscritorioId = masterRes.rows[0]?.id;

      const advogadoRes = await client.query<{ id: string }>(
        `SELECT id::text AS id FROM advogados WHERE numero_oab = '69161' AND uf_oab = 'PR' LIMIT 1`
      );
      let advogadoId = advogadoRes.rows[0]?.id ?? null;

      if (!advogadoId) {
        const novoAdv = await client.query<{ id: string }>(
          `INSERT INTO advogados (nome, numero_oab, uf_oab, socio_principal, escritorio_id)
           VALUES ('André Santos de Oliveira', '69161', 'PR', TRUE, $1::uuid)
           RETURNING id::text AS id`,
          [asoEscritorioId]
        );
        advogadoId = novoAdv.rows[0]?.id ?? null;
      } else if (asoEscritorioId) {
        await client.query(
          `UPDATE advogados SET escritorio_id = $1::uuid WHERE id = $2::uuid AND escritorio_id IS NULL`,
          [asoEscritorioId, advogadoId]
        );
      }

      if (asoEscritorioId) {
        await client.query(
          `UPDATE processos SET escritorio_id = $1::uuid WHERE escritorio_id IS NULL`,
          [asoEscritorioId]
        );
      }

      const usuariosSeed: Array<{
        nome: string;
        email: string;
        senha: string;
        role: UserRole;
        escritorioId: string | undefined;
        advogadoId: string | null;
      }> = [
        {
          nome: 'Gustavo Simões (Proprietário Master)',
          email: 'gustavo@ghfs.adv.br',
          senha: process.env.SEED_MASTER_PASSWORD || 'Master@2026',
          role: 'MASTER',
          escritorioId: masterEscritorioId,
          advogadoId: null
        },
        {
          nome: 'André Santos de Oliveira',
          email: 'andre@oliveira.adv.br',
          senha: process.env.SEED_ANDRE_PASSWORD || 'Andre@2026',
          role: 'ADVOGADO',
          escritorioId: asoEscritorioId,
          advogadoId
        },
        {
          nome: 'Alessandro (Dev Front-end)',
          email: 'alessandro@ghfs.adv.br',
          senha: process.env.SEED_ALESSANDRO_PASSWORD || 'Alessandro@2026',
          role: 'ADMIN_DEV',
          escritorioId: masterEscritorioId,
          advogadoId: null
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
            [u.escritorioId, u.advogadoId, u.nome, u.email, hashPassword(u.senha), u.role]
          );
        } else if (u.escritorioId) {
          await client.query(
            `UPDATE usuarios
             SET escritorio_id = $1::uuid,
                 advogado_id = $2::uuid
             WHERE LOWER(email) = LOWER($3)`,
            [u.escritorioId, u.advogadoId, u.email]
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

import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken, type AuthTokenPayload, type UserRole } from './auth.crypto';
import { AuthUnauthorizedError, type AuthServicePort } from './auth.service';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthTokenPayload;
    }
  }
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && typeof header === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (match?.[1]?.trim()) return match[1].trim();
  }
  if (typeof req.query.token === 'string' && req.query.token.trim().length > 0) {
    return req.query.token.trim();
  }
  return null;
}

export function requireAuth(enabled = true) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled) return next();
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Não autenticado. Faça login no SaaS para acessar este recurso.' });
    }
    const payload = verifyAuthToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
    req.authUser = payload;

    // Isolamento Multi-tenant: Advogado só pode consultar sua própria OAB vinculada
    if (payload.role === 'ADVOGADO') {
      req.query.numeroOab = payload.numeroOab;
      req.query.ufOab = payload.ufOab;
    }

    return next();
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({ error: 'Acesso restrito ao proprietário MASTER ou administrador autorizado.' });
    }
    return next();
  };
}

export class AuthController {
  constructor(private readonly authService: AuthServicePort) {}

  async login(req: Request, res: Response) {
    try {
      const { email, senha } = req.body ?? {};
      if (typeof email !== 'string' || !email.trim() || typeof senha !== 'string' || !senha) {
        return res.status(400).json({ error: 'Informe e-mail e senha para entrar.' });
      }
      const sessao = await this.authService.login(email, senha);
      return res.json(sessao);
    } catch (error) {
      if (error instanceof AuthUnauthorizedError) {
        return res.status(401).json({ error: error.message });
      }
      console.error('Erro no login SaaS:', error);
      return res.status(500).json({ error: 'Falha interna ao realizar autenticação.' });
    }
  }

  async me(req: Request, res: Response) {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: 'Sessão não autenticada.' });
      }
      const perfil = await this.authService.obterPerfil(req.authUser.sub);
      if (!perfil) {
        return res.status(401).json({ error: 'Usuário não encontrado ou inativo.' });
      }
      return res.json({ usuario: perfil });
    } catch (error) {
      console.error('Erro ao carregar perfil autenticado:', error);
      return res.status(500).json({ error: 'Não foi possível validar a sessão.' });
    }
  }

  async listarUsuariosETenants(_req: Request, res: Response) {
    try {
      const dados = await this.authService.listarUsuariosETenants();
      return res.json(dados);
    } catch (error) {
      console.error('Erro ao listar tenants e usuários do SaaS:', error);
      return res.status(500).json({ error: 'Não foi possível consultar a administração do SaaS.' });
    }
  }

  async trocarEscritorio(req: Request, res: Response) {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: 'Sessão não autenticada.' });
      }
      if (!this.authService.trocarEscritorio) {
        return res.status(501).json({ error: 'Troca de escritório não disponível.' });
      }
      const { escritorioId } = req.body ?? {};
      if (typeof escritorioId !== 'string' || !escritorioId.trim()) {
        return res.status(400).json({ error: 'Informe o ID do escritório de destino.' });
      }
      const resultado = await this.authService.trocarEscritorio(req.authUser.sub, escritorioId.trim());
      return res.json(resultado);
    } catch (error: any) {
      console.error('Erro ao trocar escritório ativo:', error);
      return res.status(400).json({ error: error.message || 'Falha ao trocar escritório.' });
    }
  }

  async atualizarEscritorio(req: Request, res: Response) {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: 'Sessão não autenticada.' });
      }
      if (!this.authService.atualizarEscritorio) {
        return res.status(501).json({ error: 'Atualização de escritório não habilitada.' });
      }

      const body = req.body ?? {};
      const targetEscritorioId =
        req.authUser.role === 'MASTER' && typeof body.escritorioId === 'string' && body.escritorioId.trim()
          ? body.escritorioId.trim()
          : req.authUser.escritorioId;

      if (!targetEscritorioId) {
        return res.status(400).json({ error: 'Nenhum escritório vinculado para atualização.' });
      }

      const atualizado = await this.authService.atualizarEscritorio(targetEscritorioId, {
        ...(typeof body.nome === 'string' ? { nome: body.nome } : {}),
        ...(body.logoUrl === null || typeof body.logoUrl === 'string' ? { logoUrl: body.logoUrl } : {})
      });

      return res.json({ escritorio: atualizado });
    } catch (error) {
      console.error('Erro ao atualizar identidade do escritório:', error);
      return res.status(500).json({ error: 'Não foi possível atualizar a identidade do escritório.' });
    }
  }
}

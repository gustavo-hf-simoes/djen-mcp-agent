import type { Request, Response } from 'express';

export interface DjenServicePort {
  consultarDjen(filtros: URLSearchParams): Promise<unknown>;
  atualizarStatus(id: string, status: string): Promise<unknown>;
  sincronizarRecentes?(opcoes?: { numeroOab?: string; ufOab?: string; dias?: number }): Promise<unknown>;
}

/** Adapta requisições HTTP às operações expostas pelo módulo DJEN. */
export class DjenController {
  constructor(private readonly djenService: DjenServicePort) {}

  async listar(req: Request, res: Response) {
    try {
      const filtros = this.toSearchParams(req.query);
      if (req.authUser?.role === 'ADVOGADO') {
        filtros.set('numeroOab', req.authUser.numeroOab);
        filtros.set('ufOab', req.authUser.ufOab);
      }
      const dados = await this.djenService.consultarDjen(filtros);
      return res.json(dados);
    } catch (error: any) {
      console.error('❌ Erro no controller ao consultar o DJEN:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  async atualizarStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (typeof id !== 'string' || typeof status !== 'string') {
        return res.status(400).json({ error: 'ID e status são obrigatórios.' });
      }
      const resultado = await this.djenService.atualizarStatus(id, status);
      return res.json(resultado);
    } catch (error: any) {
      console.error('❌ Erro no controller ao atualizar status:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  async sincronizar(req: Request, res: Response) {
    try {
      if (!this.djenService.sincronizarRecentes) {
        return res.status(501).json({ error: 'Sincronização não configurada.' });
      }
      const dias = typeof req.body?.dias === 'number' ? req.body.dias : 14;
      const numeroOab = typeof req.query.numeroOab === 'string'
        ? req.query.numeroOab
        : typeof req.body?.numeroOab === 'string'
          ? req.body.numeroOab
          : undefined;
      const ufOab = typeof req.query.ufOab === 'string'
        ? req.query.ufOab
        : typeof req.body?.ufOab === 'string'
          ? req.body.ufOab
          : undefined;

      const resultado = await this.djenService.sincronizarRecentes({
        ...(numeroOab ? { numeroOab } : {}),
        ...(ufOab ? { ufOab } : {}),
        dias
      });
      return res.json(resultado);
    } catch (error: any) {
      console.error('❌ Erro ao sincronizar DJEN:', error.message);
      return res.status(500).json({ error: error.message || 'Falha ao sincronizar com o DJEN.' });
    }
  }

  private toSearchParams(values: Record<string, unknown>): URLSearchParams {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string' || typeof value === 'number') {
        params.append(key, String(value));
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' || typeof item === 'number') {
            params.append(key, String(item));
          }
        }
      }
    }
    return params;
  }
}
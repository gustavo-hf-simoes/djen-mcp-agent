import type { Request, Response } from 'express';

export interface DjenServicePort {
  consultarDjen(filtros: URLSearchParams): Promise<unknown>;
  atualizarStatus(id: string, status: string): Promise<unknown>;
}

export class DjenController {
  constructor(private readonly djenService: DjenServicePort) {}

  async listar(req: Request, res: Response) {
    try {
      const filtros = this.toSearchParams(req.query);
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
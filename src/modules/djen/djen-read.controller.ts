import type { Request, Response } from 'express';
import { DjenReadService, DjenReadValidationError, type DjenReadQuery } from './application/djen-read.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toQuery(req: Request): DjenReadQuery {
  const values = req.query;
  const result: Record<string, string> = {};
  for (const key of [
    'numeroOab', 'ufOab', 'pagina', 'itensPorPagina', 'numeroProcesso',
    'tribunal', 'status', 'dataInicio', 'dataFim'
  ]) {
    const value = values[key];
    if (typeof value === 'string') result[key] = value;
  }
  if (req.authUser?.role === 'ADVOGADO') {
    result.numeroOab = req.authUser.numeroOab;
    result.ufOab = req.authUser.ufOab;
  }
  return result;
}

/** Adapta os endpoints locais de dashboard e leitura ao serviço de consulta. */
export class DjenReadController {
  constructor(private readonly service: DjenReadService) {}

  async listarProcessos(req: Request, res: Response) {
    try {
      return res.json(await this.service.listarProcessos(toQuery(req)));
    } catch (error) {
      return this.responderErro(res, error);
    }
  }

  async listarPublicacoes(req: Request, res: Response) {
    try {
      return res.json(await this.service.listarPublicacoes(toQuery(req)));
    } catch (error) {
      return this.responderErro(res, error);
    }
  }

  async listarPublicacoesDoProcesso(req: Request, res: Response) {
    try {
      const processoId = req.params.id;
      if (typeof processoId !== 'string' || !UUID_PATTERN.test(processoId)) {
        return res.status(400).json({ error: 'ID de processo inválido.' });
      }
      return res.json(await this.service.listarPublicacoesDoProcesso(processoId, toQuery(req)));
    } catch (error) {
      return this.responderErro(res, error);
    }
  }

  async dashboard(req: Request, res: Response) {
    try {
      return res.json(await this.service.dashboard(toQuery(req)));
    } catch (error) {
      return this.responderErro(res, error);
    }
  }

  listarTribunais(_req: Request, res: Response) {
    return res.json({ items: this.service.listarTribunais() });
  }

  private responderErro(res: Response, error: unknown) {
    if (error instanceof DjenReadValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro na leitura local de publicações DJEN:', error);
    return res.status(500).json({ error: 'Não foi possível consultar as publicações locais.' });
  }
}
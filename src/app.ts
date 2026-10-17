import express from 'express';
import cors from 'cors';
import type { DjenController } from './modules/djen/djen.controller';

export function createApp(djenController: DjenController) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/v1/comunicacao', (req, res) => djenController.listar(req, res));
  app.patch('/api/djen/intimacoes/:id/status', (req, res) => djenController.atualizarStatus(req, res));

  return app;
}
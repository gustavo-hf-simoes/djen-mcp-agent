import dotenv from 'dotenv';
import { DjenController } from './modules/djen/djen.controller';
import { DjenService } from './modules/djen/djen.service';
import { createApp } from './app';

dotenv.config();

const djenController = new DjenController(new DjenService());
const app = createApp(djenController);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Servidor Backend rodando na porta ${PORT}`);
  console.log(`🔗 Consulta de Comunicações: GET http://localhost:${PORT}/api/v1/comunicacao`);
  console.log(`==================================================\n`);
});
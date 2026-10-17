import dotenv from 'dotenv';
import { DjenController } from './modules/djen/djen.controller';
import { DjenService } from './modules/djen/djen.service';
import { DjenReadController } from './modules/djen/djen-read.controller';
import { DjenReadService } from './modules/djen/application/djen-read.service';
import { DjenReadRepository } from './modules/djen/infrastructure/djen-read.repository';
import { createApp, mapearEndpoints } from './app';
import { pool } from './database';
import { WhatsAppWebhookController } from './modules/operacional/whatsapp.controller';
import { WhatsAppWebhookService } from './modules/operacional/whatsapp.service';
import { secretKeyFromHex } from './modules/operacional/whatsapp.crypto';

dotenv.config();

const djenController = new DjenController(new DjenService());
const djenReadController = new DjenReadController(new DjenReadService(new DjenReadRepository(pool)));
const whatsappEncryptionKey = secretKeyFromHex(
  process.env.WHATSAPP_DATA_ENCRYPTION_KEY,
  'WHATSAPP_DATA_ENCRYPTION_KEY'
);
const whatsappPhoneHashKey = secretKeyFromHex(
  process.env.WHATSAPP_PHONE_HASH_KEY,
  'WHATSAPP_PHONE_HASH_KEY'
);
const whatsappController = new WhatsAppWebhookController(
  new WhatsAppWebhookService(pool, {
    ...(whatsappEncryptionKey ? { encryptionKey: whatsappEncryptionKey } : {}),
    ...(whatsappPhoneHashKey ? { phoneHashKey: whatsappPhoneHashKey } : {})
  }),
  {
    ...(process.env.WHATSAPP_VERIFY_TOKEN ? { verifyToken: process.env.WHATSAPP_VERIFY_TOKEN } : {}),
    ...(process.env.WHATSAPP_APP_SECRET ? { appSecret: process.env.WHATSAPP_APP_SECRET } : {})
  }
);
const app = createApp(djenController, whatsappController, djenReadController);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Servidor Backend rodando na porta ${PORT}`);
  console.log(mapearEndpoints(`http://localhost:${PORT}`, Boolean(whatsappController)));
  console.log(`==================================================\n`);
});
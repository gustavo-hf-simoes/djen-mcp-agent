import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { DjenController } from './modules/djen/djen.controller';
import { DjenService } from './modules/djen/djen.service';
import { DjenReadController } from './modules/djen/djen-read.controller';
import { DjenReadService } from './modules/djen/application/djen-read.service';
import { DjenReadRepository } from './modules/djen/infrastructure/djen-read.repository';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { createApp, mapearEndpoints } from './app';
import { pool } from './database';
import { WhatsAppWebhookController } from './modules/operacional/whatsapp.controller';
import { WhatsAppWebhookService } from './modules/operacional/whatsapp.service';
import { secretKeyFromHex } from './modules/operacional/whatsapp.crypto';

dotenv.config();

const authService = new AuthService(pool);
const authController = new AuthController(authService);
const djenController = new DjenController(new DjenService());
const djenReadController = new DjenReadController(new DjenReadService(new DjenReadRepository(pool)));

const defaultEncHex = createHash('sha256')
  .update(process.env.JWT_SECRET || 'djen-whatsapp-aes256-gcm-master-key-2026')
  .digest('hex');
const defaultHashHex = createHash('sha256')
  .update(process.env.JWT_SECRET || 'djen-whatsapp-phone-hmac-master-key-2026')
  .digest('hex');

const whatsappEncryptionKey = secretKeyFromHex(
  process.env.WHATSAPP_DATA_ENCRYPTION_KEY || defaultEncHex,
  'WHATSAPP_DATA_ENCRYPTION_KEY'
);
const whatsappPhoneHashKey = secretKeyFromHex(
  process.env.WHATSAPP_PHONE_HASH_KEY || defaultHashHex,
  'WHATSAPP_PHONE_HASH_KEY'
);

const whatsappService = new WhatsAppWebhookService(pool, {
  ...(whatsappEncryptionKey ? { encryptionKey: whatsappEncryptionKey } : {}),
  ...(whatsappPhoneHashKey ? { phoneHashKey: whatsappPhoneHashKey } : {})
});

const whatsappController = new WhatsAppWebhookController(whatsappService, {
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'djen-meta-verify-2026',
  ...(process.env.WHATSAPP_APP_SECRET
    ? { appSecret: process.env.WHATSAPP_APP_SECRET }
    : { allowSandboxWithoutAppSecret: true })
});

const app = createApp(djenController, whatsappController, djenReadController, authController);

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    await authService.garantirSeedInicial();
    console.log('🔐 Controle de acesso SaaS (RBAC Master/Admin/Advogado) verificado.');
  } catch (err: any) {
    console.warn('⚠️ Aviso ao verificar seed inicial SaaS:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Servidor Backend SaaS rodando na porta ${PORT}`);
    console.log(mapearEndpoints(`http://localhost:${PORT}`, Boolean(whatsappController)));
    console.log(`==================================================\n`);
  });
}

void bootstrap();

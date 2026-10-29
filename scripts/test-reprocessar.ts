import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { pool } from '../src/database';
import { secretKeyFromHex } from '../src/modules/operacional/whatsapp.crypto';
import { WhatsAppWebhookService } from '../src/modules/operacional/whatsapp.service';

dotenv.config();

async function run() {
  console.log('--- Iniciando Reprocessamento com Token BYON Master ---');
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

  const service = new WhatsAppWebhookService(pool, {
    ...(whatsappEncryptionKey ? { encryptionKey: whatsappEncryptionKey } : {}),
    ...(whatsappPhoneHashKey ? { phoneHashKey: whatsappPhoneHashKey } : {})
  });

  const clienteId = '1d1cc814-759a-49db-849a-605a720536b8';

  // Verifica documentos do cliente
  const docs = await pool.query(
    `SELECT d.id, d.media_kind, d.mime_type, d.caminho_local, m.transcricao_estado
     FROM operacional.documentos d
     JOIN operacional.mensagens m ON m.id = d.mensagem_id
     WHERE d.cliente_id = $1`,
    [clienteId]
  );
  console.log('Documentos antes do reprocessamento:', docs.rows);

  // Executa o reprocessamento
  console.log('Chamando service.processarMidiasPendentesCliente...');
  const res = await service.processarMidiasPendentesCliente(clienteId);
  console.log('Resultado do reprocessamento:', res);

  // Verifica documentos e transcrição após o reprocessamento
  const docsDepois = await pool.query(
    `SELECT d.id, d.media_kind, d.mime_type, d.caminho_local, m.transcricao_estado,
            m.transcricao_cifrada IS NOT NULL as tem_transcricao
     FROM operacional.documentos d
     JOIN operacional.mensagens m ON m.id = d.mensagem_id
     WHERE d.cliente_id = $1`,
    [clienteId]
  );
  console.log('Documentos APÓS o reprocessamento:', docsDepois.rows);

  const dossie = await service.obterDossieCliente(clienteId);
  console.log('Mensagens do dossiê:');
  for (const m of dossie?.mensagens || []) {
    console.log(`[${m.tipo}] enviada: ${m.enviadaEm} | transcricaoEstado: ${m.transcricaoEstado}`);
    if (m.transcricao) {
      console.log(`   Transcrição: "${m.transcricao}"`);
    }
  }

  await pool.end();
}

run().catch(err => {
  console.error('Erro na execução:', err);
  process.exit(1);
});

import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { pool } from '../src/database';
import { encryptValue, secretKeyFromHex } from '../src/modules/operacional/whatsapp.crypto';

dotenv.config();

async function run() {
  const client = await pool.connect();
  try {
    console.log('--- Configurando Master Tenant e Credenciais BYON ---');
    const defaultEncHex = createHash('sha256')
      .update(process.env.JWT_SECRET || 'djen-whatsapp-aes256-gcm-master-key-2026')
      .digest('hex');
    const encryptionKey = secretKeyFromHex(
      process.env.WHATSAPP_DATA_ENCRYPTION_KEY || defaultEncHex,
      'WHATSAPP_DATA_ENCRYPTION_KEY'
    )!;

    const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    if (!token) {
      console.error('WHATSAPP_ACCESS_TOKEN não encontrado no .env!');
      process.exit(1);
    }

    console.log('Token encontrado no .env, tamanho:', token.length);

    // Criptografa o token permanentemente via AES-256-GCM
    const encToken = encryptValue(token, encryptionKey);

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '994468647087640';
    const wabaId = process.env.WHATSAPP_WABA_ID || '2346185095786771';
    const displayPhone = process.env.WHATSAPP_DISPLAY_PHONE || '+1 555-168-9844';

    // 1. Cria ou atualiza o Escritório Master
    const masterRes = await client.query(
      `INSERT INTO escritorios (
         nome, slug, plano, ativo,
         whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_display_phone,
         whatsapp_access_token_cifrado, whatsapp_access_token_nonce, whatsapp_access_token_tag,
         whatsapp_status_conexao, whatsapp_ultimo_sync_em
       ) VALUES (
         'GHFS Tecnologia Jurídica (Master)', 'ghfs-master', 'MASTER', TRUE,
         $1, $2, $3,
         $4, $5, $6,
         'CONECTADO', clock_timestamp()
       )
       ON CONFLICT (slug) DO UPDATE
         SET nome = 'GHFS Tecnologia Jurídica (Master)',
             plano = 'MASTER',
             whatsapp_phone_number_id = EXCLUDED.whatsapp_phone_number_id,
             whatsapp_waba_id = EXCLUDED.whatsapp_waba_id,
             whatsapp_display_phone = EXCLUDED.whatsapp_display_phone,
             whatsapp_access_token_cifrado = EXCLUDED.whatsapp_access_token_cifrado,
             whatsapp_access_token_nonce = EXCLUDED.whatsapp_access_token_nonce,
             whatsapp_access_token_tag = EXCLUDED.whatsapp_access_token_tag,
             whatsapp_status_conexao = 'CONECTADO',
             whatsapp_ultimo_sync_em = clock_timestamp(),
             updated_at = clock_timestamp()
       RETURNING id::text AS id, nome, slug`,
      [
        phoneNumberId,
        wabaId,
        displayPhone,
        encToken.ciphertext,
        encToken.nonce,
        encToken.tag
      ]
    );

    const masterId = masterRes.rows[0].id;
    console.log(`✅ Escritório Master criado/atualizado: [${masterId}] ${masterRes.rows[0].nome}`);

    // 2. Vincula o usuário MASTER (Gustavo) ao escritório Master
    const userUpdate = await client.query(
      `UPDATE usuarios
       SET escritorio_id = $1::uuid
       WHERE role = 'MASTER' OR LOWER(email) = 'gustavo@ghfs.adv.br'
       RETURNING id, nome, email, role, escritorio_id`,
      [masterId]
    );
    console.log('✅ Usuário Master vinculado:', userUpdate.rows);

    // 3. Vincula o Alessandro (ADMIN_DEV) ao Master também
    const devUpdate = await client.query(
      `UPDATE usuarios
       SET escritorio_id = $1::uuid
       WHERE role = 'ADMIN_DEV' OR LOWER(email) = 'alessandro@ghfs.adv.br'
       RETURNING id, nome, email, role, escritorio_id`,
      [masterId]
    );
    console.log('✅ Usuário Admin/Dev vinculado:', devUpdate.rows);

    // 4. Vincula o cliente de teste e os eventos do webhook do número da Meta ao escritório Master
    const clientUpdate = await client.query(
      `UPDATE operacional.clientes
       SET escritorio_id = $1::uuid
       WHERE id = '1d1cc814-759a-49db-849a-605a720536b8' OR escritorio_id IS NULL
       RETURNING id, escritorio_id`,
      [masterId]
    );
    console.log(`✅ Clientes vinculados ao Master: ${clientUpdate.rowCount}`);

    const webhookUpdate = await client.query(
      `UPDATE operacional.webhook_eventos
       SET escritorio_id = $1::uuid
       WHERE phone_number_id = $2 OR escritorio_id IS NULL`,
      [masterId, phoneNumberId]
    );
    console.log(`✅ Eventos webhook vinculados ao Master: ${webhookUpdate.rowCount}`);

    console.log('🎉 Seed Master Concluído com Sucesso!');
  } catch (err: any) {
    console.error('❌ Erro no seed master:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

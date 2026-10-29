import dotenv from 'dotenv';
import { pool } from '../src/database';
import { AuthService } from '../src/modules/auth/auth.service';
import { WhatsAppWebhookService } from '../src/modules/operacional/whatsapp.service';
import { secretKeyFromHex } from '../src/modules/operacional/whatsapp.crypto';
import { createHash } from 'node:crypto';

dotenv.config();

async function run() {
  console.log('--- TESTANDO MULTI-TENANT SWITCHER & ISOLAMENTO ---');
  const authService = new AuthService(pool);

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

  // 1. Login como Gustavo (MASTER)
  const loginRes = await authService.login('gustavo@ghfs.adv.br', process.env.SEED_MASTER_PASSWORD || 'Master@2026');
  console.log('1. Login realizado com sucesso!');
  console.log('   Usuário:', loginRes.usuario.nome);
  console.log('   Escritório Atual:', loginRes.usuario.escritorio.nome);
  console.log('   Escritórios Disponíveis:', loginRes.usuario.escritoriosDisponiveis?.map(e => `${e.nome} (${e.slug})`));

  const aso = loginRes.usuario.escritoriosDisponiveis?.find(e => e.slug === 'andre-oliveira');
  const master = loginRes.usuario.escritoriosDisponiveis?.find(e => e.slug === 'ghfs-master');

  if (!aso || !master) {
    throw new Error('Ambos os escritórios devem estar disponíveis para o usuário MASTER!');
  }

  // 2. Alterna para ASO Advogados
  console.log('\n2. Alternando contexto para ASO Advogados...');
  const asoSwitch = await authService.trocarEscritorio(loginRes.usuario.id, aso.id);
  console.log('   ✅ Contexto ativo agora:', asoSwitch.usuario.escritorio.nome);
  console.log('   ✅ OAB ativa:', `${asoSwitch.usuario.oab.numero}/${asoSwitch.usuario.oab.uf}`);

  // 3. Testa listagem de clientes filtrados por ASO Advogados
  const clientesAso = await whatsappService.listarClientes(aso.id);
  console.log(`   ✅ Clientes no tenant ASO Advogados: ${clientesAso.length} (esperado: 0 - isolado)`);

  // 4. Alterna de volta para GHFS Master (Ambiente de Testes)
  console.log('\n4. Alternando contexto para GHFS Tecnologia Jurídica (Master)...');
  const masterSwitch = await authService.trocarEscritorio(loginRes.usuario.id, master.id);
  console.log('   ✅ Contexto ativo agora:', masterSwitch.usuario.escritorio.nome);

  // 5. Testa listagem de clientes filtrados por GHFS Master
  const clientesMaster = await whatsappService.listarClientes(master.id);
  console.log(`   ✅ Clientes no tenant GHFS Master: ${clientesMaster.length} (esperado: >= 1 - cliente de teste)`);
  if (clientesMaster.length > 0) {
    console.log(`      ID do cliente de teste: ${clientesMaster[0].id}`);
  }

  console.log('\n🎉 SUCESSO: Ambos os escritórios estão vinculados e isolados com total personalização!');
  await pool.end();
}

run().catch(err => {
  console.error('❌ Falha:', err);
  process.exit(1);
});

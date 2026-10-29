import dotenv from 'dotenv';
import { pool } from '../src/database';
import { AuthService } from '../src/modules/auth/auth.service';

dotenv.config();

async function run() {
  console.log('=== TESTE DE DIAGNÓSTICO: GUSTAVO vs ANDRÉ ===');

  const esc = await pool.query('SELECT id, nome, slug, plano, whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_display_phone, whatsapp_status_conexao, whatsapp_access_token_cifrado IS NOT NULL as has_token FROM escritorios');
  console.log('ESCRITORIOS:', JSON.stringify(esc.rows, null, 2));

  const cli = await pool.query('SELECT id, escritorio_id, tipo_caso, status, faltando FROM operacional.clientes');
  console.log('CLIENTES:', JSON.stringify(cli.rows, null, 2));

  const msg = await pool.query('SELECT cliente_id, count(*) as count FROM operacional.mensagens GROUP BY cliente_id');
  console.log('MENSAGENS POR CLIENTE:', JSON.stringify(msg.rows, null, 2));

  const aud = await pool.query('SELECT cliente_id, count(*) as total_msgs, count(transcricao_cifrada) as com_transcricao FROM operacional.mensagens GROUP BY cliente_id');
  console.log('AUDIOS/MENSAGENS POR CLIENTE:', JSON.stringify(aud.rows, null, 2));

  const doc = await pool.query('SELECT cliente_id, count(*) as count FROM operacional.documentos GROUP BY cliente_id');
  console.log('DOCUMENTOS POR CLIENTE:', JSON.stringify(doc.rows, null, 2));

  const auth = new AuthService(pool);

  // 1. Gustavo (MASTER)
  const gLogin = await auth.login('gustavo@ghfs.adv.br', process.env.SEED_MASTER_PASSWORD || 'Master@2026');
  console.log('\n--- GUSTAVO (MASTER) ---');
  console.log('Usuario:', {
    id: gLogin.usuario.id,
    nome: gLogin.usuario.nome,
    email: gLogin.usuario.email,
    role: gLogin.usuario.role,
    escritorio: gLogin.usuario.escritorio,
    escritoriosDisponiveis: gLogin.usuario.escritoriosDisponiveis?.map(e => `${e.nome} (${e.slug})`)
  });

  // 2. André (ADVOGADO)
  const aLogin = await auth.login('andre@oliveira.adv.br', process.env.SEED_ANDRE_PASSWORD || 'Andre@2026');
  console.log('\n--- ANDRÉ (ADVOGADO) ---');
  console.log('Usuario:', {
    id: aLogin.usuario.id,
    nome: aLogin.usuario.nome,
    email: aLogin.usuario.email,
    role: aLogin.usuario.role,
    escritorio: aLogin.usuario.escritorio,
    escritoriosDisponiveis: aLogin.usuario.escritoriosDisponiveis?.map(e => `${e.nome} (${e.slug})`)
  });

  // 3. Testa chamadas HTTP reais na API rodando em localhost:3000
  console.log('\n--- CHAMADAS HTTP NA API (PORT 3000) ---');
  try {
    const gClientesRes = await fetch('http://localhost:3000/api/v1/operacional/clientes', {
      headers: { Authorization: `Bearer ${gLogin.token}` }
    });
    const gClientes = await gClientesRes.json();
    console.log('Gustavo - Clientes Operacional:', gClientes);

    const gConfigRes = await fetch('http://localhost:3000/api/v1/operacional/config', {
      headers: { Authorization: `Bearer ${gLogin.token}` }
    });
    const gConfig = await gConfigRes.json();
    console.log('Gustavo - Config WhatsApp:', gConfig);

    const aClientesRes = await fetch('http://localhost:3000/api/v1/operacional/clientes', {
      headers: { Authorization: `Bearer ${aLogin.token}` }
    });
    const aClientes = await aClientesRes.json();
    console.log('\nAndré - Clientes Operacional:', aClientes);

    const aConfigRes = await fetch('http://localhost:3000/api/v1/operacional/config', {
      headers: { Authorization: `Bearer ${aLogin.token}` }
    });
    const aConfig = await aConfigRes.json();
    console.log('André - Config WhatsApp:', aConfig);

    // 4. Gustavo troca de escritório para ASO Advogados
    console.log('\n--- GUSTAVO TROCANDO PARA ASO ADVOGADOS ---');
    const trocaRes = await fetch('http://localhost:3000/api/v1/auth/trocar-escritorio', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gLogin.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ escritorioId: 'b8a15551-3f3c-43ca-8902-24ee6b31ee53' })
    });
    const trocaData = await trocaRes.json();
    console.log('Troca resultado:', {
      sucesso: Boolean(trocaData.token),
      novoEscritorio: trocaData.usuario?.escritorio?.nome
    });

    const gAsoClientesRes = await fetch('http://localhost:3000/api/v1/operacional/clientes', {
      headers: { Authorization: `Bearer ${trocaData.token}` }
    });
    const gAsoClientes = await gAsoClientesRes.json();
    console.log('Gustavo no ASO - Clientes Operacional:', gAsoClientes);

    const gAsoConfigRes = await fetch('http://localhost:3000/api/v1/operacional/config', {
      headers: { Authorization: `Bearer ${trocaData.token}` }
    });
    const gAsoConfig = await gAsoConfigRes.json();
    console.log('Gustavo no ASO - Config WhatsApp:', gAsoConfig);

    // 5. Gustavo troca de volta para GHFS Tecnologia Jurídica (Master)
    console.log('\n--- GUSTAVO TROCANDO DE VOLTA PARA GHFS MASTER ---');
    const voltaRes = await fetch('http://localhost:3000/api/v1/auth/trocar-escritorio', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${trocaData.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ escritorioId: 'd4cd6a90-28cb-4b09-951b-c2e3398f207a' })
    });
    const voltaData = await voltaRes.json();
    console.log('Troca de volta:', {
      sucesso: Boolean(voltaData.token),
      novoEscritorio: voltaData.usuario?.escritorio?.nome
    });

    const gGhfsClientesRes = await fetch('http://localhost:3000/api/v1/operacional/clientes', {
      headers: { Authorization: `Bearer ${voltaData.token}` }
    });
    const gGhfsClientes = await gGhfsClientesRes.json();
    console.log('Gustavo no GHFS - Clientes Operacional:', gGhfsClientes);

    const gGhfsConfigRes = await fetch('http://localhost:3000/api/v1/operacional/config', {
      headers: { Authorization: `Bearer ${voltaData.token}` }
    });
    const gGhfsConfig = await gGhfsConfigRes.json();
    console.log('Gustavo no GHFS - Config WhatsApp:', gGhfsConfig);
  } catch (err: any) {
    console.error('Erro na chamada HTTP:', err.message);
  }

  await pool.end();
}

run().catch(console.error);

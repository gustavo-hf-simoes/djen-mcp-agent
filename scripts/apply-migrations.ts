import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../src/database';

async function run() {
  const dir = join(__dirname, '..', 'database', 'migrations');
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  
  console.log(`Aplicando migrations em: ${dir}`);
  const client = await pool.connect();
  try {
    for (const file of files) {
      console.log(`-> Executando migration ${file}...`);
      const sql = readFileSync(join(dir, file), 'utf8');
      await client.query(sql);
      console.log(`   OK: ${file}`);
    }
    console.log('✅ Todas as migrations executadas com sucesso.');
  } catch (err: any) {
    console.error('❌ Erro ao aplicar migrations:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(0);
}

run();

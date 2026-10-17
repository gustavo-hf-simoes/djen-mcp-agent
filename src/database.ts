import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'djen_db',
});

// Testa a conexão com o banco ao iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados (PostgreSQL).:', err.message);
  } else {
    console.log('Conexão com o banco de dados (PostgreSQL) estabelecida com sucesso!');
    release();
  }
});
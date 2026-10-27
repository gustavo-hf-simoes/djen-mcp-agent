import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { createApp } from '../../app';
import { DjenController, type DjenServicePort } from '../djen/djen.controller';
import { AuthController } from './auth.controller';
import { hashPassword, signAuthToken, verifyAuthToken, verifyPassword, type UserRole } from './auth.crypto';
import { AuthUnauthorizedError, type AuthServicePort, type UsuarioPublicoDto } from './auth.service';

test('hashPassword e verifyPassword usam scrypt com salt único e comparação segura', () => {
  const h1 = hashPassword('Master@2026');
  const h2 = hashPassword('Master@2026');
  assert.notEqual(h1, h2);
  assert.equal(verifyPassword('Master@2026', h1), true);
  assert.equal(verifyPassword('SenhaErrada', h1), false);
});

test('signAuthToken e verifyAuthToken validam assinatura HMAC-SHA256 e expiração', () => {
  const token = signAuthToken(
    {
      sub: 'user-1',
      email: 'gustavo@ghfs.adv.br',
      nome: 'Gustavo Simões',
      role: 'MASTER',
      escritorioId: 'tenant-1',
      escritorioNome: 'André Oliveira Advocacia',
      numeroOab: '69161',
      ufOab: 'PR'
    },
    60,
    'segredo-teste'
  );
  const payload = verifyAuthToken(token, 'segredo-teste');
  assert.equal(payload?.email, 'gustavo@ghfs.adv.br');
  assert.equal(payload?.role, 'MASTER');
  assert.equal(verifyAuthToken(token, 'outro-segredo'), null);
});

test('rotas protegidas bloqueiam acesso sem token e impõem isolamento de OAB para ADVOGADO', async () => {
  let ultimaOabConsultada = '';
  const djenService: DjenServicePort = {
    async consultarDjen(filtros) {
      ultimaOabConsultada = `${filtros.get('numeroOab')}/${filtros.get('ufOab')}`;
      return { count: 0, items: [] };
    },
    async atualizarStatus() {
      return { success: true };
    }
  };

  const makeUser = (role: UserRole, email: string): UsuarioPublicoDto => ({
    id: `id-${role}`,
    nome: role,
    email,
    role,
    ativo: true,
    escritorio: { id: 'esc-1', nome: 'Escritório Piloto', slug: 'piloto', plano: 'PILOTO' },
    oab: { numero: '69161', uf: 'PR' },
    ultimoLoginEm: null
  });

  const authService: AuthServicePort = {
    async login(email, senha) {
      if (senha !== 'ok') throw new AuthUnauthorizedError('E-mail ou senha inválidos.');
      const role: UserRole = email.startsWith('gustavo') ? 'MASTER' : 'ADVOGADO';
      const usuario = makeUser(role, email);
      const token = signAuthToken({
        sub: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        role: usuario.role,
        escritorioId: usuario.escritorio.id,
        escritorioNome: usuario.escritorio.nome,
        numeroOab: usuario.oab.numero,
        ufOab: usuario.oab.uf
      });
      return { token, usuario };
    },
    async obterPerfil(id) {
      return makeUser(id.includes('MASTER') ? 'MASTER' : 'ADVOGADO', 'test@adv.br');
    },
    async listarUsuariosETenants() {
      return { usuarios: [makeUser('MASTER', 'gustavo@ghfs.adv.br')], escritorios: [] };
    },
    async garantirSeedInicial() {}
  };

  const app = createApp(
    new DjenController(djenService),
    undefined,
    undefined,
    new AuthController(authService)
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Sem token -> 401
    const unauthRes = await fetch(`${baseUrl}/api/v1/comunicacao`);
    assert.equal(unauthRes.status, 401);

    // 2. Login como ADVOGADO (André)
    const loginAdv = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'andre@oliveira.adv.br', senha: 'ok' })
    });
    assert.equal(loginAdv.status, 200);
    const { token: advToken } = (await loginAdv.json()) as { token: string };

    // Advogado tenta consultar outra OAB (99999/SP), mas middleware força 69161/PR
    const comRes = await fetch(`${baseUrl}/api/v1/comunicacao?numeroOab=99999&ufOab=SP`, {
      headers: { authorization: `Bearer ${advToken}` }
    });
    assert.equal(comRes.status, 200);
    assert.equal(ultimaOabConsultada, '69161/PR');

    // Advogado tenta acessar rota administrativa de usuários -> 403 Forbidden
    const forbiddenRes = await fetch(`${baseUrl}/api/v1/auth/usuarios`, {
      headers: { authorization: `Bearer ${advToken}` }
    });
    assert.equal(forbiddenRes.status, 403);

    // 3. Login como MASTER (Gustavo) -> 200 em /api/v1/auth/usuarios
    const loginMaster = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'gustavo@ghfs.adv.br', senha: 'ok' })
    });
    const { token: masterToken } = (await loginMaster.json()) as { token: string };

    const adminRes = await fetch(`${baseUrl}/api/v1/auth/usuarios`, {
      headers: { authorization: `Bearer ${masterToken}` }
    });
    assert.equal(adminRes.status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()));
    });
  }
});

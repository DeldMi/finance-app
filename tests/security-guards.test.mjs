import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginRedirectUrl, isDashboardPath } from '../src/lib/security-guards.mjs';

test('protege a rota raiz e as rotas internas do dashboard', () => {
  assert.equal(isDashboardPath('/dashboard'), true);
  assert.equal(isDashboardPath('/dashboard/'), true);
  assert.equal(isDashboardPath('/dashboard/reports'), true);
  assert.equal(isDashboardPath('/dashboardevil'), false);
  assert.equal(isDashboardPath('/login'), false);
});

test('redireciona para login usando a origem HTTPS pública configurada', () => {
  const url = createLoginRedirectUrl('/dashboard', 'https://pf.a3gs.com.br', 'http://172.31.255.2:30080/dashboard', 'production');
  assert.equal(url.origin, 'https://pf.a3gs.com.br');
  assert.equal(url.pathname, '/login');
  assert.equal(url.searchParams.get('callbackUrl'), '/dashboard');
});

test('não permite URL interna nem HTTP como origem em produção', () => {
  assert.throws(() => createLoginRedirectUrl('/dashboard', undefined, 'http://172.31.255.2:30080/dashboard', 'production'));
  assert.throws(() => createLoginRedirectUrl('/dashboard', 'http://172.31.255.2:30080', 'http://172.31.255.2:30080/dashboard', 'production'));
});

test('usa origem da requisição somente em desenvolvimento', () => {
  const url = createLoginRedirectUrl('/dashboard/reports', undefined, 'http://localhost:3000/dashboard/reports', 'development');
  assert.equal(url.origin, 'http://localhost:3000');
  assert.equal(url.searchParams.get('callbackUrl'), '/dashboard/reports');
});

test('não aceita callback externo', () => {
  const url = createLoginRedirectUrl('//evil.example/path', 'https://pf.a3gs.com.br', 'https://pf.a3gs.com.br/dashboard', 'production');
  assert.equal(url.searchParams.get('callbackUrl'), '/dashboard');
});

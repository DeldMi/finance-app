'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (isRegistering) {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const result: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            typeof result === 'object' && result !== null && 'error' in result
              ? String(result.error)
              : 'Não foi possível criar sua conta.',
          );
        }
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        throw new Error('E-mail ou senha incorretos.');
      }

      const callbackUrl = searchParams.get('callbackUrl');
      const destination =
        callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//')
          ? callbackUrl
          : '/dashboard';
      router.replace(destination);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Ocorreu um erro ao acessar sua conta.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-story" aria-label="Sobre o Meu Financeiro">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">◒</span>
          <div>
            <p className="eyebrow">Meu Financeiro</p>
            <strong>Finanças em equilíbrio</strong>
          </div>
        </div>
        <div>
          <h1 className="login-story-title">
            Decisões melhores começam com clareza.
          </h1>
          <p className="login-story-copy">
            Organize as contas da família e da empresa, acompanhe seu saldo e
            planeje compras sem perder o controle do orçamento.
          </p>
          <ul className="login-feature-list">
            <li>Entradas e despesas em um painel simples</li>
            <li>Perfis separados para pessoa física e jurídica</li>
            <li>Simulação de compras antes de fechar o carrinho</li>
          </ul>
        </div>
        <p className="login-story-footer">
          Seus registros financeiros são privados e vinculados à sua conta.
        </p>
      </section>

      <section className="login-form-side">
        <div className="login-card">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">◒</span>
            <div>
              <p className="eyebrow">Controle financeiro</p>
              <strong>Meu Financeiro</strong>
            </div>
          </div>
          <h2 className="login-heading">
            {isRegistering ? 'Crie sua conta' : 'Bem-vindo de volta'}
          </h2>
          <p className="login-copy">
            {isRegistering
              ? 'Comece a organizar suas finanças.'
              : 'Entre para acessar seu painel financeiro.'}
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            {isRegistering && (
              <label className="field">
                <span className="field-label">Nome</span>
                <input
                  className="input"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
            )}
            <label className="field">
              <span className="field-label">E-mail</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@exemplo.com"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Senha</span>
              <input
                className="input"
                type="password"
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                minLength={isRegistering ? 8 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isRegistering ? 'Mínimo de 8 caracteres' : 'Sua senha'}
                required
              />
            </label>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy
                ? 'Aguarde...'
                : isRegistering
                  ? 'Criar conta e entrar'
                  : 'Entrar no painel'}
            </button>
          </form>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="login-switch">
            {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
            <button
              className="link-button"
              type="button"
              onClick={() => {
                setIsRegistering((current) => !current);
                setError('');
              }}
            >
              {isRegistering ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="login-form-side">Carregando...</main>}>
      <LoginForm />
    </Suspense>
  );
}

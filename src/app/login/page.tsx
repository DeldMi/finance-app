'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

// import { Eye, EyeOff } from 'lucide-react';

import './module.css';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockLevel, setLockLevel] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = window.setTimeout(() => setSecondsRemaining((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsRemaining]);

  function formatWait(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes} min ${remainingSeconds.toString().padStart(2, '0')} s` : `${remainingSeconds} s`;
  }

  const [showPassword, setShowPassword] = useState(false);

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
        const nextAttempts = failedAttempts + 1;
        if (nextAttempts >= 5) {
          const waitSeconds = Math.min(60 * (2 ** lockLevel), 24 * 60 * 60);
          setFailedAttempts(0);
          setLockLevel((level) => Math.min(level + 1, 16));
          setSecondsRemaining(waitSeconds);
          setError(`Muitas tentativas incorretas. Aguarde ${formatWait(waitSeconds)} antes de tentar novamente.`);
        } else {
          setFailedAttempts(nextAttempts);
          setError(`E-mail ou senha incorretos. Tentativa ${nextAttempts} de 5.`);
        }
        return;
      }
      setFailedAttempts(0);
      setLockLevel(0);

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
                placeholder="voce@exemplo.com.br"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Senha</span>

              <div className="password-input-wrapper">
                <input
                  className="input password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    isRegistering ? 'new-password' : 'current-password'
                  }
                  minLength={isRegistering ? 8 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    isRegistering ? 'Mínimo de 8 caracteres' : 'Sua senha'
                  }
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 4.9c5 0 8.27 4.11 9.5 7.1a11.8 11.8 0 0 1-2.04 3.14" />
                      <path d="M6.61 6.61C4.62 7.83 3.25 9.65 2.5 12c.63 1.8 2.03 3.7 4.5 5.5a10.9 10.9 0 0 0 5 1.1c1.1 0 2.15-.2 3.12-.55" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>



            {!isRegistering && (
              <p className="login-switch" style={{ textAlign: 'right', marginTop: '-8px' }}>
                <a className="link-button" href="/forgot-password">Esqueci minha senha</a>
              </p>
            )}

            <button className="button button-primary" type="submit" disabled={busy || secondsRemaining > 0}>
              {secondsRemaining > 0
                ? `Tente novamente em ${formatWait(secondsRemaining)}`
                : busy
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

        
<footer className="login-footer">
  <p>
    &copy; {new Date().getFullYear()}{' '}
    <a
      href="https://www.a3gs.com.br"
      target="_blank"
      rel="noopener noreferrer"
    >
      A3GS Tec
    </a>
    {' '}- Minha Finança.
    <span> Todos os direitos reservados.</span>
  </p>
</footer>


      </section>
    </main >
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="login-form-side">Carregando...</main>}>
      <LoginForm />
    </Suspense>
  );
}

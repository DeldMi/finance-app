'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível redefinir a senha.');
      setSuccess(true);
      setMessage(result.message || 'Senha redefinida com sucesso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível redefinir a senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-form-side">
        <div className="login-card">
          <p className="eyebrow">Meu Financeiro</p>
          <h1 className="login-heading">Criar nova senha</h1>
          <p className="login-copy">O link é válido por 30 minutos e pode ser utilizado apenas uma vez.</p>
          {!token ? (
            <p className="form-error" role="alert">O link está incompleto. Solicite uma nova recuperação.</p>
          ) : success ? (
            <p className="form-error" role="status">{message}</p>
          ) : (
            <form className="login-form" onSubmit={submit}>
              <label className="field">
                <span className="field-label">Nova senha</span>
                <input className="input" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">Confirmar nova senha</span>
                <input className="input" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              </label>
              <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Salvando...' : 'Redefinir senha'}</button>
            </form>
          )}
          {message && !success && <p className="form-error" role="alert">{message}</p>}
          <p className="login-switch"><a className="link-button" href="/login">Voltar para entrar</a></p>
        </div>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="login-form-side">Carregando...</main>}><ResetPasswordForm /></Suspense>;
}

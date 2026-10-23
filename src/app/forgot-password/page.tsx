'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      setMessage(result.message || 'Se o e-mail estiver cadastrado, você receberá instruções para recuperar a senha.');
    } catch {
      setMessage('Não foi possível processar a solicitação agora. Tente novamente mais tarde.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-form-side">
        <div className="login-card">
          <p className="eyebrow">Meu Financeiro</p>
          <h1 className="login-heading">Recuperar senha</h1>
          <p className="login-copy">Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um link válido por 30 minutos.</p>
          <form className="login-form" onSubmit={submit}>
            <label className="field">
              <span className="field-label">E-mail</span>
              <input className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
            </label>
            <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Enviando...' : 'Enviar link de recuperação'}</button>
          </form>
          {message && <p className="form-error" role="status" aria-live="polite">{message}</p>}
          <p className="login-switch"><a className="link-button" href="/login">Voltar para entrar</a></p>
        </div>
      </section>
    </main>
  );
}

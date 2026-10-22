import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import LiveLogs from './viewer';

export const dynamic = 'force-dynamic';

export default async function ServerLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/dashboard');

  return (
    <main className="app-shell">
      <header className="page-header logs-page-header">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="page-title">Logs do servidor</h1>
          <p className="page-subtitle">Acompanhe em tempo real a inicialização e a execução do app.</p>
        </div>
        <Link className="button button-secondary" href="/dashboard">Voltar ao painel</Link>
      </header>
      <LiveLogs />
    </main>
  );
}

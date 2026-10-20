import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redireciona automaticamente para a rota do dashboard
  redirect('/dashboard');
}
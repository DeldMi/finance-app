'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_VISIBLE_CHARACTERS = 120_000;

export default function LiveLogs() {
  const [logs, setLogs] = useState('Conectando ao fluxo de logs...\n');
  const [connection, setConnection] = useState('Conectando');
  const [autoScroll, setAutoScroll] = useState(true);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const events = new EventSource('/api/admin/logs');
    events.onopen = () => setConnection('Ao vivo');
    events.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data) as { text?: string };
        if (update.text) setLogs((current) => `${current}${update.text}`.slice(-MAX_VISIBLE_CHARACTERS));
      } catch {
        setLogs((current) => `${current}${event.data}\n`.slice(-MAX_VISIBLE_CHARACTERS));
      }
    };
    events.onerror = () => setConnection('Reconectando...');
    return () => events.close();
  }, []);

  useEffect(() => {
    if (autoScroll && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [logs, autoScroll]);

  return (
    <section className="panel live-logs-panel">
      <div className="live-logs-toolbar">
        <p className="live-logs-state"><span className={connection === 'Ao vivo' ? 'live-logs-dot live' : 'live-logs-dot'} />{connection}</p>
        <label className="check-field"><input type="checkbox" checked={autoScroll} onChange={(event) => setAutoScroll(event.target.checked)} />Rolar automaticamente</label>
        <button className="button button-secondary button-compact" type="button" onClick={() => setLogs('')}>Limpar visualização</button>
      </div>
      <pre className="live-logs-output" ref={outputRef} aria-label="Saída de log em tempo real">{logs || 'Nenhuma linha nova.'}</pre>
      <p className="panel-description live-logs-caption">O arquivo é salvo junto aos dados persistentes do app em <code>/app/prisma/logs/application.log</code>.</p>
    </section>
  );
}

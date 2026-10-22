import { open, stat } from 'node:fs/promises';
import { requireAdmin } from '@/lib/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOG_FILE = '/app/prisma/logs/application.log';
const INITIAL_LOG_BYTES = 160 * 1024;
const MAX_CHUNK_BYTES = 48 * 1024;

export async function GET(request: Request) {
  const access = await requireAdmin();
  if ('response' in access) return access.response;

  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let offset = 0;
      let fileIdentity = '';
      let missingMessageSent = false;
      let readErrorSent = false;

      const close = () => {
        if (stopped) return;
        stopped = true;
        if (timer) clearTimeout(timer);
        request.signal.removeEventListener('abort', close);
        try { controller.close(); } catch { /* The client may already have disconnected. */ }
      };
      cleanup = close;
      request.signal.addEventListener('abort', close, { once: true });

      const send = (value: { text: string }) => {
        if (!stopped) controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
      };

      const follow = async () => {
        while (!stopped) {
          try {
            const details = await stat(LOG_FILE);
            const identity = `${details.dev}:${details.ino}`;
            if (identity !== fileIdentity || details.size < offset) {
              fileIdentity = identity;
              offset = Math.max(0, details.size - INITIAL_LOG_BYTES);
            }
            missingMessageSent = false;
            readErrorSent = false;

            if (details.size > offset) {
              const length = Math.min(details.size - offset, MAX_CHUNK_BYTES);
              const file = await open(LOG_FILE, 'r');
              try {
                const buffer = Buffer.alloc(length);
                const result = await file.read(buffer, 0, length, offset);
                offset += result.bytesRead;
                if (result.bytesRead) send({ text: buffer.subarray(0, result.bytesRead).toString('utf8') });
              } finally {
                await file.close();
              }
            }
          } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
              if (!missingMessageSent) {
                send({ text: '[Aguardando o arquivo de log /app/prisma/logs/application.log...]\n' });
                missingMessageSent = true;
              }
            } else if (!readErrorSent) {
              send({ text: '[Não foi possível ler o arquivo de log.]\n' });
              readErrorSent = true;
            }
          }

          if (!stopped) await new Promise<void>((resolve) => { timer = setTimeout(resolve, 1000); });
        }
      };

      void follow();
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

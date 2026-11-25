import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.VITE_EON_API_URL ||
  'https://solid-zebra-5vpqp6jgjw4pc7gwr-8000.app.github.dev'
)
  .trim()
  .replace(/\/+$/, '');

function isDisallowedPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === '169.254.169.254' || lower.endsWith('.internal')) return true;
  if (/^10\./.test(lower) || /^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  return false;
}

function resolveTargetBaseUrl(headerValue: string | string[] | undefined): string {
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!candidate || !candidate.trim()) {
    return DEFAULT_BACKEND_URL;
  }
  try {
    const parsed = new URL(candidate.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return DEFAULT_BACKEND_URL;
    }
    if (isDisallowedPrivateHost(parsed.hostname)) {
      return DEFAULT_BACKEND_URL;
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

function rewriteSetCookieHeader(cookie: string): string {
  return cookie
    .replace(/;\s*Domain=[^;]+/gi, '')
    .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
    .replace(/;\s*Partitioned/gi, '');
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  // Transparent reverse proxy to the existing EON FastAPI backend.
  // Solves browser CORS origin blocks when accessing Codespaces / private origins from Cloud Run.
  app.use(
    '/eon-proxy',
    express.raw({ type: '*/*', limit: '10mb' }),
    async (req: Request, res: Response) => {
      const targetBase = resolveTargetBaseUrl(req.headers['x-eon-target-url']);
      const upstreamPath = req.url || '/';
      const upstreamUrl = `${targetBase}${upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`}`;

      const headers = new Headers();
      const forwardList = [
        'accept',
        'accept-language',
        'authorization',
        'content-type',
        'cookie',
        'x-request-id',
      ];
      for (const key of forwardList) {
        const val = req.headers[key];
        if (typeof val === 'string' && val.length > 0) {
          headers.set(key, val);
        }
      }
      // Match allowed FastAPI local origin header so backend CORS middleware stays happy
      headers.set('origin', 'http://localhost:3000');

      const method = req.method.toUpperCase();
      const hasBody = method !== 'GET' && method !== 'HEAD';
      const rawBody =
        hasBody && Buffer.isBuffer(req.body) && req.body.length > 0
          ? new Uint8Array(req.body)
          : undefined;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 35000);

      try {
        const upstreamRes = await fetch(upstreamUrl, {
          method,
          headers,
          body: rawBody,
          redirect: 'manual',
          signal: controller.signal,
        });

        // Detect GitHub Codespaces private-port sign-in redirect
        const location = upstreamRes.headers.get('location') || '';
        if (
          upstreamRes.status >= 300 &&
          upstreamRes.status < 400 &&
          location.includes('github.dev/pf-signin')
        ) {
          res.status(502).json({
            error: 'tunnel_auth_required',
            message:
              'Backend port 8000 is private and redirected to GitHub authentication. Set port 8000 visibility to Public.',
          });
          return;
        }

        const contentType = upstreamRes.headers.get('content-type');
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }
        const cacheControl = upstreamRes.headers.get('cache-control');
        if (cacheControl) {
          res.setHeader('Cache-Control', cacheControl);
        }

        // Forward any auth cookies from FastAPI seamlessly to same-origin client
        const setCookies =
          typeof upstreamRes.headers.getSetCookie === 'function'
            ? upstreamRes.headers.getSetCookie()
            : [];
        if (setCookies.length > 0) {
          res.setHeader('Set-Cookie', setCookies.map(rewriteSetCookieHeader));
        }

        res.status(upstreamRes.status);

        if (upstreamRes.status === 204 || !upstreamRes.body) {
          res.end();
          return;
        }

        if (contentType?.includes('text/event-stream')) {
          const reader = upstreamRes.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
          return;
        }

        const buf = Buffer.from(await upstreamRes.arrayBuffer());
        res.send(buf);
      } catch (err) {
        const isTimeout = err instanceof DOMException && err.name === 'AbortError';
        res.status(isTimeout ? 504 : 502).json({
          error: isTimeout ? 'upstream_timeout' : 'upstream_unreachable',
          message:
            err instanceof Error
              ? err.message
              : 'Unable to reach EON backend server.',
        });
      } finally {
        clearTimeout(timer);
      }
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EON frontend server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();

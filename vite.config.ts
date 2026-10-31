import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'

function localVercelApiPlugin(): Plugin {
  return {
    name: 'obscura-local-vercel-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const routeName = req.url.split('?')[0].replace(/^\/api\//, '').replace(/\/+$/, '');
        const filePath = path.resolve(process.cwd(), 'api', `${routeName}.js`);
        if (!fs.existsSync(filePath)) return next();

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          let parsedBody: unknown = rawBody;
          if (rawBody && (req.headers['content-type'] || '').includes('application/json')) {
            try { parsedBody = JSON.parse(rawBody); } catch {}
          }

          const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const query = Object.fromEntries(urlObj.searchParams.entries());
          const wrappedReq = Object.assign(req, { body: parsedBody, query });

          let statusCode = 200;
          const wrappedRes = {
            setHeader: (k: string, v: string) => res.setHeader(k, v),
            status: (code: number) => { statusCode = code; return wrappedRes; },
            json: (data: unknown) => {
              res.statusCode = statusCode;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
            end: (data?: string) => {
              res.statusCode = statusCode;
              res.end(data);
            },
          };

          const mod = await import(`${filePath}?t=${Date.now()}`);
          await mod.default(wrappedReq, wrappedRes);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (!(k in process.env)) process.env[k] = v;
  }

  const plugins: Plugin[] = [react(), tailwindcss(), localVercelApiPlugin()];
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}

  const publicEnv = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(publicEnv)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
  };
})

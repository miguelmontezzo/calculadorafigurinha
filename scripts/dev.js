// Servidor local que imita a Vercel: arquivos estáticos + funções em /api.
// Uso: npm run dev   →  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { console.warn('⚠️  .env não encontrado — copie .env.example para .env'); }

const PORT = Number(process.env.PORT) || 3000;
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const rewrites = Object.fromEntries((vercel.rewrites || []).map(r => [r.source, r.destination]));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => {
      if (!data) return resolve(undefined);
      try { resolve(JSON.parse(data)); } catch { resolve(data); }
    });
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = rewrites[url.pathname] || url.pathname;

  if (pathname.startsWith('/api/')) {
    const file = path.join(ROOT, pathname.replace(/\/$/, '') + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('{"error":"not found"}'); }
    req.query = Object.fromEntries(url.searchParams);
    req.body = await readBody(req);
    const start = Date.now();
    res.on('finish', () => console.log(`${req.method} ${req.url} → ${res.statusCode} (${Date.now() - start}ms)`));
    return require(file)(req, res);
  }

  if (pathname === '/') pathname = '/index.html';
  const file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Calculadora 3D rodando em http://localhost:${PORT}`));

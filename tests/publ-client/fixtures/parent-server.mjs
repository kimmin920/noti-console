import http from 'node:http';

const args = new Map(
  process.argv.slice(2).map((entry) => {
    const [key, value] = entry.replace(/^--/, '').split('=');
    return [key, value];
  })
);

const appPort = Number(args.get('app-port') ?? 3410);
const approvedPort = Number(args.get('approved-port') ?? 3411);
const deniedPort = Number(args.get('denied-port') ?? 3412);

const servers = [
  createServer({ appPort, label: 'approved-parent', port: approvedPort }),
  createServer({ appPort, label: 'denied-parent', port: deniedPort }),
];

process.on('SIGTERM', closeServers);
process.on('SIGINT', closeServers);

function createServer({ appPort, label, port }) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);

    if (url.pathname === '/healthz') {
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('ok');
      return;
    }

    if (url.pathname === '/frame') {
      const targetPath = url.searchParams.get('path') || '/publ-client/message-send';
      const iframeSrc = `http://127.0.0.1:${appPort}${targetPath}`;
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>${label}</title></head>
  <body>
    <main>
      <h1>${label}</h1>
      <iframe data-testid="publ-frame" src="${escapeHtml(iframeSrc)}" style="width:100vw;height:100vh;border:0"></iframe>
    </main>
  </body>
</html>`);
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  });

  server.listen(port, '127.0.0.1');
  return server;
}

function closeServers() {
  for (const server of servers) {
    server.close();
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

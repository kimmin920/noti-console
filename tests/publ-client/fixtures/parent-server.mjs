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
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);

    if (url.pathname === '/healthz') {
      const ready = await isAppReady(appPort);
      response.writeHead(ready ? 200 : 503, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(ready ? 'ok' : 'app not ready');
      return;
    }

    if (url.pathname === '/frame') {
      const targetPath = url.searchParams.get('path') || '/publ-client/message-send';
      const iframeSrc = `http://127.0.0.1:${appPort}${targetPath}`;
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${label}</title>
    <style>
      html, body, main { width: 100%; height: 100%; margin: 0; }
      h1 { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      iframe { display: block; width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>${label}</h1>
      <iframe data-testid="publ-frame" src="${escapeHtml(iframeSrc)}"></iframe>
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

async function isAppReady(port) {
  const paths = [
    '/publ-client/message-send',
    '/publ-client/logs?channel=sms',
    '/publ-client/audience',
    '/publ-client/reservations',
    '/publ-client/templates',
    '/publ-client/automations',
  ];

  try {
    const responses = await Promise.all(paths.map((pathname) => (
      fetch(`http://127.0.0.1:${port}${pathname}`)
    )));
    return responses.every((appResponse) => appResponse.ok);
  } catch {
    return false;
  }
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

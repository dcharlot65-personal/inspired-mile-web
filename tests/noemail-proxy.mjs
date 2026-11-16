// A second origin for the end-to-end tests: the same pages as the dev server, but with
// /api going to the API that has email off (the state production launches in).
//
// Astro allows one dev server per project, and the page reaches the API on its own origin,
// so "same pages, other API" needs another origin in front of both. This is that origin:
// /api/* is passed to the email-off API, everything else (pages, modules, the HMR socket)
// to the dev server. Test tooling only; nothing here ships.
//
//   node tests/noemail-proxy.mjs <listen-port> <dev-server-port> <api-port>
import http from 'node:http';
import net from 'node:net';

const [listenPort, webPort, apiPort] = process.argv.slice(2).map(Number);
if (![listenPort, webPort, apiPort].every((p) => Number.isInteger(p) && p > 0)) {
  console.error('usage: node tests/noemail-proxy.mjs <listen-port> <dev-server-port> <api-port>');
  process.exit(2);
}

const server = http.createServer((req, res) => {
  const toApi = req.url.startsWith('/api/');
  const upstream = http.request(
    {
      host: toApi ? '127.0.0.1' : 'localhost',
      port: toApi ? apiPort : webPort,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on('error', (e) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`noemail-proxy: ${toApi ? 'API' : 'dev server'} unreachable: ${e.message}`);
  });
  req.pipe(upstream);
});

// The dev server's hot-reload socket, passed straight through.
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(webPort, 'localhost', () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(listenPort, 'localhost', () => {
  console.error(`[noemail-proxy] http://localhost:${listenPort} -> pages :${webPort}, /api :${apiPort}`);
});

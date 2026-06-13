import http from 'http';
import net from 'net';

const VITE_PORT = 20635;
const API_PORT = 8080;
const PROXY_PORT = 5000;

function proxyRequest(req, res, targetPort) {
  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${targetPort}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (e) => {
    if (!res.headersSent) {
      res.writeHead(502);
      res.end(`Upstream error: ${e.message}`);
    }
  });

  req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
  const isApi = req.url.startsWith('/api');
  proxyRequest(req, res, isApi ? API_PORT : VITE_PORT);
});

server.on('upgrade', (req, socket, head) => {
  const targetPort = req.url.startsWith('/api') ? API_PORT : VITE_PORT;
  const conn = net.createConnection({ host: '127.0.0.1', port: targetPort });

  conn.on('connect', () => {
    conn.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      req.rawHeaders.reduce((acc, v, i) => acc + (i % 2 === 0 ? v + ': ' : v + '\r\n'), '') +
      '\r\n'
    );
    if (head && head.length) conn.write(head);
    socket.pipe(conn);
    conn.pipe(socket);
  });

  conn.on('error', () => socket.destroy());
  socket.on('error', () => conn.destroy());
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`[PharmaPOS Dev Proxy] Listening on port ${PROXY_PORT}`);
  console.log(`  /api/* → localhost:${API_PORT} (Express)`);
  console.log(`  /*     → localhost:${VITE_PORT} (Vite)`);
});

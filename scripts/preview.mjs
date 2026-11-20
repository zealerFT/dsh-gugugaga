import http from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/preview.js', ['preview.js', 'text/javascript; charset=utf-8']],
  ['/character-preview.png', ['character-preview.png', 'image/png']],
]);
const server = http.createServer(async (request, response) => {
  const file = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!file || request.method !== 'GET') { response.writeHead(404); response.end(); return; }
  try {
    const data = await readFile(new URL(`../.preview/${file[0]}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' }); response.end(data);
  } catch { response.writeHead(503); response.end('Run npm run build first.'); }
});
server.listen(Number(process.env.GUGUGAGA_PREVIEW_PORT ?? 0), '127.0.0.1', () => {
  console.log(`Gugugaga preview: http://127.0.0.1:${server.address().port}`);
});
for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => server.close(() => process.exit(0)));

const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT = 'C:/Users/burji/Downloads/web/logo.png';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const b64 = body.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(OUT, Buffer.from(b64, 'base64'));
        const sz = fs.statSync(OUT).size;
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true, size:sz}));
        console.log('Saved logo.png, size:', sz);
        server.close();
      } catch(e) {
        res.writeHead(500);
        res.end(JSON.stringify({error:e.message}));
      }
    });
  } else {
    res.writeHead(404); res.end();
  }
});

server.listen(9191, () => console.log('Listening on 9191'));

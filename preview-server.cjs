const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    let url = req.url.split('?')[0];

    // Clean URL routing: /about/ -> /about/index.html
    if (url.endsWith('/')) url += 'index.html';
    if (!path.extname(url)) url += '/index.html';

    const filePath = path.join(ROOT, url);

    // Security: prevent directory traversal
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            // Try .html extension
            const htmlPath = filePath.replace(/\/index\.html$/, '.html');
            fs.readFile(htmlPath, (err2, data2) => {
                if (err2) {
                    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<h1>404 - Page Not Found</h1>');
                    return;
                }
                const ext = path.extname(htmlPath);
                res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
                res.end(data2);
            });
            return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n🚀 Wei Xing Machinery Website Preview`);
    console.log(`   Local:   http://localhost:${PORT}/`);
    console.log(`   Chinese: http://localhost:${PORT}/zh/`);
    console.log(`\n   Press Ctrl+C to stop\n`);
});

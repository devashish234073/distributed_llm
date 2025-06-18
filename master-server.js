const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');

// In-memory storage
const queryQueue = [];
const results = new Map();
const clients = new Map();
let transactionCounter = 1;

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    const path = parsedUrl.pathname;
    const query = querystring.parse(parsedUrl.query);

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`Incoming request from IP: ${ip} for path: ${path}`);

    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (path === '/query' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { query: userQuery } = JSON.parse(body);
                if (!userQuery) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Query is required' }));
                    return;
                }

                const transactionId = `txn_${transactionCounter++}`;
                queryQueue.push({ transactionId, query: userQuery });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ transactionId }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else if (path === '/give_me_query' && req.method === 'GET') {
        if (queryQueue.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No queries available' }));
        } else {
            const nextQuery = queryQueue.shift();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            console.log(`Giving query: ${nextQuery.query} with ID: ${nextQuery.transactionId}`);
            res.end(JSON.stringify(nextQuery));
        }
    } else if (path === '/take_the_response' && req.method === 'POST') {
        console.log('Received response from slave server');
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { transactionId, response } = JSON.parse(body);
                if (!transactionId || !response) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Transaction ID and response are required' }));
                    return;
                }

                results.set(transactionId, response);
                console.log(`Response for ${transactionId} received and stored.`);

                // Notify the WebSocket client
                const ws = clients.get(transactionId);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ transactionId, response }));
                    clients.delete(transactionId); // Optional: cleanup
                }
                res.writeHead(200);
                res.end(JSON.stringify({ success: true }));
            } catch {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else if (req.method === 'GET' && path === '/') {
        console.log('Serving consumer.html');
        fs.readFile('consumer.html', (err, data) => {
            if (err) {
                console.error('Error reading consumer.html:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

// Setup WebSocket server
const wss = new WebSocket.Server({ server });
wss.on('connection', ws => {
  ws.on('message', message => {
    const { transactionId } = JSON.parse(message);
    if (transactionId) {
      clients.set(transactionId, ws);
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Master server running on http://localhost:${PORT}`);
});
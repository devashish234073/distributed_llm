const http = require('http');
const url = require('url');
const querystring = require('querystring');

// In-memory storage
const queryQueue = [];
const results = new Map();
let transactionCounter = 1;

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    const path = parsedUrl.pathname;
    const query = querystring.parse(parsedUrl.query);

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
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error('Error parsing response:', e);
                console.error('Body received:', body);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else if (path === '/is_query_result_available' && req.method === 'GET') {
        const { transactionId } = query;
        if (!transactionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Transaction ID is required' }));
            return;
        }

        if (results.has(transactionId)) {
            const response = results.get(transactionId);
            results.delete(transactionId); // Remove after retrieval if you want one-time access
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ available: true, response }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ available: false }));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Master server running on port ${PORT}`);
});
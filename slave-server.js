const http = require('http');

class SlaveServer {
    constructor(masterUrl) {
        this.masterUrl = masterUrl;
        this.ollamaUrl = 'http://localhost:11434'; // Hardcoded Ollama URL
    }

    async fetchQuery() {
        return new Promise((resolve, reject) => {
            http.get(`${this.masterUrl}/give_me_query`, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (res.statusCode === 404) {
                            resolve(null); // No queries available
                        } else {
                            resolve(result);
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    async sendResponse(transactionId, response) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({ transactionId, response });

            const req = http.request(`${this.masterUrl}/take_the_response`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData, 'utf8')//postData.length
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
            console.log(`Sending response for transaction:`,postData);
            req.write(postData);
            req.end();
        });
    }

    async processWithOllama(query) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                model: 'qwen3:1.7b', // Default model - change as needed
                prompt: query,
                stream: false    // We want complete response at once
            });

            const req = http.request(`${this.ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.response) {
                            resolve(response.response);
                        } else {
                            reject(new Error('Invalid response from Ollama'));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);

            req.write(postData);
            req.end();
        });
    }

    async startPolling() {
        setInterval(async () => {
            try {
                const queryData = await this.fetchQuery();
                if (queryData) {
                    console.log(`Processing query: ${queryData.query}`);
                    const ollamaResponse = await this.processWithOllama(queryData.query);
                    await this.sendResponse(queryData.transactionId, ollamaResponse);
                    console.log(`Response sent for transaction: ${queryData.transactionId}`);
                }
            } catch (error) {
                console.error('Error in slave processing:', error);
            }
        }, 1000); // Poll every second
    }
}

// Get command line argument for master URL
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node slave.js <master-server-url>');
    console.error('Example: node slave.js http://localhost:3000');
    process.exit(1);
}

const masterUrl = args[0];
const slave = new SlaveServer(masterUrl);
slave.startPolling();
console.log(`Slave server started polling for queries from master at ${masterUrl}`);
console.log(`Using hardcoded Ollama URL: ${slave.ollamaUrl}`);
'use strict';

/**
 * CLI health check.
 * Fetches GET /api/v1/health from a running server.
 * Run: npm run health
 */

const http = require('http');

const host = process.env.HEALTH_HOST || 'localhost';
const port = process.env.HEALTH_PORT || process.env.PORT || 5000;
const path = '/api/v1/health';

const req = http.request({ host, port, path, method: 'GET', timeout: 5000 }, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    // eslint-disable-next-line no-console
    console.log(`HTTP ${res.statusCode}`);
    try {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(JSON.parse(body), null, 2));
    } catch {
      // eslint-disable-next-line no-console
      console.log(body);
    }
    process.exit(res.statusCode === 200 ? 0 : 1);
  });
});

req.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error(`Health check failed: ${err.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  // eslint-disable-next-line no-console
  console.error('Health check timed out.');
  process.exit(1);
});

req.end();

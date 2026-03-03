import crypto from 'crypto';

// Set env vars before any imports
process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.PORT = '3099';
process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
process.env.GITHUB_CLIENT_ID = 'test_client_id';
process.env.GITHUB_CLIENT_SECRET = 'test_client_secret';
process.env.GITHUB_CALLBACK_URL = 'http://localhost:3099/oauth/callback';

import express from 'express';
import cors from 'cors';

const { sseRouter } = await import('./src/routes/sse.js');
const { oauthRouter } = await import('./src/routes/oauth.js');
const { config } = await import('./src/config.js');

const app = express();
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(express.json());
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/sse', sseRouter);
app.use('/oauth', oauthRouter);

// Start server (skip DB init for testing)
const server = app.listen(3099, async () => {
  console.log('Test server running on port 3099\n');

  try {
    // Test 1: Health endpoint
    const health = await fetch('http://localhost:3099/health');
    const hdata = await health.json();
    console.log('Test 1 - Health endpoint:', hdata.status === 'ok' ? 'PASS' : 'FAIL');

    // Test 2: SSE without user_id returns 401
    const sse = await fetch('http://localhost:3099/sse');
    console.log('Test 2 - SSE no auth:', sse.status === 401 ? 'PASS' : 'FAIL');

    // Test 3: SSE with user_id but no DB returns 503
    const sse2 = await fetch('http://localhost:3099/sse?user_id=test');
    console.log('Test 3 - SSE no DB:', sse2.status === 503 ? 'PASS' : 'FAIL (' + sse2.status + ')');

    // Test 4: OAuth connect redirects to GitHub
    const oauth = await fetch('http://localhost:3099/oauth/connect?user_id=test', { redirect: 'manual' });
    console.log('Test 4 - OAuth redirect:', oauth.status === 302 ? 'PASS' : 'FAIL');
    const location = oauth.headers.get('location') || '';
    console.log('Test 5 - OAuth URL:', location.includes('github.com/login/oauth') ? 'PASS' : 'FAIL');

    // Test 6: OAuth connect without user_id returns 400
    const oauth2 = await fetch('http://localhost:3099/oauth/connect');
    console.log('Test 6 - OAuth no user_id:', oauth2.status === 400 ? 'PASS' : 'FAIL');

    // Test 7: Disconnect without userId returns 400
    const disc = await fetch('http://localhost:3099/oauth/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    console.log('Test 7 - Disconnect no userId:', disc.status === 400 ? 'PASS' : 'FAIL');

    // Test 8: SSE message without session returns 404
    const msg = await fetch('http://localhost:3099/sse/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': 'nonexistent' },
      body: JSON.stringify({ test: true })
    });
    console.log('Test 8 - Message no session:', msg.status === 404 ? 'PASS' : 'FAIL');

    console.log('\nAll server route tests complete.');
  } catch (e) {
    console.error('Test error:', e.message);
  } finally {
    server.close();
    process.exit(0);
  }
});

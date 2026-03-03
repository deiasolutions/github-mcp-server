import express from 'express';
import cors from 'cors';
import { sseRouter } from './routes/sse.js';
import { oauthRouter } from './routes/oauth.js';
import { config } from './config.js';
import { initDb } from './db/client.js';

const app = express();

app.use(cors({
  origin: config.allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MCP SSE endpoint
app.use('/sse', sseRouter);

// OAuth endpoints
app.use('/oauth', oauthRouter);

// Initialize database and start server
initDb().then(() => {
  app.listen(config.port, () => {
    console.log(`GitHub MCP Server running on port ${config.port}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

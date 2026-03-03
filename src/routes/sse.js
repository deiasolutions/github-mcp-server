import { Router } from 'express';
import { MCPBridge } from '../mcp/bridge.js';
import { getTokenByUserId } from '../db/tokens.js';
import { decryptToken } from '../auth/encryption.js';

export const sseRouter = Router();

// Track active bridges by session
const activeBridges = new Map();

sseRouter.get('/', async (req, res) => {
  // Extract user context from request
  const userId = req.headers['x-user-id'] || req.query.user_id;

  if (!userId) {
    return res.status(401).json({ error: 'User ID required' });
  }

  // Look up token
  let tokenRecord;
  try {
    tokenRecord = await getTokenByUserId(userId);
  } catch (err) {
    console.error('Database error looking up token:', err.message);
    return res.status(503).json({ error: 'Database unavailable' });
  }

  if (!tokenRecord) {
    return res.status(401).json({ error: 'GitHub not connected. Run /github connect' });
  }

  const githubToken = decryptToken(tokenRecord.encrypted_token, tokenRecord.token_iv);

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Create MCP bridge
  const bridge = new MCPBridge(githubToken);
  const sessionId = `${userId}-${Date.now()}`;
  activeBridges.set(sessionId, bridge);

  // Bridge MCP messages to SSE
  bridge.on('message', (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  bridge.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  });

  bridge.on('close', () => {
    activeBridges.delete(sessionId);
  });

  // Handle client disconnect
  req.on('close', () => {
    bridge.close();
    activeBridges.delete(sessionId);
  });

  // Start the MCP server subprocess
  await bridge.start();

  // Send session ID so client can send messages
  res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);
});

// POST endpoint for MCP messages from Anthropic
sseRouter.post('/message', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  const message = req.body;

  const bridge = activeBridges.get(sessionId);
  if (!bridge) {
    return res.status(404).json({ error: 'No active session' });
  }

  bridge.send(message);
  res.json({ status: 'received' });
});

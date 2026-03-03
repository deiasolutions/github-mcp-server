import { Router } from 'express';
import { config } from '../config.js';
import { saveToken, deleteToken } from '../db/tokens.js';
import { encryptToken } from '../auth/encryption.js';

export const oauthRouter = Router();

// Start OAuth flow
oauthRouter.get('/connect', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) {
    return res.status(400).json({ error: 'user_id query parameter required' });
  }

  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', config.github.clientId);
  authUrl.searchParams.set('redirect_uri', config.github.callbackUrl);
  authUrl.searchParams.set('scope', 'repo');
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

// OAuth callback
oauthRouter.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send('Authorization denied or failed');
  }

  try {
    // Decode state to get userId
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    // Encrypt and store token
    const { encrypted, iv } = encryptToken(tokenData.access_token);

    await saveToken({
      userId,
      encryptedToken: encrypted,
      tokenIv: iv,
      scopes: tokenData.scope?.split(',') || ['repo']
    });

    // Success page
    res.send(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: system-ui; padding: 2rem; text-align: center; background: #0d1117; color: #e6edf3;">
          <h1>GitHub Connected</h1>
          <p>You can close this window and return to Fr@nk.</p>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send(`Connection failed: ${error.message}`);
  }
});

// Disconnect (revoke token)
oauthRouter.post('/disconnect', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  try {
    await deleteToken(userId);
    res.json({ status: 'disconnected' });
  } catch (err) {
    console.error('Disconnect error:', err.message);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

import { pool } from './client.js';

export async function getTokenByUserId(userId) {
  const result = await pool.query(
    'SELECT * FROM github_tokens WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

export async function saveToken({ userId, encryptedToken, tokenIv, scopes }) {
  await pool.query(`
    INSERT INTO github_tokens (user_id, encrypted_token, token_iv, scopes, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      encrypted_token = $2,
      token_iv = $3,
      scopes = $4,
      updated_at = NOW()
  `, [userId, encryptedToken, tokenIv, scopes]);
}

export async function deleteToken(userId) {
  await pool.query('DELETE FROM github_tokens WHERE user_id = $1', [userId]);
}

import crypto from 'crypto';

// Set env vars BEFORE importing modules that read config
process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.PORT = '3099';
process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

const { encryptToken, decryptToken } = await import('./src/auth/encryption.js');
const { config } = await import('./src/config.js');

// Test 1: Encryption round-trip
const token = 'ghp_test1234567890abcdefGHIJKLMNOP';
const { encrypted, iv } = encryptToken(token);
const decrypted = decryptToken(encrypted, iv);
console.log('Test 1 - Encryption round-trip:', token === decrypted ? 'PASS' : 'FAIL');

// Test 2: Different tokens produce different ciphertexts
const token2 = 'ghp_anotherTokenHere9876543210';
const { encrypted: enc2 } = encryptToken(token2);
console.log('Test 2 - Unique ciphertexts:', encrypted !== enc2 ? 'PASS' : 'FAIL');

// Test 3: Same token produces different IVs (non-deterministic)
const { iv: iv2 } = encryptToken(token);
console.log('Test 3 - Random IVs:', iv !== iv2 ? 'PASS' : 'FAIL');

// Test 4: Config loads correctly
console.log('Test 4 - Config port:', config.port === '3099' ? 'PASS' : 'FAIL');
console.log('Test 5 - Config databaseUrl:', config.databaseUrl ? 'PASS' : 'FAIL');

// Test 6: Tampered ciphertext fails
try {
  decryptToken('deadbeef:deadbeef', iv);
  console.log('Test 6 - Tamper detection: FAIL (should have thrown)');
} catch (e) {
  console.log('Test 6 - Tamper detection: PASS');
}

console.log('\nAll encryption tests complete.');

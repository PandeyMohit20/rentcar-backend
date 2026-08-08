'use strict';

const jwt = require('jsonwebtoken');
const {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../src/utils/jwt');
const { hashPassword, comparePassword } = require('../src/utils/password');

describe('JWT utils', () => {
  const payload = { sub: 'user-123', email: 'user@example.com' };

  it('signs and verifies an access token', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-123');
    expect(decoded.email).toBe('user@example.com');
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.sub).toBe('user-123');
  });

  it('rejects an access token verified with the wrong secret', () => {
    const token = signAccessToken(payload);
    expect(() => jwt.verify(token, 'wrong_secret_value_12345')).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken(payload);
    const tampered = `${token.slice(0, -4)}abcd`;
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});

describe('Password utils', () => {
  const plaintext = 'SuperSecret123!';

  it('hashes a password (never returns plaintext)', async () => {
    const hash = await hashPassword(plaintext);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(plaintext);
  });

  it('compares a correct password', async () => {
    const hash = await hashPassword(plaintext);
    const match = await comparePassword(plaintext, hash);
    expect(match).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword(plaintext);
    const match = await comparePassword('WrongPassword', hash);
    expect(match).toBe(false);
  });
});

'use strict';

const { encryptPayoutDestination: encrypt, decryptPayoutDestination: decrypt,
  fingerprintPayoutDestination: fingerprint } = require('../src/utils/payoutDestinationCrypto');
const original = process.env.PAYOUT_DESTINATION_ENCRYPTION_KEY;
const destination = { accountNumber: 'TEST-ACCOUNT-123456789', ifscCode: 'TEST-ROUTING', holder: { name: 'Test only' } };
const testKey = Buffer.alloc(32, 7).toString('base64'); // Deterministic isolated TEST key only.
beforeEach(() => { process.env.PAYOUT_DESTINATION_ENCRYPTION_KEY = testKey; });
afterAll(() => {
  if (original === undefined) delete process.env.PAYOUT_DESTINATION_ENCRYPTION_KEY;
  else process.env.PAYOUT_DESTINATION_ENCRYPTION_KEY = original;
});

test('round trips through a JSON-safe versioned authenticated envelope without plaintext', () => {
  const envelope = encrypt(destination);
  expect(envelope).toMatchObject({ v: 1, alg: 'A256GCM' });
  expect(Buffer.from(envelope.iv, 'base64')).toHaveLength(12);
  expect(Buffer.from(envelope.tag, 'base64')).toHaveLength(16);
  expect(decrypt(JSON.parse(JSON.stringify(envelope)))).toEqual(destination);
  for (const value of [destination.accountNumber, destination.ifscCode, testKey]) expect(JSON.stringify(envelope)).not.toContain(value);
});
test('fresh IV changes ciphertext for the same destination', () => {
  const a = encrypt(destination), b = encrypt(destination);
  expect(a.iv).not.toBe(b.iv);
  expect(a.ciphertext).not.toBe(b.ciphertext);
});
test('canonical fingerprint is stable, key-independent and sensitive to destination changes', () => {
  const a = fingerprint(destination);
  delete process.env.PAYOUT_DESTINATION_ENCRYPTION_KEY;
  expect(a).toMatch(/^[a-f0-9]{64}$/);
  expect(fingerprint({ holder: { name: 'Test only' }, ifscCode: destination.ifscCode, accountNumber: destination.accountNumber })).toBe(a);
  expect(fingerprint({ ...destination, accountNumber: 'OTHER-TEST' })).not.toBe(a);
});
test.each(['ciphertext', 'tag', 'iv'])('rejects tampered %s without leaking data', (field) => {
  const envelope = encrypt(destination);
  const bytes = Buffer.from(envelope[field], 'base64'); bytes[0] ^= 1;
  envelope[field] = bytes.toString('base64');
  expect(() => decrypt(envelope)).toThrow('Invalid payout destination data.');
});
test.each([null, {}, { v: 2 }, { ...destination }, { v: 1, alg: 'A256GCM', iv: '!', ciphertext: '!', tag: '!' }])('rejects malformed envelope %#', (value) => {
  expect(() => decrypt(value)).toThrow('Invalid payout destination data.');
});
test.each([undefined, '', 'not-base64', Buffer.alloc(31).toString('base64'), Buffer.alloc(33).toString('base64'), testKey.slice(0, -1)])('key configuration fails closed %#', (key) => {
  if (key === undefined) delete process.env.PAYOUT_DESTINATION_ENCRYPTION_KEY;
  else process.env.PAYOUT_DESTINATION_ENCRYPTION_KEY = key;
  expect(() => encrypt(destination)).toThrow('Payout destination encryption is unavailable.');
  expect(() => decrypt({})).toThrow('Payout destination encryption is unavailable.');
});
test('wrong valid key rejects authentication', () => {
  const envelope = encrypt(destination);
  process.env.PAYOUT_DESTINATION_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64');
  expect(() => decrypt(envelope)).toThrow('Invalid payout destination data.');
});
test.each([{ x: undefined }, { x: NaN }, { x: BigInt(1) }, { x: new Date() }, { x: () => 'secret' }, { x: 'a'.repeat(17000) }])('rejects lossy or oversized destination %#', (value) => {
  expect(() => encrypt(value)).toThrow('Invalid payout destination data.');
  expect(() => fingerprint(value)).toThrow('Invalid payout destination data.');
});
test('rejects circular objects and custom accessors with sanitized errors', () => {
  const value = {}; value.self = value;
  expect(() => encrypt(value)).toThrow('Invalid payout destination data.');
  const getter = { get secret() { throw Error(destination.accountNumber); } };
  expect(() => encrypt(getter)).toThrow('Invalid payout destination data.');
});

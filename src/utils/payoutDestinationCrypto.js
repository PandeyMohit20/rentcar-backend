'use strict';

const crypto = require('crypto');
const AppError = require('../errors/AppError');
const { payoutEncryptionKey } = require('../config/payoutEncryption');
const MAX_BYTES = 16384;
const AAD = Buffer.from('rentcar:payout-destination:v1:A256GCM');
const invalid = () => new AppError('Invalid payout destination data.', 422, 'PAYOUT_DESTINATION_INVALID');

// Accept plain JSON objects only. Reject lossy conversions, custom toJSON,
// accessors, sparse arrays, cycles and excessive depth rather than discarding facts.
function canonical(value) {
  const seen = new Set();
  function encode(v, depth) {
    if (depth > 32) throw invalid();
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'number' && Number.isFinite(v)) return JSON.stringify(v);
    if (!v || typeof v !== 'object' || seen.has(v)) throw invalid();
    const array = Array.isArray(v);
    if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(v))) throw invalid();
    seen.add(v);
    const keys = Reflect.ownKeys(v).filter((k) => !(array && k === 'length'));
    if (keys.some((k) => typeof k !== 'string')) throw invalid();
    for (const k of keys) {
      const d = Object.getOwnPropertyDescriptor(v, k);
      if (!d.enumerable || !Object.prototype.hasOwnProperty.call(d, 'value')) throw invalid();
    }
    let text;
    if (array) {
      if (keys.length !== v.length || keys.some((k, i) => k !== String(i))) throw invalid();
      text = `[${keys.map((k) => encode(v[k], depth + 1)).join(',')}]`;
    } else text = `{${keys.sort().map((k) => `${JSON.stringify(k)}:${encode(v[k], depth + 1)}`).join(',')}}`;
    seen.delete(v);
    return text;
  }
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
    const text = encode(value, 0);
    if (Buffer.byteLength(text) > MAX_BYTES) throw invalid();
    return text;
  } catch (_) { throw invalid(); }
}

function decodeBase64(value, size) {
  if (typeof value !== 'string' || !value.length || value.length > 4 * Math.ceil(MAX_BYTES / 3) ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw invalid();
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value || (size && bytes.length !== size)) throw invalid();
  return bytes;
}

function encryptPayoutDestination(value) {
  const key = payoutEncryptionKey();
  let plaintext;
  try {
    plaintext = Buffer.from(canonical(value));
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    cipher.setAAD(AAD);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { v: 1, alg: 'A256GCM', iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
  } catch (_) { throw invalid(); }
  finally { key.fill(0); if (plaintext) plaintext.fill(0); }
}

function decryptPayoutDestination(envelope) {
  const key = payoutEncryptionKey();
  let plaintext;
  try {
    if (!envelope || Object.getPrototypeOf(envelope) !== Object.prototype ||
      Object.keys(envelope).sort().join(',') !== 'alg,ciphertext,iv,tag,v' || envelope.v !== 1 || envelope.alg !== 'A256GCM') throw invalid();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, decodeBase64(envelope.iv, 12), { authTagLength: 16 });
    decipher.setAAD(AAD);
    decipher.setAuthTag(decodeBase64(envelope.tag, 16));
    // Do not parse or return any bytes until GCM authentication succeeds.
    plaintext = Buffer.concat([decipher.update(decodeBase64(envelope.ciphertext)), decipher.final()]);
    const value = JSON.parse(plaintext.toString('utf8'));
    if (canonical(value) !== plaintext.toString('utf8')) throw invalid();
    return value;
  } catch (_) { throw invalid(); }
  finally { key.fill(0); if (plaintext) plaintext.fill(0); }
}

function fingerprintPayoutDestination(value) {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

module.exports = { encryptPayoutDestination, decryptPayoutDestination, fingerprintPayoutDestination };

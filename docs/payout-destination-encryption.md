# Payout destination encryption foundation

`src/utils/payoutDestinationCrypto.js` exposes encryptPayoutDestination,
decryptPayoutDestination and fingerprintPayoutDestination. No payout lifecycle or
database write is implemented here.

Supply PAYOUT_DESTINATION_ENCRYPTION_KEY through deployment secret management:
canonical padded base64 encoding of exactly 32 cryptographically random bytes.
Do not use a password, JWT/payment secret, test key or committed .env value.
The application bootstrap loads dotenv as usual. Validation occurs only when
encryption/decryption is requested; missing/malformed keys fail closed with
PAYOUT_ENCRYPTION_UNAVAILABLE and do not block unrelated startup. Never log keys.

Envelope: `{v:1, alg:"A256GCM", iv, ciphertext, tag}`; binary fields use canonical
base64. AES-256-GCM uses a fresh random 12-byte IV, a full 16-byte tag and fixed
domain/version AAD `rentcar:payout-destination:v1:A256GCM`. Authentication must
succeed before any decrypted data is returned. Errors contain no supplied data.

Input is a plain JSON destination object, at most 16 KiB and depth 32, without
custom serialization, accessors, cycles or lossy values. Keys are recursively
sorted; arrays preserve order. Fingerprint is lowercase SHA-256 of that canonical
UTF-8 plaintext, independent of the encryption key and IV. It is not confidential
storage and must not be exposed as a substitute for encryption.

Future M11 usage:
- destinationSnapshot contains ONLY the encrypted envelope.
- destinationFingerprint contains the canonical plaintext fingerprint.
- Never store plaintext beside the envelope or expose/log/audit either snapshot
  or sensitive destination fields. Minimize fields before calling the utility.
- Decrypt immediately before dispatch/reconciliation only when actually needed.
- Enforce snapshot immutability and authorize access in the future Phase D service.

Key custody, backups and rotation are operational responsibilities. V1 has one
configured key and no key ID/key ring: do not replace it while existing envelopes
depend on it without an explicitly designed rotation/re-encryption procedure.
Losing the key makes those envelopes unrecoverable. No rotation or encryption-at-rest
backfill occurs here. Temporary key/plaintext buffers are cleared where practical;
JavaScript strings/returned objects cannot guarantee memory zeroization.

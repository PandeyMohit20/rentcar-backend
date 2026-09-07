'use strict';

// Local recovery only. Run with the explicit account ID below as the sole argument.
// Credentials are encrypted with Windows DPAPI; no secrets are printed.
require('dotenv').config();
const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
const { hashPassword } = require('../src/utils/password');
const { validatePassword } = require('../src/modules/auth/password.policy');

const accountId = 'a1fd6d08-e634-401d-a409-0af3af15fb8e';
const email = 'admin@rentcar.local';

async function main() {
  if (process.env.NODE_ENV !== 'development' || process.platform !== 'win32') {
    throw new Error('Requires Windows and explicit NODE_ENV=development.');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname)) {
    throw new Error('Refusing a non-loopback database.');
  }
  if (process.argv.length !== 3 || process.argv[2] !== accountId) {
    throw new Error('Pass the explicitly selected local UAT account ID.');
  }
  const { prisma } = require('../src/config/database');
  try {
    const user = await prisma.user.findUnique({ where: { id: accountId },
      select: { id: true, email: true, status: true, isDeleted: true,
        roles: { select: { role: { select: { name: true } } } } } });
    if (!user || user.email !== email || user.status !== 'active' || user.isDeleted ||
        !user.roles.some(({ role }) => role.name === 'SUPER_ADMIN')) {
      throw new Error('Selected account no longer matches the active local UAT admin.');
    }
    const password = `Uat!9aA${crypto.randomBytes(24).toString('base64url')}`;
    if (!validatePassword(password).valid) throw new Error('Password policy validation failed.');
    const credentialPath = path.join(process.env.LOCALAPPDATA, 'RentCarUAT', 'admin-credential.xml');
    const saved = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference='Stop'; $entry=[Console]::ReadLine() | ConvertFrom-Json; " +
      "if (Test-Path -LiteralPath $entry.path) { throw 'Credential file already exists; refusing overwrite.' }; " +
      "New-Item -ItemType Directory -Force -Path (Split-Path -Parent $entry.path) | Out-Null; " +
      "$secure=ConvertTo-SecureString $entry.password -AsPlainText -Force; " +
      "$credential=New-Object System.Management.Automation.PSCredential($entry.email,$secure); " +
      "$credential | Export-Clixml -LiteralPath $entry.path"],
    { input: JSON.stringify({ email, password, path: credentialPath }) + '\n', encoding: 'utf8', windowsHide: true });
    if (saved.status !== 0) throw new Error('Unable to save protected credentials; password was not changed.');
    await prisma.user.update({ where: { id: accountId }, data: { passwordHash: await hashPassword(password) }, select: { id: true } });
    console.log('Local UAT password reset. Protected credential file: ' + credentialPath);
    console.log('Temporary password: change immediately after login.');
    const root = 'http://localhost:5000/api/v1/auth';
    const login = await fetch(root + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }), redirect: 'error' });
    const result = await login.json();
    if (!login.ok || !result.data?.accessToken) throw new Error(`Backend login failed (HTTP ${login.status}).`);
    const token = result.data.accessToken;
    try {
      const me = await fetch(root + '/me', { headers: { Authorization: `Bearer ${token}` }, redirect: 'error' });
      const identity = (await me.json()).data;
      const actual = identity?.user || identity;
      if (!me.ok || actual?.id !== accountId || !actual.roles?.includes('SUPER_ADMIN')) {
        throw new Error(`Identity verification failed (HTTP ${me.status}).`);
      }
      console.log(JSON.stringify({ login: 'PASS', authMe: 'PASS', userId: actual.id, email: actual.email,
        roles: actual.roles, status: actual.status }));
    } finally {
      const logout = await fetch(root + '/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, redirect: 'error' });
      console.log('Verification session logout HTTP ' + logout.status);
    }
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => {
  // Do not print database errors, request objects, tokens, or hashes.
  console.error(error.message.startsWith('Invalid `') ? 'Recovery failed; inspect local configuration.' : error.message.replace(/mysql:\/\/\S+/g, '[redacted]'));
  process.exitCode = 1;
});

# WALLET PHASE 2A - INTERNAL MONEY ENGINE
# Internal-only. No public POST routes are added.
# No Razorpay, booking-payment, refund-to-wallet, admin balance mutation,
# vendor settlement, schema, or migration changes.

$ErrorActionPreference = "Stop"
$repo = "C:\Users\Asus\OneDrive\Documents\GitHub\rentcar-backend"
Set-Location $repo

Write-Host "`n===== WALLET PHASE 2A - INTERNAL MONEY ENGINE =====" -ForegroundColor Cyan

# -------------------------------------------------------------------
# 0. BACKUP ONLY FILES THIS PATCH CHANGES
# -------------------------------------------------------------------
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = ".\wallet-mutation-backup-$stamp"
New-Item -ItemType Directory -Force $backup | Out-Null

$targets = @(
    ".\src\modules\wallet\service.js",
    ".\src\config\database.mock.js",
    ".\tests\wallet-mutation.test.js"
)

foreach ($file in $targets) {
    if (Test-Path $file) {
        $safe = ($file -replace '^[.\\]+','') -replace '[\\/:*?"<>|]','__'
        Copy-Item $file (Join-Path $backup $safe) -Force
    }
}

Write-Host "Backup: $backup" -ForegroundColor DarkGray

# -------------------------------------------------------------------
# 1. REPLACE WALLET SERVICE
# Keeps Phase 1B read APIs and adds INTERNAL mutation seams only.
# -------------------------------------------------------------------
@'
'use strict';

const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../../config/database');
const AppError = require('../../errors/AppError');
const { parsePagination, buildMeta, computeTotalPages } = require('../../utils/pagination');
const repository = require('./repository');
const { DEFAULT_CURRENCY, DEFAULT_STATUS } = require('./constants');

const IDEMPOTENCY_KEY_MIN = 8;
const IDEMPOTENCY_KEY_MAX = 255;
const REFERENCE_TYPES = new Set([
  'booking',
  'refund',
  'topup',
  'payout',
  'adjustment',
  'commission',
  'cancellation',
]);

function digest(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function conflict(message, code = 'CONFLICT') {
  return new AppError(message, 409, code);
}

function badRequest(message, code = 'BAD_REQUEST') {
  return new AppError(message, 400, code);
}

function money(value) {
  if (value === null || value === undefined) return '0.00';

  if (typeof value === 'object' && typeof value.toFixed === 'function') {
    return value.toFixed(2);
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return '0.00';
  return number.toFixed(2);
}

/**
 * Financial mutation parsing intentionally does NOT use floating point maths.
 * Accepted canonical inputs:
 *   "10", "10.5", "10.50"
 * Numeric input is accepted only when finite, positive and has <= 2 decimals.
 * Internally all arithmetic is integer paise (BigInt).
 */
function amountToPaise(value) {
  let raw;

  if (typeof value === 'string') {
    raw = value.trim();
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    raw = String(value);
  } else {
    throw badRequest('Wallet amount must be a valid positive amount.', 'WALLET_AMOUNT_INVALID');
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw badRequest(
      'Wallet amount must be positive and have at most 2 decimal places.',
      'WALLET_AMOUNT_INVALID',
    );
  }

  const [major, fraction = ''] = raw.split('.');
  const paise = (BigInt(major) * 100n) + BigInt((fraction + '00').slice(0, 2));

  if (paise <= 0n) {
    throw badRequest('Wallet amount must be greater than zero.', 'WALLET_AMOUNT_INVALID');
  }

  // Decimal(14,2) maximum is 999999999999.99.
  if (paise > 99999999999999n) {
    throw badRequest('Wallet amount exceeds the supported limit.', 'WALLET_AMOUNT_INVALID');
  }

  return paise;
}

function decimalToPaise(value) {
  const raw = value && typeof value.toFixed === 'function'
    ? value.toFixed(2)
    : String(value ?? '0');

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new AppError('Stored wallet balance is invalid.', 500, 'WALLET_BALANCE_INVALID');
  }

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [major, fraction = ''] = unsigned.split('.');
  const paise = (BigInt(major) * 100n) + BigInt((fraction + '00').slice(0, 2));
  return negative ? -paise : paise;
}

function paiseToMoney(paise) {
  const negative = paise < 0n;
  const absolute = negative ? -paise : paise;
  const major = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, '0');
  return `${negative ? '-' : ''}${major}.${fraction}`;
}

function walletDto(wallet) {
  if (!wallet) {
    return {
      id: null,
      balance: '0.00',
      currencyCode: DEFAULT_CURRENCY,
      status: DEFAULT_STATUS,
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    id: wallet.id,
    balance: money(wallet.balance),
    currencyCode: wallet.currencyCode,
    status: wallet.status,
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt,
  };
}

function transactionDto(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: money(transaction.amount),
    balanceBefore: money(transaction.balanceBefore),
    balanceAfter: money(transaction.balanceAfter),
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId || null,
    description: transaction.description || null,
    createdAt: transaction.createdAt,
  };
}

async function getWallet(userId) {
  const wallet = await repository.findByUserId(userId);
  return walletDto(wallet);
}

async function listTransactions(userId, query = {}) {
  const { page, limit, offset } = parsePagination(query);
  const wallet = await repository.findByUserId(userId);

  if (!wallet) {
    return {
      items: [],
      meta: buildMeta({
        page,
        limit,
        total: 0,
        totalPages: 0,
      }),
    };
  }

  const result = await repository.listTransactions(wallet.id, {
    skip: offset,
    take: limit,
  });

  return {
    items: result.transactions.map(transactionDto),
    meta: buildMeta({
      page,
      limit,
      total: result.total,
      totalPages: computeTotalPages(result.total, limit),
    }),
  };
}

function validateMutationInput(input, type) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Wallet mutation input is required.', 'WALLET_MUTATION_INVALID');
  }

  const userId = typeof input.userId === 'string' ? input.userId.trim() : '';
  if (!userId) {
    throw badRequest('Wallet user is required.', 'WALLET_USER_REQUIRED');
  }

  const rawKey = typeof input.idempotencyKey === 'string'
    ? input.idempotencyKey.trim()
    : '';

  if (
    rawKey.length < IDEMPOTENCY_KEY_MIN ||
    rawKey.length > IDEMPOTENCY_KEY_MAX
  ) {
    throw badRequest(
      `Idempotency key must be ${IDEMPOTENCY_KEY_MIN}-${IDEMPOTENCY_KEY_MAX} characters.`,
      'WALLET_IDEMPOTENCY_KEY_INVALID',
    );
  }

  if (!REFERENCE_TYPES.has(input.referenceType)) {
    throw badRequest('Wallet reference type is invalid.', 'WALLET_REFERENCE_TYPE_INVALID');
  }

  const amountPaise = amountToPaise(input.amount);
  const amount = paiseToMoney(amountPaise);
  const referenceId = input.referenceId == null ? null : String(input.referenceId).trim();
  const description = input.description == null ? null : String(input.description).trim();

  if (referenceId && referenceId.length > 36) {
    throw badRequest('Wallet reference id is too long.', 'WALLET_REFERENCE_ID_INVALID');
  }

  if (description && description.length > 500) {
    throw badRequest('Wallet description is too long.', 'WALLET_DESCRIPTION_INVALID');
  }

  const idempotencyKeyHash = digest(rawKey);

  // Versioned tuple makes replay semantics explicit and stable.
  const requestHash = digest(JSON.stringify([
    'wallet-mutation-v1',
    userId,
    type,
    amount,
    DEFAULT_CURRENCY,
    input.referenceType,
    referenceId,
    description,
  ]));

  return {
    userId,
    type,
    amount,
    amountPaise,
    referenceType: input.referenceType,
    referenceId,
    description,
    idempotencyKeyHash,
    requestHash,
  };
}

async function findReplay(db, walletId, idempotencyKeyHash) {
  return db.walletTransaction.findFirst({
    where: {
      walletId,
      idempotencyKeyHash,
    },
  });
}

function replayResult(existing, requestHash) {
  if (existing.requestHash !== requestHash) {
    throw conflict(
      'Idempotency key was already used for a different wallet request.',
      'WALLET_IDEMPOTENCY_CONFLICT',
    );
  }

  return {
    transaction: transactionDto(existing),
    wallet: {
      id: existing.walletId,
      balance: money(existing.balanceAfter),
      currencyCode: DEFAULT_CURRENCY,
    },
    replayed: true,
  };
}

async function ensureWallet(userId) {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;

  try {
    return await prisma.wallet.create({
      data: {
        userId,
        balance: '0.00',
        currencyCode: DEFAULT_CURRENCY,
        status: DEFAULT_STATUS,
      },
    });
  } catch (error) {
    // Concurrent first-credit may race on Wallet.userId UNIQUE.
    if (error?.code === 'P2002') {
      const raced = await prisma.wallet.findUnique({ where: { userId } });
      if (raced) return raced;
    }
    throw error;
  }
}

async function lockWallet(tx, walletId) {
  if (typeof tx.$queryRaw === 'function') {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM wallets WHERE id = ${walletId} FOR UPDATE`,
    );
  }
}

function assertMutable(wallet) {
  if (!wallet) {
    throw conflict('Wallet no longer exists.', 'WALLET_NOT_FOUND');
  }

  if (wallet.status !== 'active') {
    throw conflict(
      `Wallet is ${wallet.status} and cannot be changed.`,
      'WALLET_NOT_ACTIVE',
    );
  }

  if (wallet.currencyCode !== DEFAULT_CURRENCY) {
    throw conflict('Wallet currency is not supported.', 'WALLET_CURRENCY_MISMATCH');
  }
}

async function mutateWallet(type, input) {
  const request = validateMutationInput(input, type);

  // Creation is deliberately outside the balance-changing transaction.
  // It creates only an empty ₹0 wallet and handles the userId unique race.
  // All money movement remains inside the locked transaction below.
  const candidate = await ensureWallet(request.userId);

  const preExisting = await findReplay(
    prisma,
    candidate.id,
    request.idempotencyKeyHash,
  );
  if (preExisting) return replayResult(preExisting, request.requestHash);

  try {
    return await prisma.$transaction(async (tx) => {
      await lockWallet(tx, candidate.id);

      const wallet = await tx.wallet.findUnique({
        where: { id: candidate.id },
      });
      assertMutable(wallet);

      // Re-check after acquiring the wallet row lock.
      const raced = await findReplay(
        tx,
        wallet.id,
        request.idempotencyKeyHash,
      );
      if (raced) return replayResult(raced, request.requestHash);

      const beforePaise = decimalToPaise(wallet.balance);
      const afterPaise = type === 'credit'
        ? beforePaise + request.amountPaise
        : beforePaise - request.amountPaise;

      if (afterPaise < 0n) {
        throw conflict(
          'Insufficient wallet balance.',
          'WALLET_INSUFFICIENT_BALANCE',
        );
      }

      if (afterPaise > 99999999999999n) {
        throw conflict(
          'Wallet balance exceeds the supported limit.',
          'WALLET_BALANCE_LIMIT_EXCEEDED',
        );
      }

      const balanceBefore = paiseToMoney(beforePaise);
      const balanceAfter = paiseToMoney(afterPaise);

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount: request.amount,
          balanceBefore,
          balanceAfter,
          referenceType: request.referenceType,
          referenceId: request.referenceId,
          description: request.description,
          idempotencyKeyHash: request.idempotencyKeyHash,
          requestHash: request.requestHash,
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      if (input.testHooks?.afterLedger) {
        await input.testHooks.afterLedger({
          tx,
          wallet: updatedWallet,
          transaction,
        });
      }

      return {
        transaction: transactionDto(transaction),
        wallet: walletDto(updatedWallet),
        replayed: false,
      };
    });
  } catch (error) {
    // Unique index is the final race guard. If another request won,
    // read the winner and apply normal replay/conflict semantics.
    if (error?.code === 'P2002') {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: request.userId },
      });

      if (wallet) {
        const winner = await findReplay(
          prisma,
          wallet.id,
          request.idempotencyKeyHash,
        );
        if (winner) return replayResult(winner, request.requestHash);
      }
    }

    throw error;
  }
}

async function creditWallet(input) {
  return mutateWallet('credit', input);
}

async function debitWallet(input) {
  return mutateWallet('debit', input);
}

const WalletService = {
  getWallet,
  listTransactions,

  // INTERNAL ONLY.
  // Deliberately not exposed by wallet/routes.js or wallet/controller.js.
  creditWallet,
  debitWallet,
};

module.exports = {
  WalletService,
  money,
  walletDto,
  transactionDto,
  amountToPaise,
  decimalToPaise,
  paiseToMoney,
};
'@ | Set-Content ".\src\modules\wallet\service.js" -Encoding UTF8

# -------------------------------------------------------------------
# 2. PATCH MOCK DB UNIQUE CONSTRAINTS
# Do not overwrite existing coupon/settlement mock behaviour.
# -------------------------------------------------------------------
$mockPath = ".\src\config\database.mock.js"
$mock = Get-Content $mockPath -Raw

$anchor = "  for (const model of ['vendorSettlement', 'vendorSettlementItem']) {"

if (!$mock.Contains($anchor)) {
    throw "Expected settlement mock anchor not found. No further changes made."
}

if ($mock -notmatch "WALLET PHASE 2A UNIQUE CONSTRAINT MOCK") {
$walletMock = @'
  // WALLET PHASE 2A UNIQUE CONSTRAINT MOCK
  // Mirrors production UNIQUE(wallet.user_id) and
  // UNIQUE(wallet_transactions.wallet_id, idempotency_key_hash).
  {
    const walletCreate = prisma.wallet.create;
    prisma.wallet.create = async ({ data }) => {
      if (
        data.userId !== null &&
        data.userId !== undefined &&
        store.wallet.some((row) => row.userId === data.userId)
      ) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        err.meta = { target: ['userId'] };
        throw err;
      }
      return walletCreate({ data });
    };

    const transactionCreate = prisma.walletTransaction.create;
    prisma.walletTransaction.create = async ({ data }) => {
      if (
        data.idempotencyKeyHash !== null &&
        data.idempotencyKeyHash !== undefined &&
        store.walletTransaction.some(
          (row) =>
            row.walletId === data.walletId &&
            row.idempotencyKeyHash === data.idempotencyKeyHash,
        )
      ) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        err.meta = { target: ['walletId', 'idempotencyKeyHash'] };
        throw err;
      }
      return transactionCreate({ data });
    };
  }

'@

    $mock = $mock.Replace($anchor, $walletMock + $anchor)
}

# Normalize EOF and write UTF-8 without BOM.
$mock = $mock.TrimEnd() + "`n"
[System.IO.File]::WriteAllText(
    (Resolve-Path $mockPath),
    $mock,
    [System.Text.UTF8Encoding]::new($false)
)

# -------------------------------------------------------------------
# 3. MUTATION TESTS
# Internal service tests only. No public mutation endpoint is created.
# -------------------------------------------------------------------
@'
'use strict';

const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { WalletService } = require('../src/modules/wallet/service');

describe('Wallet internal mutation engine', () => {
  let user;

  beforeEach(async () => {
    resetStore();
    user = await seedUser({
      email: `wallet-mutation-${Math.random()}@test`,
    });
  });

  const base = (overrides = {}) => ({
    userId: user.id,
    amount: '100.00',
    referenceType: 'adjustment',
    referenceId: 'test-reference',
    description: 'Internal wallet engine test',
    idempotencyKey: 'wallet-test-key-0001',
    ...overrides,
  });

  it('credits atomically and creates exactly one ledger row', async () => {
    const result = await WalletService.creditWallet(base());

    expect(result.replayed).toBe(false);
    expect(result.wallet.balance).toBe('100.00');
    expect(result.transaction).toMatchObject({
      type: 'credit',
      amount: '100.00',
      balanceBefore: '0.00',
      balanceAfter: '100.00',
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    expect(Number(wallet.balance).toFixed(2)).toBe('100.00');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(1);
  });

  it('debits an existing wallet without floating point drift', async () => {
    await WalletService.creditWallet(base({
      amount: '0.30',
      idempotencyKey: 'wallet-credit-precision',
    }));

    const result = await WalletService.debitWallet(base({
      amount: '0.10',
      idempotencyKey: 'wallet-debit-precision',
    }));

    expect(result.wallet.balance).toBe('0.20');
    expect(result.transaction.balanceBefore).toBe('0.30');
    expect(result.transaction.balanceAfter).toBe('0.20');
  });

  it('rejects insufficient balance and does not append a debit ledger row', async () => {
    await WalletService.creditWallet(base({
      amount: '50.00',
      idempotencyKey: 'wallet-seed-balance',
    }));

    await expect(
      WalletService.debitWallet(base({
        amount: '50.01',
        idempotencyKey: 'wallet-insufficient',
      })),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'WALLET_INSUFFICIENT_BALANCE',
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    expect(Number(wallet.balance).toFixed(2)).toBe('50.00');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(1);
  });

  it('replays same idempotency key with same request without double credit', async () => {
    const request = base({
      amount: '25.50',
      idempotencyKey: 'wallet-replay-key',
    });

    const first = await WalletService.creditWallet(request);
    const second = await WalletService.creditWallet(request);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.transaction.id).toBe(first.transaction.id);

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    expect(Number(wallet.balance).toFixed(2)).toBe('25.50');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(1);
  });

  it('rejects same idempotency key with a different request', async () => {
    await WalletService.creditWallet(base({
      amount: '10.00',
      idempotencyKey: 'wallet-conflict-key',
    }));

    await expect(
      WalletService.creditWallet(base({
        amount: '11.00',
        idempotencyKey: 'wallet-conflict-key',
      })),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'WALLET_IDEMPOTENCY_CONFLICT',
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    expect(Number(wallet.balance).toFixed(2)).toBe('10.00');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(1);
  });

  it.each(['frozen', 'closed'])('blocks mutations when wallet is %s', async (status) => {
    await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: '20.00',
        currencyCode: 'INR',
        status,
      },
    });

    await expect(
      WalletService.creditWallet(base({
        idempotencyKey: `wallet-${status}-key`,
      })),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'WALLET_NOT_ACTIVE',
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    expect(Number(wallet.balance).toFixed(2)).toBe('20.00');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(0);
  });

  it('rolls back ledger and balance together when the transaction fails', async () => {
    await expect(
      WalletService.creditWallet(base({
        amount: '75.00',
        idempotencyKey: 'wallet-rollback-key',
        testHooks: {
          afterLedger: async () => {
            throw new Error('forced-wallet-rollback');
          },
        },
      })),
    ).rejects.toThrow('forced-wallet-rollback');

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });

    // Empty wallet creation may remain; money movement must not.
    expect(Number(wallet.balance).toFixed(2)).toBe('0.00');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(0);
  });

  it('stores only hashes, never the raw idempotency key', async () => {
    const rawKey = 'super-secret-wallet-idempotency-key';
    const result = await WalletService.creditWallet(base({
      idempotencyKey: rawKey,
    }));

    const stored = await prisma.walletTransaction.findUnique({
      where: { id: result.transaction.id },
    });

    expect(stored.idempotencyKeyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.requestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.idempotencyKeyHash).not.toBe(rawKey);
    expect(JSON.stringify(stored)).not.toContain(rawKey);
  });

  it('rejects invalid precision and zero amounts before money movement', async () => {
    for (const amount of ['0', '0.00', '-1.00', '1.001', 'abc']) {
      await expect(
        WalletService.creditWallet(base({
          amount,
          idempotencyKey: `invalid-${String(amount).replace(/\W/g, '')}-key`,
        })),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'WALLET_AMOUNT_INVALID',
      });
    }

    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
  });

  it('keeps customer wallet read DTO free of mutation hashes', async () => {
    await WalletService.creditWallet(base({
      idempotencyKey: 'wallet-safe-dto-key',
    }));

    const read = await WalletService.getWallet(user.id);
    const ledger = await WalletService.listTransactions(user.id, {
      page: 1,
      limit: 20,
    });

    const serialized = JSON.stringify({ read, ledger });
    expect(serialized).not.toContain('idempotencyKeyHash');
    expect(serialized).not.toContain('requestHash');
    expect(serialized).not.toContain('wallet-safe-dto-key');
  });
});
'@ | Set-Content ".\tests\wallet-mutation.test.js" -Encoding UTF8

# Normalize service/test to UTF-8 no BOM and one EOF newline.
foreach ($file in @(
    ".\src\modules\wallet\service.js",
    ".\tests\wallet-mutation.test.js"
)) {
    $content = (Get-Content $file -Raw).TrimEnd() + "`n"
    [System.IO.File]::WriteAllText(
        (Resolve-Path $file),
        $content,
        [System.Text.UTF8Encoding]::new($false)
    )
}

# -------------------------------------------------------------------
# 4. VERIFY NO PUBLIC MUTATION ROUTE WAS ADDED
# -------------------------------------------------------------------
Write-Host "`n===== PUBLIC ROUTE SAFETY CHECK =====" -ForegroundColor Cyan
$routeText = Get-Content ".\src\modules\wallet\routes.js" -Raw

if ($routeText -match "router\.(post|put|patch|delete)\s*\(") {
    throw "STOP: A public wallet mutation route exists. Review before continuing."
}

Write-Host "PASS: wallet routes remain GET-only." -ForegroundColor Green

# -------------------------------------------------------------------
# 5. VERIFY NO SCHEMA/MIGRATION CHANGE FROM THIS PATCH
# -------------------------------------------------------------------
Write-Host "`n===== PRISMA STATUS =====" -ForegroundColor Cyan
npx prisma migrate status
if ($LASTEXITCODE -ne 0) {
    throw "Prisma migration status failed."
}

# -------------------------------------------------------------------
# 6. SYNTAX
# -------------------------------------------------------------------
Write-Host "`n===== SYNTAX =====" -ForegroundColor Cyan
node --check ".\src\modules\wallet\service.js"
if ($LASTEXITCODE -ne 0) { throw "wallet/service.js syntax failed." }

node --check ".\src\config\database.mock.js"
if ($LASTEXITCODE -ne 0) { throw "database.mock.js syntax failed." }

node --check ".\tests\wallet-mutation.test.js"
if ($LASTEXITCODE -ne 0) { throw "wallet-mutation.test.js syntax failed." }

Write-Host "Syntax PASS" -ForegroundColor Green

# -------------------------------------------------------------------
# 7. TARGETED WALLET TESTS
# -------------------------------------------------------------------
Write-Host "`n===== WALLET READ + MUTATION TESTS =====" -ForegroundColor Cyan
npm test -- --runInBand tests/wallet-read.test.js tests/wallet-mutation.test.js
if ($LASTEXITCODE -ne 0) {
    throw "Wallet targeted tests FAILED. Stop and send the full output."
}

# -------------------------------------------------------------------
# 8. LINT
# -------------------------------------------------------------------
Write-Host "`n===== LINT =====" -ForegroundColor Cyan
npm run lint
if ($LASTEXITCODE -ne 0) {
    throw "Lint FAILED. Stop and send the full output."
}

# -------------------------------------------------------------------
# 9. FULL REGRESSION
# -------------------------------------------------------------------
Write-Host "`n===== FULL BACKEND REGRESSION =====" -ForegroundColor Cyan
npm test -- --runInBand
if ($LASTEXITCODE -ne 0) {
    throw "Full backend regression FAILED. Stop and send the full output."
}

# -------------------------------------------------------------------
# 10. REAL DB MUST STILL HAVE NO MONEY MOVEMENT
# Tests use mock DB. Production/local real DB should remain untouched.
# -------------------------------------------------------------------
Write-Host "`n===== REAL DB WALLET COUNTS =====" -ForegroundColor Cyan
@'
const { prisma } = require("./src/config/database");

(async () => {
  try {
    console.log({
      walletCount: await prisma.wallet.count(),
      transactionCount: await prisma.walletTransaction.count(),
    });
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
'@ | node

if ($LASTEXITCODE -ne 0) {
    throw "Real DB wallet count verification FAILED."
}

# -------------------------------------------------------------------
# 11. FINAL DIFF / STATUS
# -------------------------------------------------------------------
Write-Host "`n===== WALLET PHASE 2A DIFF =====" -ForegroundColor Cyan
git diff -- `
    src/modules/wallet/service.js `
    src/config/database.mock.js `
    tests/wallet-mutation.test.js

Write-Host "`n===== FINAL GIT STATUS =====" -ForegroundColor Cyan
git status --short

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "WALLET PHASE 2A PATCH RUN COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "No public wallet mutation endpoint was added." -ForegroundColor Green
Write-Host "Do NOT commit yet. Send me the complete output." -ForegroundColor Yellow

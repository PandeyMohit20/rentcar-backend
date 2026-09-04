'use strict';
/* eslint-disable no-console */

const crypto = require('crypto');
const { prisma } = require('../src/config/database');
const { assignVendorOwner } = require('../src/modules/vendors/membership.service');
const { AdminKycService } = require('../src/modules/adminKyc/service');

const iterations = 10;
const tag = `p5c-race-${Date.now()}`;
const metrics = { owner: { a: 0, b: 0, conflicts: 0, invalid: 0, unexpected: 0, rollbackPreserved: false }, customer: { verify: 0, reject: 0, conflicts: 0, invalid: 0, mixed: 0, audits: 0, unexpected: 0 }, vendor: { verify: 0, reject: 0, conflicts: 0, invalid: 0, mixed: 0, audits: 0, unexpected: 0 }, document: { verify: 0, reject: 0, conflicts: 0, invalid: 0, audits: 0, unexpected: 0 } };
let fixture;

function conflict(error) { return error?.statusCode === 409; }
function requireResult(condition, message) { if (!condition) throw new Error(message); }
async function race(left, right, metric) { const results = await Promise.allSettled([left(), right()]); for (const result of results) { if (result.status === 'rejected' && conflict(result.reason)) metric.conflicts += 1; else if (result.status === 'rejected') { metric.unexpected += 1; throw result.reason; } } return results; }

async function createUser(label) { return prisma.user.create({ data: { name: label, email: `${tag}-${label}-${crypto.randomUUID()}@example.test`, passwordHash: 'x', status: 'active' } }); }
async function setup() {
  const ownerA = await createUser('owner-a'); const ownerB = await createUser('owner-b');
  const reviewerA = await createUser('reviewer-a'); const reviewerB = await createUser('reviewer-b'); const customer = await createUser('customer');
  await prisma.profile.create({ data: { userId: customer.id, verificationStatus: 'pending', submittedAt: new Date() } });
  const vendor = await prisma.vendor.create({ data: { vendorCode: `${tag}-${crypto.randomUUID().slice(0, 8)}`, companyName: tag, verificationStatus: 'pending' } });
  await prisma.vendorMember.create({ data: { vendorId: vendor.id, userId: ownerA.id, isOwner: true } }); await prisma.vendorMember.create({ data: { vendorId: vendor.id, userId: ownerB.id, isOwner: false } });
  const licence = await prisma.userDocument.create({ data: { userId: customer.id, documentType: 'driving_license', storageKey: `${tag}.pdf`, status: 'verified', expiresAt: new Date('2035-01-01') } });
  const vendorDocument = await prisma.vendorDocument.create({ data: { vendorId: vendor.id, documentType: 'gst', documentUrl: `private/vendors/${tag}.pdf`, status: 'verified' } });
  fixture = { ownerA, ownerB, reviewerA, reviewerB, customer, vendor, licence, vendorDocument };
}
async function resetCustomer() { await prisma.profile.update({ where: { userId: fixture.customer.id }, data: { verificationStatus: 'pending', verifiedAt: null, verifiedBy: null, rejectionReason: null, submittedAt: new Date() } }); await prisma.auditLog.deleteMany({ where: { entity: 'profile', entityId: (await prisma.profile.findUnique({ where: { userId: fixture.customer.id } })).id, module: 'kyc' } }); }
async function resetVendor() { await prisma.vendor.update({ where: { id: fixture.vendor.id }, data: { verificationStatus: 'pending', verifiedAt: null, verifiedBy: null, rejectionReason: null, submittedAt: new Date() } }); await prisma.auditLog.deleteMany({ where: { entity: 'vendor', entityId: fixture.vendor.id, module: 'kyc' } }); }
async function resetDocument() { await prisma.userDocument.update({ where: { id: fixture.licence.id }, data: { status: 'pending', verifiedAt: null, verifiedBy: null, rejectionReason: null } }); await prisma.auditLog.deleteMany({ where: { entity: 'user_document', entityId: fixture.licence.id, module: 'kyc' } }); }

async function run() {
  await setup();
  for (let i = 0; i < iterations; i += 1) {
    await Promise.all([assignVendorOwner(fixture.vendor.id, fixture.ownerA.id), assignVendorOwner(fixture.vendor.id, fixture.ownerB.id)]);
    const owners = await prisma.vendorMember.findMany({ where: { vendorId: fixture.vendor.id, isOwner: true } }); requireResult(owners.length === 1, 'owner invariant violated'); if (owners[0].userId === fixture.ownerA.id) metrics.owner.a += 1; else if (owners[0].userId === fixture.ownerB.id) metrics.owner.b += 1; else metrics.owner.invalid += 1;
    await resetCustomer(); const customerResults = await race(() => AdminKycService.reviewCustomer(fixture.reviewerA.id, fixture.customer.id, 'verify'), () => AdminKycService.reviewCustomer(fixture.reviewerB.id, fixture.customer.id, 'reject', 'race reject'), metrics.customer); const profile = await prisma.profile.findUnique({ where: { userId: fixture.customer.id } }); const customerAudits = await prisma.auditLog.findMany({ where: { entity: 'profile', entityId: profile.id, module: 'kyc' } }); if (profile.verificationStatus === 'verified' && profile.verifiedAt && !profile.rejectionReason) metrics.customer.verify += 1; else if (profile.verificationStatus === 'rejected' && !profile.verifiedAt && profile.rejectionReason) metrics.customer.reject += 1; else metrics.customer.invalid += 1; if (customerAudits.length !== 1) metrics.customer.audits += 1; requireResult(customerResults.filter((r) => r.status === 'fulfilled').length === 1, 'customer race had multiple winners');
    await resetVendor(); const vendorResults = await race(() => AdminKycService.reviewVendor(fixture.reviewerA.id, fixture.vendor.id, 'verify'), () => AdminKycService.reviewVendor(fixture.reviewerB.id, fixture.vendor.id, 'reject', 'race reject'), metrics.vendor); const vendor = await prisma.vendor.findUnique({ where: { id: fixture.vendor.id } }); const vendorAudits = await prisma.auditLog.findMany({ where: { entity: 'vendor', entityId: fixture.vendor.id, module: 'kyc' } }); if (vendor.verificationStatus === 'verified' && vendor.verifiedAt && !vendor.rejectionReason) metrics.vendor.verify += 1; else if (vendor.verificationStatus === 'rejected' && !vendor.verifiedAt && vendor.rejectionReason) metrics.vendor.reject += 1; else metrics.vendor.invalid += 1; if (vendorAudits.length !== 1) metrics.vendor.audits += 1; requireResult(vendorResults.filter((r) => r.status === 'fulfilled').length === 1, 'vendor race had multiple winners');
    await resetDocument(); const documentResults = await race(() => AdminKycService.reviewCustomerDocument(fixture.reviewerA.id, fixture.licence.id, 'verify'), () => AdminKycService.reviewCustomerDocument(fixture.reviewerB.id, fixture.licence.id, 'reject', 'race reject'), metrics.document); const document = await prisma.userDocument.findUnique({ where: { id: fixture.licence.id } }); const documentAudits = await prisma.auditLog.findMany({ where: { entity: 'user_document', entityId: fixture.licence.id, module: 'kyc' } }); if (!['verified', 'rejected'].includes(document.status) || (document.status === 'verified' && (!document.verifiedAt || document.rejectionReason)) || (document.status === 'rejected' && (document.verifiedAt || !document.rejectionReason))) metrics.document.invalid += 1; else metrics.document[document.status === 'verified' ? 'verify' : 'reject'] += 1; if (documentAudits.length !== 1) metrics.document.audits += 1; requireResult(documentResults.filter((r) => r.status === 'fulfilled').length === 1, 'document race had multiple winners');
  }
  const priorOwner = await prisma.vendorMember.findFirst({ where: { vendorId: fixture.vendor.id, isOwner: true } }); const nextOwner = priorOwner.userId === fixture.ownerA.id ? fixture.ownerB : fixture.ownerA;
  try { await assignVendorOwner(fixture.vendor.id, nextOwner.id, { afterOwnersCleared: async () => { throw new Error('PHASE5C_ROLLBACK_PROOF'); } }); } catch (error) { requireResult(error.message === 'PHASE5C_ROLLBACK_PROOF', 'owner rollback hook did not fail as expected'); }
  const rollbackOwners = await prisma.vendorMember.findMany({ where: { vendorId: fixture.vendor.id, isOwner: true } }); metrics.owner.rollbackPreserved = rollbackOwners.length === 1 && rollbackOwners[0].userId === priorOwner.userId;
  const result = metrics.owner.rollbackPreserved && Object.values(metrics).every((value) => value.invalid === 0 && value.unexpected === 0 && (value.audits === undefined || value.audits === 0));
  console.log(JSON.stringify({ realMySql: true, iterations, ...metrics }, null, 2)); console.log(`RESULT: ${result ? 'PASS' : 'FAIL'}`); if (!result) process.exitCode = 1;
}
async function cleanup() { if (!fixture) return; await prisma.auditLog.deleteMany({ where: { module: 'kyc', OR: [{ entity: 'vendor', entityId: fixture.vendor.id }, { entity: 'user_document', entityId: fixture.licence.id }] } }); const profile = await prisma.profile.findUnique({ where: { userId: fixture.customer.id } }); if (profile) await prisma.auditLog.deleteMany({ where: { module: 'kyc', entity: 'profile', entityId: profile.id } }); await prisma.vendorDocument.delete({ where: { id: fixture.vendorDocument.id } }); await prisma.userDocument.delete({ where: { id: fixture.licence.id } }); await prisma.vendorMember.deleteMany({ where: { vendorId: fixture.vendor.id } }); await prisma.profile.delete({ where: { userId: fixture.customer.id } }); await prisma.vendor.delete({ where: { id: fixture.vendor.id } }); for (const user of [fixture.ownerA, fixture.ownerB, fixture.reviewerA, fixture.reviewerB, fixture.customer]) await prisma.user.delete({ where: { id: user.id } }); }
run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await cleanup(); await prisma.$disconnect(); });

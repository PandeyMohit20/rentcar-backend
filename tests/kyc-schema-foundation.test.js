'use strict';

const fs = require('fs');
const path = require('path');
const { prisma, resetStore } = require('./helpers/auth');
const VendorsService = require('../src/modules/vendors/service');

const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
const migration = fs.readFileSync(
  path.join(__dirname, '..', 'prisma', 'migrations', '20260903030000_add_customer_vendor_kyc_foundation', 'migration.sql'),
  'utf8',
);

describe('Phase 5A2 KYC schema foundation', () => {
  beforeEach(() => resetStore());

  it('defines the controlled customer document model without raw Aadhaar storage', () => {
    expect(schema).toMatch(/enum UserDocumentTypeEnum\s*\{[\s\S]*driving_license[\s\S]*pan[\s\S]*identity_proof[\s\S]*address_proof/);
    expect(schema).toMatch(/model UserDocument\s*\{[\s\S]*userId[\s\S]*storageKey[\s\S]*status\s+DocumentStatusEnum[\s\S]*verifiedBy[\s\S]*rejectionReason/);
    expect(schema).toMatch(/@@index\(\[userId, status\]\)/);
    expect(schema).toMatch(/@@index\(\[userId, documentType\]\)/);
    expect(schema).not.toMatch(/@@unique\(\[userId, documentType\]\)/);
    expect(schema).not.toMatch(/aadhaarNumber|rawAadhaar|governmentIdRaw/);
  });

  it('adds nullable reviewer metadata with SetNull reviewer relations', () => {
    for (const model of ['Profile', 'Vendor', 'VendorDocument']) {
      const block = schema.match(new RegExp(`model ${model}\\s*\\{([\\s\\S]*?)\\n\\}`));
      expect(block).not.toBeNull();
      expect(block[1]).toMatch(/verifiedAt/);
      expect(block[1]).toMatch(/verifiedBy/);
      expect(block[1]).toMatch(/rejectionReason/);
    }
    expect(schema).toMatch(/ProfileVerifiedBy[\s\S]*onDelete: SetNull/);
    expect(schema).toMatch(/VendorVerifiedBy[\s\S]*onDelete: SetNull/);
    expect(schema).toMatch(/VendorDocumentVerifiedBy[\s\S]*onDelete: SetNull/);
    expect(schema).toMatch(/UserDocumentVerifiedBy[\s\S]*onDelete: SetNull/);
  });

  it('supports historical user documents and unique vendor membership pairs in the mock', async () => {
    await prisma.userDocument.create({ data: { userId: 'user-1', documentType: 'driving_license', storageKey: 'private/a.pdf' } });
    await expect(prisma.userDocument.create({ data: { userId: 'user-1', documentType: 'driving_license', storageKey: 'private/b.pdf' } })).resolves.toBeDefined();
    await prisma.vendorMember.create({ data: { vendorId: 'vendor-1', userId: 'user-1', isOwner: true } });
    await expect(prisma.vendorMember.create({ data: { vendorId: 'vendor-1', userId: 'user-1' } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('defines VendorMember ownership indexes and preserves the existing aggregate-only design', () => {
    expect(schema).toMatch(/model VendorMember\s*\{[\s\S]*vendorId[\s\S]*userId[\s\S]*isOwner/);
    expect(schema).toMatch(/@@unique\(\[vendorId, userId\]\)/);
    expect(schema).toMatch(/@@index\(\[vendorId, isOwner\]\)/);
    expect(schema).not.toMatch(/model CustomerVerification\b|model VendorVerification\b|model KycHistory\b/);
  });

  it('uses one additive migration without drop or truncate statements', () => {
    expect(migration).toContain('CREATE TABLE `user_documents`');
    expect(migration).toContain('CREATE TABLE `vendor_members`');
    expect(migration).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
  });

  it('keeps new vendor review metadata out of generic document DTOs', () => {
    const response = VendorsService.toVendorDocumentResponse({
      id: 'document-1',
      status: 'verified',
      verifiedAt: new Date(),
      verifiedBy: 'reviewer-1',
      rejectionReason: 'internal review detail',
    });
    expect(response).toEqual({ id: 'document-1', status: 'verified' });
  });
});

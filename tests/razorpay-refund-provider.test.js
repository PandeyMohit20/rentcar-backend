'use strict';

const mockRefund = jest.fn();

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    payments: {
      refund: mockRefund,
    },
  }));
});

const { env } = require('../src/config/env');
const { createRefund, providerKey } = require('../src/modules/payments/providers/razorpay');

describe('Razorpay refund provider', () => {
  const original = {
    id: env.RAZORPAY_KEY_ID,
    secret: env.RAZORPAY_KEY_SECRET,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    env.RAZORPAY_KEY_ID = 'rzp_test_public';
    env.RAZORPAY_KEY_SECRET = 'test_secret_not_logged';
  });

  afterAll(() => {
    env.RAZORPAY_KEY_ID = original.id;
    env.RAZORPAY_KEY_SECRET = original.secret;
  });

  it('uses the Razorpay SDK with the exact minor amount', async () => {
    mockRefund.mockResolvedValue({
      id: 'rfnd_1',
      payment_id: 'pay_1',
      amount: 123450,
      currency: 'INR',
      status: 'pending',
    });

    const result = await createRefund({
      providerPaymentId: 'pay_1',
      amountMinor: 123450,
      idempotencyKey: 'refund_key_123',
    });

    expect(mockRefund).toHaveBeenCalledTimes(1);
    expect(mockRefund).toHaveBeenCalledWith('pay_1', {
      amount: 123450,
    });

    expect(result).toEqual({
      providerRefundId: 'rfnd_1',
      providerPaymentId: 'pay_1',
      amountMinor: 123450,
      currency: 'INR',
      status: 'pending',
      rawStatus: 'pending',
    });
  });

  it('rejects an invalid persisted key before invoking Razorpay', async () => {
    expect(providerKey('short')).toBe(false);
    expect(providerKey('refund_key_123')).toBe(true);

    await expect(
      createRefund({
        providerPaymentId: 'pay_1',
        amountMinor: 100,
        idempotencyKey: 'bad key',
      }),
    ).rejects.toBeDefined();

    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('preserves a definitive Razorpay 400 safely', async () => {
    mockRefund.mockRejectedValue({
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST_ERROR',
        description: 'invalid request sent',
        reason: 'NA',
        source: 'NA',
        step: 'NA',
      },
    });

    await expect(
      createRefund({
        providerPaymentId: 'pay_1',
        amountMinor: 100,
        idempotencyKey: 'refund_key_123',
      }),
    ).rejects.toMatchObject({
      definitive: true,
      providerStatus: 400,
      providerError: {
        code: 'BAD_REQUEST_ERROR',
        description: 'invalid request sent',
        reason: 'NA',
        source: 'NA',
        step: 'NA',
      },
    });
  });

  it('marks unknown transport failures as ambiguous', async () => {
    mockRefund.mockRejectedValue(new Error('timeout'));

    await expect(
      createRefund({
        providerPaymentId: 'pay_1',
        amountMinor: 100,
        idempotencyKey: 'refund_key_123',
      }),
    ).rejects.toMatchObject({
      ambiguous: true,
    });
  });

  it('rejects inconsistent Razorpay refund responses', async () => {
    mockRefund.mockResolvedValue({
      id: 'rfnd_bad',
      payment_id: 'pay_other',
      amount: 100,
      currency: 'INR',
      status: 'pending',
    });

    await expect(
      createRefund({
        providerPaymentId: 'pay_1',
        amountMinor: 100,
        idempotencyKey: 'refund_key_123',
      }),
    ).rejects.toBeDefined();
  });
});

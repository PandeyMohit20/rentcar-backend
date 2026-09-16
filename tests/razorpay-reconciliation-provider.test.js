'use strict';
const { env } = require('../src/config/env');
const provider = require('../src/modules/payments/providers/razorpay');
const originalKey = env.RAZORPAY_KEY_ID,
  originalSecret = env.RAZORPAY_KEY_SECRET;
beforeEach(() => {
  env.RAZORPAY_KEY_ID = 'rzp_test_isolated';
  env.RAZORPAY_KEY_SECRET = 'isolated-test-only';
});
afterEach(() => {
  env.RAZORPAY_KEY_ID = originalKey;
  env.RAZORPAY_KEY_SECRET = originalSecret;
  jest.restoreAllMocks();
});
it('fetches only the stored order and its payments with bounded request signals', async () => {
  const fetcher = jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (url) => ({
      ok: true,
      json: async () =>
        url.includes('/payments?')
          ? { count: 1, items: [{ id: 'pay_local' }] }
          : { id: 'order_local' },
    }));
  expect(await provider.fetchOrderState('order_local')).toEqual({
    order: { id: 'order_local' },
    payments: [{ id: 'pay_local' }],
    complete: true,
  });
  expect(fetcher.mock.calls.map((x) => x[0]).sort()).toEqual([
    'https://api.razorpay.com/v1/orders/order_local',
    'https://api.razorpay.com/v1/orders/order_local/payments?count=100',
  ]);
  expect(fetcher.mock.calls.every((x) => x[1].signal instanceof AbortSignal)).toBe(true);
});
it('rejects malformed/truncated payment collections as incomplete', async () => {
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({ ok: true, json: async () => ({ count: 101, items: [] }) });
  expect((await provider.fetchOrderState('order_local')).complete).toBe(false);
});
it('does not expose provider error bodies', async () => {
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({ ok: false, json: async () => ({ private: 'sensitive' }) });
  await expect(provider.fetchPaymentState('pay_local')).rejects.toMatchObject({
    statusCode: 503,
    message: 'Payment provider verification is temporarily unavailable. Please retry later.',
  });
});
it('sanitizes timeouts and rejects missing credentials before network access', async () => {
  const fetcher = jest.spyOn(global, 'fetch').mockRejectedValue(Error('sensitive diagnostic'));
  await expect(provider.fetchPaymentState('pay_local')).rejects.toMatchObject({ statusCode: 503 });
  fetcher.mockClear();
  env.RAZORPAY_KEY_ID = '';
  await expect(provider.fetchPaymentState('pay_local')).rejects.toMatchObject({ statusCode: 503 });
  expect(fetcher).not.toHaveBeenCalled();
});

'use strict';

const crypto = require('crypto');
const Razorpay = require('razorpay');
const { env } = require('../../../config/env');
const AppError = require('../../../errors/AppError');
const httpStatus = require('../../../constants/httpStatus');
const errorCodes = require('../../../errors/errorCodes');

function configured(...keys) { return keys.every((key) => env[key]); }
function unavailable() { return new AppError('Razorpay is not configured.', httpStatus.SERVICE_UNAVAILABLE, errorCodes.PAYMENT_PROVIDER_UNAVAILABLE); }
function secureEqual(expected, actual) { const a = Buffer.from(expected || '', 'utf8'); const b = Buffer.from(actual || '', 'utf8'); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function createClient() { if (!configured('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET')) throw unavailable(); return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET }); }
async function createOrder({ amount, currency, receipt }) { return createClient().orders.create({ amount, currency, receipt }); }
const REFUND_BASE_URL = 'https://api.razorpay.com/v1';
function providerKey(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{10,}$/.test(value); }
async function createRefund({ providerPaymentId, amountMinor, idempotencyKey, transport = global.fetch }) { if (!configured('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET')) throw unavailable(); if (!providerPaymentId || !Number.isSafeInteger(amountMinor) || amountMinor < 1 || !providerKey(idempotencyKey)) throw new AppError('Invalid persisted Razorpay refund request.', httpStatus.UNPROCESSABLE_ENTITY, errorCodes.VALIDATION_ERROR); const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64'); let response; try { response = await transport(`${REFUND_BASE_URL}/payments/${encodeURIComponent(providerPaymentId)}/refund`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', 'X-Refund-Idempotency': idempotencyKey }, body: JSON.stringify({ amount: amountMinor }), signal: AbortSignal.timeout(15000) }); } catch (err) { const unknown = new AppError('Razorpay refund outcome is unknown; retry with the same idempotency key.', httpStatus.SERVICE_UNAVAILABLE, errorCodes.PAYMENT_PROVIDER_UNAVAILABLE); unknown.ambiguous = true; throw unknown; } let body; try { body = await response.json(); } catch (_) { body = {}; } if (!response.ok) { const err = new AppError('Razorpay refund request was rejected.', httpStatus.SERVICE_UNAVAILABLE, errorCodes.PAYMENT_PROVIDER_UNAVAILABLE); err.definitive = response.status >= 400 && response.status < 500; err.providerStatus = response.status; throw err; } if (!body.id || body.payment_id !== providerPaymentId || Number(body.amount) !== amountMinor) throw new AppError('Razorpay refund response did not match the persisted request.', httpStatus.CONFLICT, errorCodes.CONFLICT); return { providerRefundId: body.id, providerPaymentId: body.payment_id, amountMinor: Number(body.amount), currency: body.currency, status: body.status, rawStatus: body.status }; }
function verifyCheckoutSignature({ orderId, paymentId, signature }) { if (!configured('RAZORPAY_KEY_SECRET')) throw unavailable(); const expected = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex'); return secureEqual(expected, signature); }
function verifyWebhookSignature(rawBody, signature) { if (!configured('RAZORPAY_WEBHOOK_SECRET')) throw unavailable(); const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex'); return secureEqual(expected, signature); }
function parseWebhookEvent(rawBody) { return JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody); }
module.exports = { createOrder, createRefund, verifyCheckoutSignature, verifyWebhookSignature, parseWebhookEvent, providerKey };

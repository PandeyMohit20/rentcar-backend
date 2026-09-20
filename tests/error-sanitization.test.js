'use strict';

const express = require('express');
const request = require('supertest');
const { Prisma } = require('@prisma/client');
const { errorHandler } = require('../src/errors/errorHandler');
const { logger } = require('../src/config/logger');
const AppError = require('../src/errors/AppError');

const respond = (error) => {
  const app = express();
  app.get('/', (req, res, next) => next(error));
  app.use(errorHandler);
  return request(app).get('/');
};

describe('Customer-safe API errors', () => {
  it.each(['development', 'staging', 'production'])(
    'hides Prisma internals in %s',
    async (mode) => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = mode;
      const log = jest.spyOn(logger, 'error').mockImplementation(() => {});
      try {
        const error = new Prisma.PrismaClientValidationError(
          'Unknown field taxProfile at C:\\private\\service.js; SELECT secret FROM vendors',
          { clientVersion: '5.22.0' },
        );
        error.details = { query: 'private query' };
        const res = await respond(error);
        expect(res.status).toBe(500);
        expect(res.body).toEqual({
          success: false,
          message: 'The service is temporarily unavailable. Please try again shortly.',
          error: { code: 'INTERNAL_ERROR' },
        });
        expect(log).toHaveBeenCalledWith(
          'Unhandled error',
          expect.objectContaining({ stack: error.stack }),
        );
      } finally {
        process.env.NODE_ENV = previous;
        log.mockRestore();
      }
    },
  );

  it('preserves safe operational validation details without a stack', async () => {
    const res = await respond(
      new AppError('Invalid interval.', 409, 'CONFLICT', { reasonCode: 'OVERLAP' }),
    );
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: 'Invalid interval.',
      error: { code: 'CONFLICT', details: { reasonCode: 'OVERLAP' } },
    });
  });

  it('sanitizes operational server errors and unknown database errors', async () => {
    for (const error of [
      new AppError('private upstream details', 503, 'PRIVATE_CODE', { secret: true }),
      Object.assign(new Error('SQL internals'), { code: 'P9999' }),
    ]) {
      const res = await respond(error);
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR' });
      expect(res.body.message).toBe(
        'The service is temporarily unavailable. Please try again shortly.',
      );
    }
  });
});

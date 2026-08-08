'use strict';

const request = require('supertest');
const express = require('express');
const { z } = require('zod');
const { validate } = require('../src/middlewares/validate');
const { errorHandler } = require('../src/middlewares/errorHandler');

describe('Validation middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const schema = z.object({
      email: z.string().email(),
      age: z.number().int().positive(),
    });

    app.post('/test', validate({ body: schema }), (req, res) =>
      res.json({ success: true, data: req.body }),
    );

    app.use(errorHandler);
  });

  it('passes through valid input', async () => {
    const res = await request(app).post('/test').send({ email: 'user@example.com', age: 25 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 422 with VALIDATION_ERROR for invalid input', async () => {
    const res = await request(app).post('/test').send({ email: 'not-an-email', age: -5 });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues).toBeDefined();
  });
});

'use strict';
const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorizeRole } = require('../../middlewares/authorize');
const { validate, z } = require('../../middlewares/validate');
const { success } = require('../../utils/response');
const { review, complete, approvalSchema, saveProfile, profileUpdateSchema } = require('./service');
const router = Router();
router.use(authenticate, authorizeRole('SUPER_ADMIN'));
router.get('/', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    return success(res, { data: await review() });
  } catch (error) {
    return next(error);
  }
});
router.post('/complete', validate({ body: approvalSchema }), async (req, res, next) => {
  try {
    return success(res, { data: await complete(req.body, req.user.sub) });
  } catch (error) {
    return next(error);
  }
});
router.put(
  '/vendors/:vendorId/tax-profile',
  validate({ params: z.object({ vendorId: z.string().uuid() }), body: profileUpdateSchema }),
  async (req, res, next) => {
    try {
      return success(res, { data: await saveProfile(req.params.vendorId, req.body, req.user.sub) });
    } catch (error) {
      return next(error);
    }
  },
);
module.exports = { billingApprovalRouter: router };

'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate, z } = require('../../middlewares/validate');
const { ReviewsController: controller } = require('./controller');

const router = Router();

/*
 * ============================================================
 * CUSTOMER REVIEW APIs
 * ============================================================
 */

const createReviewBody = z.object({
  bookingId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

const updateReviewBody = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(2000).optional(),
});

const myListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const carParams = z.object({
  carId: z.string().uuid(),
});

router.post(
  '/',
  authenticate,
  validate({ body: createReviewBody }),
  controller.create,
);

router.get(
  '/my',
  authenticate,
  validate({ query: myListQuery }),
  controller.listMine,
);

router.get(
  '/my/summary',
  authenticate,
  controller.mySummary,
);

router.patch(
  '/:reviewId',
  authenticate,
  validate({
    params: z.object({
      reviewId: z.string().uuid(),
    }),
    body: updateReviewBody,
  }),
  controller.updateMine,
);

router.get(
  '/car/:carId',
  validate({ params: carParams }),
  controller.listForCar,
);

/*
 * ============================================================
 * ADMIN REVIEW APIs
 * ============================================================
 */

const reviewAccess = [
  authenticate,
  authorize('reviews.view'),
];

const reviewModerate = [
  authenticate,
  authorize('reviews.moderate'),
];

const idParams = z.object({
  reviewId: z.string().uuid(),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(255).optional(),
  status: z.enum([
    'pending',
    'approved',
    'rejected',
    'hidden',
  ]).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sortBy: z.enum([
    'createdAt',
    'rating',
    'status',
  ]).optional(),
  sortOrder: z.enum([
    'asc',
    'desc',
  ]).optional(),
});

const rejectionBody = z.object({
  reason: z.string().trim().min(1).max(500),
});

router.get(
  '/',
  ...reviewAccess,
  validate({ query: listQuery }),
  controller.list,
);

router.get(
  '/:reviewId',
  ...reviewAccess,
  validate({ params: idParams }),
  controller.detail,
);

router.post(
  '/:reviewId/approve',
  ...reviewModerate,
  validate({ params: idParams }),
  controller.approve,
);

router.post(
  '/:reviewId/reject',
  ...reviewModerate,
  validate({
    params: idParams,
    body: rejectionBody,
  }),
  controller.reject,
);

router.post(
  '/:reviewId/hide',
  ...reviewModerate,
  validate({ params: idParams }),
  controller.hide,
);

module.exports = { reviewsRouter: router };

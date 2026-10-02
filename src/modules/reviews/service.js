'use strict';

const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');
const { prisma } = require('../../config/database');

const notFound = (message = 'Review not found.') =>
  new AppError(
    message,
    httpStatus.NOT_FOUND,
    errorCodes.RESOURCE_NOT_FOUND,
  );

const conflict = (message) =>
  new AppError(
    message,
    httpStatus.CONFLICT,
    errorCodes.CONFLICT,
  );

const validation = (message) =>
  new AppError(
    message,
    httpStatus.UNPROCESSABLE_ENTITY,
    errorCodes.VALIDATION_ERROR,
  );

const audit = (
  db,
  reviewerId,
  action,
  reviewId,
  metadata,
) =>
  db.auditLog.create({
    data: {
      userId: reviewerId,
      action,
      module: 'reviews',
      entity: 'review',
      entityId: reviewId,
      result: 'success',
      metadata: JSON.stringify(metadata),
    },
  });

const reviewInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  car: {
    select: {
      id: true,
      brand: true,
      model: true,
      variant: true,
      registrationNumber: true,
    },
  },
  booking: {
    select: {
      id: true,
      bookingNumber: true,
      startAt: true,
      endAt: true,
      status: true,
    },
  },
};

const customerReviewInclude = {
  car: {
    select: {
      id: true,
      brand: true,
      model: true,
      variant: true,
      registrationNumber: true,
    },
  },
  booking: {
    select: {
      id: true,
      bookingNumber: true,
      startAt: true,
      endAt: true,
      status: true,
    },
  },
};

const dto = (review) => ({
  id: review.id,
  rating: review.rating,
  comment: review.comment,
  status: review.status,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  user: review.user
    ? {
        id: review.user.id,
        name: review.user.name,
        email: review.user.email,
        phone: review.user.phone,
      }
    : null,
  car: review.car
    ? {
        id: review.car.id,
        brand: review.car.brand,
        model: review.car.model,
        variant: review.car.variant,
        registrationNumber: review.car.registrationNumber,
      }
    : null,
  booking: review.booking
    ? {
        id: review.booking.id,
        bookingNumber: review.booking.bookingNumber,
        startAt: review.booking.startAt,
        endAt: review.booking.endAt,
        status: review.booking.status,
      }
    : null,
});

const customerDto = (review) => ({
  id: review.id,
  rating: review.rating,
  comment: review.comment,
  status: review.status,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  car: review.car
    ? {
        id: review.car.id,
        brand: review.car.brand,
        model: review.car.model,
        variant: review.car.variant,
        registrationNumber: review.car.registrationNumber,
      }
    : null,
  booking: review.booking
    ? {
        id: review.booking.id,
        bookingNumber: review.booking.bookingNumber,
        startAt: review.booking.startAt,
        endAt: review.booking.endAt,
        status: review.booking.status,
      }
    : null,
});

const normalizeSearch = (value) => {
  if (!value) return null;

  const search = String(value).trim();

  return search ? search : null;
};

const buildWhere = ({ search, status, rating }) => {
  const where = {};

  if (status) {
    where.status = status;
  }

  if (rating !== undefined && rating !== null) {
    where.rating = Number(rating);
  }

  const term = normalizeSearch(search);

  if (term) {
    where.OR = [
      {
        comment: {
          contains: term,
        },
      },
      {
        user: {
          name: {
            contains: term,
          },
        },
      },
      {
        user: {
          email: {
            contains: term,
          },
        },
      },
      {
        car: {
          brand: {
            contains: term,
          },
        },
      },
      {
        car: {
          model: {
            contains: term,
          },
        },
      },
      {
        car: {
          registrationNumber: {
            contains: term,
          },
        },
      },
      {
        booking: {
          bookingNumber: {
            contains: term,
          },
        },
      },
    ];
  }

  return where;
};

const allowedSort = {
  createdAt: 'createdAt',
  rating: 'rating',
  status: 'status',
};

async function recalculateCarRating(db, carId) {
  const aggregate = await db.review.aggregate({
    where: {
      carId,
      status: 'approved',
    },
    _avg: {
      rating: true,
    },
    _count: {
      _all: true,
    },
  });

  const average = aggregate._avg.rating || 0;
  const count = aggregate._count._all || 0;

  const existing = await db.ratingSummary.findFirst({
    where: {
      carId,
    },
  });

  if (existing) {
    return db.ratingSummary.update({
      where: {
        id: existing.id,
      },
      data: {
        average,
        count,
      },
    });
  }

  return db.ratingSummary.create({
    data: {
      carId,
      average,
      count,
    },
  });
}

const ReviewsService = {
  /*
   * ============================================================
   * CUSTOMER
   * ============================================================
   */

  async create(userId, payload) {
    const booking = await prisma.booking.findFirst({
      where: {
        id: payload.bookingId,
        userId,
      },
      select: {
        id: true,
        bookingNumber: true,
        userId: true,
        carId: true,
        status: true,
      },
    });

    if (!booking) {
      throw notFound('Booking not found.');
    }

    if (booking.status !== 'COMPLETED') {
      throw conflict(
        'You can submit a review only after the booking is completed.',
      );
    }

    const existing = await prisma.review.findFirst({
      where: {
        bookingId: booking.id,
        carId: booking.carId,
      },
    });

    if (existing) {
      throw conflict(
        'You have already reviewed this booking.',
      );
    }

    const review = await prisma.$transaction(async (db) => {
      const created = await db.review.create({
        data: {
          userId,
          bookingId: booking.id,
          carId: booking.carId,
          rating: Number(payload.rating),
          comment:
            payload.comment && String(payload.comment).trim()
              ? String(payload.comment).trim()
              : null,
          status: 'pending',
        },
        include: customerReviewInclude,
      });

      await audit(
        db,
        userId,
        'reviews.created',
        created.id,
        {
          bookingId: booking.id,
          carId: booking.carId,
          rating: created.rating,
          status: created.status,
        },
      );

      return created;
    });

    return customerDto(review);
  },

  async listMine(userId, params = {}) {
    const page = Number(params.page || 1);
    const limit = Number(params.limit || 20);
    const skip = (page - 1) * limit;

    const where = {
      userId,
    };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: customerReviewInclude,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.review.count({
        where,
      }),
    ]);

    return {
      reviews: items.map(customerDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async mySummary(userId) {
    const aggregate = await prisma.review.aggregate({
      where: {
        userId,
      },
      _avg: {
        rating: true,
      },
      _count: {
        _all: true,
      },
    });

    const average = Number(
      (aggregate._avg.rating || 0).toFixed(2),
    );

    return {
      average,
      total: aggregate._count._all || 0,
    };
  },

  async updateMine(userId, reviewId, payload) {
    const review = await prisma.review.findFirst({
      where: {
        id: reviewId,
        userId,
      },
      include: customerReviewInclude,
    });

    if (!review) {
      throw notFound();
    }

    if (review.status !== 'pending') {
      throw conflict(
        'Only pending reviews can be edited.',
      );
    }

    const data = {};

    if (
      payload.rating !== undefined &&
      payload.rating !== null
    ) {
      data.rating = Number(payload.rating);
    }

    if (payload.comment !== undefined) {
      const comment = String(payload.comment).trim();
      data.comment = comment || null;
    }

    if (!Object.keys(data).length) {
      throw validation(
        'At least one review field is required.',
      );
    }

    const updated = await prisma.$transaction(
      async (db) => {
        const result = await db.review.update({
          where: {
            id: reviewId,
          },
          data,
          include: customerReviewInclude,
        });

        await audit(
          db,
          userId,
          'reviews.updated',
          reviewId,
          {
            bookingId: result.bookingId,
            carId: result.carId,
            rating: result.rating,
          },
        );

        return result;
      },
    );

    return customerDto(updated);
  },

  async listForCar(carId, params = {}) {
    const page = Number(params.page || 1);
    const limit = Math.min(
      Number(params.limit || 10),
      100,
    );
    const skip = (page - 1) * limit;

    const where = {
      carId,
      status: 'approved',
    };

    const [items, total, aggregate] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),

      prisma.review.count({
        where,
      }),

      prisma.review.aggregate({
        where,
        _avg: {
          rating: true,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    return {
      reviews: items.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        user: review.user
          ? {
              id: review.user.id,
              name: review.user.name,
            }
          : null,
      })),
      summary: {
        average: Number(
          (aggregate._avg.rating || 0).toFixed(2),
        ),
        total: aggregate._count._all || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /*
   * ============================================================
   * ADMIN
   * ============================================================
   */

  async list(params = {}) {
    const page = Number(params.page || 1);
    const limit = Number(params.limit || 20);
    const skip = (page - 1) * limit;

    const where = buildWhere(params);

    const sortField =
      allowedSort[params.sortBy] || 'createdAt';

    const sortOrder =
      params.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: {
          [sortField]: sortOrder,
        },
        skip,
        take: limit,
      }),

      prisma.review.count({
        where,
      }),
    ]);

    return {
      items: items.map(dto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async detail(reviewId) {
    const review = await prisma.review.findUnique({
      where: {
        id: reviewId,
      },
      include: reviewInclude,
    });

    if (!review) {
      throw notFound();
    }

    return dto(review);
  },

  async changeStatus(
    reviewerId,
    reviewId,
    nextStatus,
    rejectionReason,
  ) {
    return prisma.$transaction(async (db) => {
      const review = await db.review.findUnique({
        where: {
          id: reviewId,
        },
        include: reviewInclude,
      });

      if (!review) {
        throw notFound();
      }

      if (review.status === nextStatus) {
        throw conflict(
          `Review is already ${nextStatus}.`,
        );
      }

      if (
        nextStatus === 'rejected' &&
        (!rejectionReason ||
          !String(rejectionReason).trim())
      ) {
        throw validation(
          'reason is required when rejecting a review.',
        );
      }

      const updated = await db.review.update({
        where: {
          id: reviewId,
        },
        data: {
          status: nextStatus,
        },
        include: reviewInclude,
      });

      await audit(
        db,
        reviewerId,
        `reviews.${nextStatus}`,
        reviewId,
        {
          oldStatus: review.status,
          newStatus: nextStatus,
          carId: review.carId,
          rating: review.rating,
          reason:
            nextStatus === 'rejected'
              ? String(rejectionReason).trim()
              : null,
        },
      );

      if (
        review.status === 'approved' ||
        nextStatus === 'approved'
      ) {
        await recalculateCarRating(
          db,
          review.carId,
        );
      }

      return dto(updated);
    });
  },
};

module.exports = { ReviewsService };

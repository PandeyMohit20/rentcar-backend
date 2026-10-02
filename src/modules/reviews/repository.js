'use strict';

const { prisma } = require('../../config/database');

const ReviewsRepository = {
  findById(id) {
    return prisma.review.findUnique({
      where: { id },
    });
  },

  count(where) {
    return prisma.review.count({ where });
  },

  list(args) {
    return prisma.review.findMany(args);
  },
};

module.exports = { ReviewsRepository };

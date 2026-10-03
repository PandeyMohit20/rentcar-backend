'use strict';

const { prisma } = require('../../config/database');

const SupportRepository = {
  async count(where) {
    return prisma.supportTicket.count({ where });
  },

  async list(args) {
    return prisma.supportTicket.findMany(args);
  },

  async findById(id) {
    return prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async findByIdForUser(id, userId) {
    return prisma.supportTicket.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async findMessages(ticketId) {
    return prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async findMessagesForUser(ticketId, userId) {
    return prisma.supportMessage.findMany({
      where: {
        ticketId,
        ticket: {
          userId,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async findMessageCount(ticketId) {
    return prisma.supportMessage.count({
      where: { ticketId },
    });
  },

  async createTicket(data) {
    return prisma.supportTicket.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async updateTicket(id, data) {
    return prisma.supportTicket.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async createMessage(data) {
    return prisma.supportMessage.create({
      data,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async findUserById(id) {
    return prisma.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isDeleted: true,
        status: true,
      },
    });
  },
};

module.exports = { SupportRepository };

'use strict';

const { SupportRepository: repository } = require('./repository');

const generateTicketNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `SUP-${timestamp}-${random}`;
};

const SupportService = {
  async create(userId, data) {
    const user = await repository.findUserById(userId);

    if (!user || user.isDeleted) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return repository.createTicket({
      ticketNumber: generateTicketNumber(),
      userId,
      subject: data.subject,
      description: data.description,
      category: data.category || 'support',
      priority: data.priority || 'medium',
      status: 'open',
    });
  },

  async list(query = {}) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);

    const search = query.search?.trim();

    const where = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.assignedTo) {
      where.assignedTo = query.assignedTo;
    }

    if (search) {
      where.OR = [
        {
          ticketNumber: {
            contains: search,
          },
        },
        {
          subject: {
            contains: search,
          },
        },
        {
          description: {
            contains: search,
          },
        },
        {
          user: {
            name: {
              contains: search,
            },
          },
        },
        {
          user: {
            email: {
              contains: search,
            },
          },
        },
        {
          user: {
            phone: {
              contains: search,
            },
          },
        },
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [total, items] = await Promise.all([
      repository.count(where),
      repository.list({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
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
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
    ]);

    const stats = await Promise.all([
      repository.count({}),
      repository.count({ status: 'open' }),
      repository.count({ status: 'pending' }),
      repository.count({ status: 'resolved' }),
      repository.count({ status: 'closed' }),
      repository.count({ status: 'reopened' }),
    ]);

    return {
      items,
      stats: {
        total: stats[0],
        open: stats[1],
        pending: stats[2],
        resolved: stats[3],
        closed: stats[4],
        reopened: stats[5],
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async myTickets(userId, query = {}) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);

    const where = {
      userId,
    };

    if (query.status) {
      where.status = query.status;
    }

    const [total, items] = await Promise.all([
      repository.count(where),
      repository.list({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async detail(ticketId) {
    return repository.findById(ticketId);
  },

  async myDetail(ticketId, userId) {
    const ticket = await repository.findByIdForUser(ticketId, userId);

    if (!ticket) {
      const error = new Error('Support ticket not found');
      error.statusCode = 404;
      throw error;
    }

    return ticket;
  },

  async messages(ticketId) {
    const ticket = await repository.findById(ticketId);

    if (!ticket) {
      const error = new Error('Support ticket not found');
      error.statusCode = 404;
      throw error;
    }

    return repository.findMessages(ticketId);
  },

  async myMessages(ticketId, userId) {
    const ticket = await repository.findByIdForUser(ticketId, userId);

    if (!ticket) {
      const error = new Error('Support ticket not found');
      error.statusCode = 404;
      throw error;
    }

    return repository.findMessagesForUser(ticketId, userId);
  },

  async update(ticketId, data) {
    const ticket = await repository.findById(ticketId);

    if (!ticket) {
      const error = new Error('Support ticket not found');
      error.statusCode = 404;
      throw error;
    }

    if (data.assignedTo) {
      const assignee = await repository.findUserById(data.assignedTo);

      if (!assignee || assignee.isDeleted) {
        const error = new Error('Assigned user not found');
        error.statusCode = 404;
        throw error;
      }
    }

    return repository.updateTicket(ticketId, data);
  },

  async addMessage(ticketId, userId, data) {
    const ticket = await repository.findById(ticketId);

    if (!ticket) {
      const error = new Error('Support ticket not found');
      error.statusCode = 404;
      throw error;
    }

    const message = await repository.createMessage({
      ticketId,
      senderId: userId,
      message: data.message,
      attachmentUrl: data.attachmentUrl || null,
      isStaff: true,
    });

    if (ticket.status === 'open' || ticket.status === 'reopened') {
      await repository.updateTicket(ticketId, {
        status: 'pending',
      });
    }

    return message;
  },

  async addCustomerMessage(ticketId, userId, data) {
    const ticket = await repository.findByIdForUser(ticketId, userId);

    if (!ticket) {
      const error = new Error('Support ticket not found');
      error.statusCode = 404;
      throw error;
    }

    if (ticket.status === 'closed') {
      const error = new Error('Closed support tickets cannot receive new messages');
      error.statusCode = 400;
      throw error;
    }

    return repository.createMessage({
      ticketId,
      senderId: userId,
      message: data.message,
      attachmentUrl: data.attachmentUrl || null,
      isStaff: false,
    });
  },
};

module.exports = { SupportService };

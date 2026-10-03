'use strict';

const { prisma } = require('../../config/database');

const LIMIT_PER_TYPE = 5;

const contains = (value) => ({
  contains: value,
});

const searchUsers = async (q) => {
  return prisma.user.findMany({
    where: {
      isDeleted: false,
      OR: [
        { name: contains(q) },
        { email: contains(q) },
        { phone: contains(q) },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: LIMIT_PER_TYPE,
  });
};

const searchCars = async (q) => {
  return prisma.car.findMany({
    where: {
      isDeleted: false,
      OR: [
        { registrationNumber: contains(q) },
        { vin: contains(q) },
        { brand: contains(q) },
        { model: contains(q) },
        { variant: contains(q) },
      ],
    },
    select: {
      id: true,
      registrationNumber: true,
      vin: true,
      brand: true,
      model: true,
      variant: true,
      status: true,
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: LIMIT_PER_TYPE,
  });
};

const searchBookings = async (q) => {
  return prisma.booking.findMany({
    where: {
      OR: [
        { bookingNumber: contains(q) },
        {
          user: {
            OR: [
              { name: contains(q) },
              { email: contains(q) },
              { phone: contains(q) },
            ],
          },
        },
        {
          car: {
            OR: [
              { registrationNumber: contains(q) },
              { brand: contains(q) },
              { model: contains(q) },
            ],
          },
        },
        {
          vendor: {
            OR: [
              { vendorCode: contains(q) },
              { companyName: contains(q) },
            ],
          },
        },
      ],
    },
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      paymentStatus: true,
      startAt: true,
      endAt: true,
      totalAmount: true,
      currencyCode: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      car: {
        select: {
          id: true,
          registrationNumber: true,
          brand: true,
          model: true,
        },
      },
      vendor: {
        select: {
          id: true,
          companyName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: LIMIT_PER_TYPE,
  });
};

const searchVendors = async (q) => {
  return prisma.vendor.findMany({
    where: {
      isDeleted: false,
      OR: [
        { vendorCode: contains(q) },
        { companyName: contains(q) },
        { legalName: contains(q) },
        { email: contains(q) },
        { phone: contains(q) },
        { gstin: contains(q) },
        { taxId: contains(q) },
      ],
    },
    select: {
      id: true,
      vendorCode: true,
      companyName: true,
      legalName: true,
      email: true,
      phone: true,
      gstin: true,
      status: true,
      verificationStatus: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: LIMIT_PER_TYPE,
  });
};

const searchBranches = async (q) => {
  return prisma.branch.findMany({
    where: {
      isDeleted: false,
      OR: [
        { name: contains(q) },
        { address: contains(q) },
        { phone: contains(q) },
        { email: contains(q) },
        { city: contains(q) },
      ],
    },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      email: true,
      city: true,
      status: true,
      isOperational: true,
      vendor: {
        select: {
          id: true,
          companyName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: LIMIT_PER_TYPE,
  });
};

const searchPayments = async (q) => {
  return prisma.payment.findMany({
    where: {
      OR: [
        { providerOrderId: contains(q) },
        { providerPaymentId: contains(q) },
        { transactionReference: contains(q) },
        {
          booking: {
            bookingNumber: contains(q),
          },
        },
        {
          user: {
            OR: [
              { name: contains(q) },
              { email: contains(q) },
              { phone: contains(q) },
            ],
          },
        },
      ],
    },
    select: {
      id: true,
      bookingId: true,
      amount: true,
      currencyCode: true,
      paymentMethod: true,
      provider: true,
      providerOrderId: true,
      providerPaymentId: true,
      transactionReference: true,
      status: true,
      operationalStatus: true,
      paidAt: true,
      booking: {
        select: {
          id: true,
          bookingNumber: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: LIMIT_PER_TYPE,
  });
};

const normalize = (data) => ({
  users: data.users.map((item) => ({
    id: item.id,
    type: 'user',
    title: item.name,
    subtitle: item.email || item.phone || 'User',
    status: item.status,
    route: `/users/${item.id}`,
  })),

  cars: data.cars.map((item) => ({
    id: item.id,
    type: 'car',
    title: `${item.brand} ${item.model}`,
    subtitle: [
      item.registrationNumber,
      item.variant,
      item.branch?.name,
    ]
      .filter(Boolean)
      .join(' · '),
    status: item.status,
    route: `/fleet/${item.id}`,
  })),

  bookings: data.bookings.map((item) => ({
    id: item.id,
    type: 'booking',
    title: item.bookingNumber,
    subtitle: [
      item.user?.name,
      item.car
        ? `${item.car.brand} ${item.car.model}`
        : null,
      item.car?.registrationNumber,
    ]
      .filter(Boolean)
      .join(' · '),
    status: item.status,
    paymentStatus: item.paymentStatus,
    route: `/bookings/${item.id}`,
  })),

  vendors: data.vendors.map((item) => ({
    id: item.id,
    type: 'vendor',
    title: item.companyName,
    subtitle: [
      item.vendorCode,
      item.email,
      item.phone,
    ]
      .filter(Boolean)
      .join(' · '),
    status: item.status,
    route: `/vendors/${item.id}`,
  })),

  branches: data.branches.map((item) => ({
    id: item.id,
    type: 'branch',
    title: item.name,
    subtitle: [
      item.city,
      item.vendor?.companyName,
    ]
      .filter(Boolean)
      .join(' · '),
    status: item.status,
    route: `/locations/branches/${item.id}`,
  })),

  payments: data.payments.map((item) => ({
    id: item.id,
    type: 'payment',
    title: item.providerPaymentId || item.providerOrderId || item.id,
    subtitle: [
      item.booking?.bookingNumber,
      item.user?.name,
      item.transactionReference,
    ]
      .filter(Boolean)
      .join(' · '),
    status: item.status,
    amount: item.amount,
    currencyCode: item.currencyCode,
    route: `/payments/admin/${item.id}`,
  })),
});

const SearchService = {
  async globalSearch(query) {
    const q = String(query || '').trim();

    if (q.length < 2) {
      return {
        query: q,
        total: 0,
        results: {
          users: [],
          cars: [],
          bookings: [],
          vendors: [],
          branches: [],
          payments: [],
        },
      };
    }

    const [
      users,
      cars,
      bookings,
      vendors,
      branches,
      payments,
    ] = await Promise.all([
      searchUsers(q),
      searchCars(q),
      searchBookings(q),
      searchVendors(q),
      searchBranches(q),
      searchPayments(q),
    ]);

    const results = normalize({
      users,
      cars,
      bookings,
      vendors,
      branches,
      payments,
    });

    const total = Object.values(results).reduce(
      (count, items) => count + items.length,
      0,
    );

    return {
      query: q,
      total,
      results,
    };
  },
};

module.exports = { SearchService };

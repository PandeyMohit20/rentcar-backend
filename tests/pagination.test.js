'use strict';

const {
  parsePagination,
  buildMeta,
  computeTotalPages,
  MAX_LIMIT,
} = require('../src/utils/pagination');

describe('Pagination utils', () => {
  describe('parsePagination', () => {
    it('returns defaults when no query provided', () => {
      const result = parsePagination({});
      expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
    });

    it('parses page and limit', () => {
      const result = parsePagination({ page: '3', limit: '10' });
      expect(result).toEqual({ page: 3, limit: 10, offset: 20 });
    });

    it('caps limit at MAX_LIMIT', () => {
      const result = parsePagination({ page: '1', limit: '500' });
      expect(result.limit).toBe(MAX_LIMIT);
    });

    it('falls back to defaults for invalid values', () => {
      const result = parsePagination({ page: 'abc', limit: '-5' });
      expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
    });
  });

  describe('computeTotalPages', () => {
    it('returns 0 when total is 0', () => {
      expect(computeTotalPages(0, 20)).toBe(0);
    });

    it('computes correct total pages', () => {
      expect(computeTotalPages(50, 20)).toBe(3);
      expect(computeTotalPages(40, 20)).toBe(2);
    });
  });

  describe('buildMeta', () => {
    it('builds standard metadata', () => {
      expect(buildMeta({ page: 1, limit: 20, total: 5, totalPages: 1 })).toEqual({
        page: 1,
        limit: 20,
        total: 5,
        totalPages: 1,
      });
    });
  });
});

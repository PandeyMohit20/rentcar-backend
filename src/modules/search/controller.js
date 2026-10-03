'use strict';

const { SearchService } = require('./service');

const SearchController = {
  async globalSearch(req, res, next) {
    try {
      const result = await SearchService.globalSearch(req.query.q);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = { SearchController };

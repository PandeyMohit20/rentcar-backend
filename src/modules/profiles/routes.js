'use strict';

const { Router } = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { ProfileController } = require('./controller');
const { updateProfileSchema } = require('./validator');

const router = Router();

router.get('/me', authenticate, ProfileController.getOwnProfile);
router.patch(
  '/me',
  authenticate,
  validate({ body: updateProfileSchema }),
  ProfileController.updateOwnProfile,
);

module.exports = { profilesRouter: router };

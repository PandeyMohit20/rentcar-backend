'use strict';

const express = require('express');
const { createApp } = require('./src/app');

const app = express();
app.use(createApp());

module.exports = app;

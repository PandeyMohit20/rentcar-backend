'use strict';
const {Router}=require('express');const {validate}=require('../../middlewares/validate');const c=require('./controller');const v=require('./validator');const router=Router();router.get('/featured',validate({query:v.list}),c.featured);router.get('/search',validate({query:v.list}),c.search);router.get('/:carId',validate({params:v.id}),c.getPublic);module.exports={carsRouter:router};

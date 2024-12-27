import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import apiSpec from '../swagger-doc.json';

import * as UserController from './controllers/user';
import * as AuthController from './controllers/auth';

export const router = Router();

// Auth routes
router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.post('/request-verification', AuthController.requestVerification);
router.post('/verify-code', AuthController.verifyCode);
router.post('/resend-code', AuthController.resendCode);

// User routes
router.get('/user/all', UserController.all);


if (process.env.NODE_ENV === 'development') {
  router.use('/dev/api-docs', swaggerUi.serve);
  router.get('/dev/api-docs', swaggerUi.setup(apiSpec));
}

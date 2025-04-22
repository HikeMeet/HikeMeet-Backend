import createError from 'http-errors';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import './utils/cronJobs';
console.log('✅ Backend booting...');

dotenv.config({ path: path.join(__dirname, `../.env`) });
const env = process.env.NODE_ENV || 'local';

dotenv.config({ path: path.join(__dirname, `../.env.${env}`) });

console.log(`Running in '${process.env.NODE_ENV}' enviroment`);

import { handleError } from './helpers/error';
import httpLogger from './middlewares/httpLogger';
import registerRouter from './routes/userRouter';
import healthRouter from './routes/index';
import authRoutes from './routes/authRoutes';
import searchRoutes from './routes/searchRoutes';
import friendsRoutes from './routes/friendsRoutes';
import adminRoutes from './routes/admin';
import notificationsRoutes from './routes/notificationsRoutes';

import './firebaseAdmin';
import tripRoutes from './routes/tripRoutes';
import groupRoutes from './routes/groupRoutes';
import postRouts from './routes/postRouts';
import cloudinaryRouts from './routes/cloudinaryRouts';
import { v2 as cloudinary } from 'cloudinary';

const app: express.Application = express();
const allowedOrigins = ['http://localhost:3000', 'http://10.100.102.172:3000', 'http://10.100.102.172:5000'];

const mongoURI: string = process.env.MONGO_URI || 'mongodb://localhost:27017/Hikemeet';

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

mongoose
  .connect(mongoURI)
  .then(() => {
    console.info(`Connected to MongoDB`);
    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || !allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS' + origin));
          }
        },
      }),
    );
    app.use(httpLogger);
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());

    // Routes
    app.use('/api/', healthRouter);
    app.use('/api/user', registerRouter);
    app.use('/api/auth', authRoutes);
    app.use('/api/search', searchRoutes); //search all users
    app.use('/api/friend', friendsRoutes); //action on users (check status, add, remove, cancel request)
    app.use('/api/admin', adminRoutes); //action on users (check status, add, remove, cancel request)
    app.use('/api/trips', tripRoutes); //action on users (check status, add, remove, cancel request)
    app.use('/api/group', groupRoutes); //action on users (check status, add, remove, cancel request)
    app.use('/api/post', postRouts); //action on users (check status, add, remove, cancel request)
    app.use('/api/cloudinary', cloudinaryRouts); //action on users (check status, add, remove, cancel request)
    app.use('/api/notification', notificationsRoutes);

    // catch 404 and forward to error handler
    app.use((_req, _res, next) => {
      next(createError(404));
    });

    // error handler
    const errorHandler: express.ErrorRequestHandler = (err, _req, res) => {
      handleError(err, res);
    };
    app.use(errorHandler);

    // Server Setup
    const port = parseInt(process.env.PORT || '3000', 10);
    app.set('port', port);

    const server = http.createServer(app);

    function onError(error: { syscall: string; code: string }) {
      if (error.syscall !== 'listen') {
        throw error;
      }

      // handle specific listen errors with friendly messages
      switch (error.code) {
        case 'EACCES':
          process.exit(1);
          break;
        case 'EADDRINUSE':
          process.exit(1);
          break;
        default:
          throw error;
      }
    }

    function onListening() {
      const addr = server.address();
      const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr?.port}`;
      console.info(`Server is listening on ${bind}`);
    }

    app.listen(port, '0.0.0.0', () => {
      console.log('Server is running on http://0.0.0.0:3000');
    });
    server.on('error', onError);
    server.on('listening', onListening);
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err.message);
    process.exit(1); // Exit the process if unable to connect
  });

// import { User } from './models/User';
// import { Notification } from './models/Notification';
// async function clearAllNotifications() {
//   try {
//     // 2) Delete all Notification documents
//     const delRes = await Notification.deleteMany({});
//     console.log(`🗑️  Deleted ${delRes.deletedCount} notifications`);

//     // 3) Reset every user's unreadNotifications counter to 0
//     const updateRes = await User.updateMany({}, { $set: { unreadNotifications: 0 } });
//     // depending on your Mongoose version the result field may be modifiedCount
//     const modified = (updateRes as any).modifiedCount ?? (updateRes as any).nModified;
//     console.log(`✅ Updated ${modified} users' unreadNotifications to 0`);
//   } catch (err) {
//     console.error('❌ Error clearing notifications:', err);
//   }
// }

// clearAllNotifications();

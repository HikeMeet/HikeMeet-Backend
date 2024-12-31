import createError from 'http-errors';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import http from 'http';

dotenv.config({ path: path.join(__dirname, '../.env') });
import { handleError } from './helpers/error';
import httpLogger from './middlewares/httpLogger';
import registerRouter from './routes/userRouter';
import healthRouter from './routes/index';
import mongoose from 'mongoose';
import cors from 'cors';

const app: express.Application = express();

const mongoURI: string = process.env.MONGO_URI_STAGE || 'mongodb://localhost:27017/mydatabase';
mongoose
  .connect(mongoURI)
  .then(() => {
    console.info(`Connected to MongoDB`);

    app.use(httpLogger);
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(cors());
    app.use('/api/', healthRouter);
    app.use('/api/user', registerRouter);

    // catch 404 and forward to error handler
    app.use((_req, _res, next) => {
      next(createError(404));
    });

    // error handler
    const errorHandler: express.ErrorRequestHandler = (err, _req, res) => {
      handleError(err, res);
    };
    app.use(errorHandler);

    const port = process.env.PORT || '8000';
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

    app.listen(3000, '0.0.0.0', () => {
      console.log('Server is running on http://0.0.0.0:3000');
    });
    server.on('error', onError);
    server.on('listening', onListening);
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err.message);
    process.exit(1); // Exit the process if unable to connect
  });

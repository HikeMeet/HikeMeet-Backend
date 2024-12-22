/* eslint-disable import/first */
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables
const result = dotenv.config();
if (result.error) {
  dotenv.config({ path: '.env' });
}

import { app } from './app';
import MongoConnection from './mongo-connection';
import { logger } from './logger';

// Enable CORS
const corsOptions = {
  origin: '*', // התאם את זה לכתובת ה-Frontend במידת הצורך
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions)); // שימוש ב-CORS עם הגדרות מותאמות אישית

// Initialize MongoDB connection
const mongoConnection = new MongoConnection(process.env.MONGO_URL);

if (!process.env.MONGO_URL) {
  logger.log({
    level: 'error',
    message: 'MONGO_URL not specified in environment'
  });
  process.exit(1); // Exit if MongoDB URL is not specified
} else {
  mongoConnection.connect(() => {
    app.listen(app.get('port'), () => {
      console.log(
        '\x1b[36m%s\x1b[0m',
        `🌏 Express server started at http://localhost:${app.get('port')}`
      );
    });

    app.listen(app.get('port'), '0.0.0.0', () => {
      console.log(`🌍 Server running on port ${app.get('port')} for external access`);
    });
  });
}

// Close the Mongoose connection, when receiving SIGINT
process.on('SIGINT', () => {
  logger.info('Gracefully shutting down');
  mongoConnection.close(err => {
    if (err) {
      logger.log({
        level: 'error',
        message: 'Error closing MongoDB connection',
        error: err
      });
    }
    process.exit(0); // Exit process after shutting down
  });
});

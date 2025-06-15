// middleware/authenticate.ts
import { Request, Response, NextFunction } from 'express';
import admin from '../firebaseAdmin'; // adjust path to your Firebase admin init

// Extend Express Request to include authenticated user info
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      uid: string;
      email?: string;
    };
  }
}

// Middleware to authenticate requests
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization') || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const idToken = match[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    return next();
  } catch (error: any) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

import { Request, Response, NextFunction } from 'express';
import { client } from '../db';
import { validateJWT } from './ssoAuth';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

// Set RLS context for all authenticated requests
const setRLSContext = async (userId: string) => {
  // Validate UUID format to prevent injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error('Invalid user ID format');
  }
  await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
};

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      await new Promise<void>((resolve, reject) => {
        validateJWT(req, res, (error?: any) => {
          error ? reject(error) : resolve();
        });
      });
      if (req.userId) {
        await setRLSContext(req.userId);
        return next();
      }
    }
    
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    req.userId = req.session.userId;
    await setRLSContext(req.userId);
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
}

function sessionAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Deprecated - kept for compatibility
}

export function getCurrentUserId(req: Request): string {
  // This should only be called after requireAuth middleware
  // which ensures userId exists
  if (!req.session.userId) {
    throw new Error('User ID not found in session');
  }
  return req.session.userId;
}

export { AuthenticatedRequest };

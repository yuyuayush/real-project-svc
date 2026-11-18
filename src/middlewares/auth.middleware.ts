import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { AuthCookie } from '../constants/index.js';
import { UserPublicProfile } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserPublicProfile;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token =
    req.cookies?.[AuthCookie.NAME] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : '');

  if (!token) {
    return next(new UnauthorizedError('Authentication required. Please sign in.'));
  }

  try {
    const user = await authService.verifySession(token);
    if (!user) {
      return next(new UnauthorizedError('Invalid or expired authentication session.'));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

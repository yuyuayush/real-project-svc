import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { validateSchema } from '../utils/validator.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { env } from '../config/env.js';
import { AuthCookie } from '../constants/index.js';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

export const AUTH_COOKIE_NAME = AuthCookie.NAME;

export class AuthController {
  static login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validatedInput = validateSchema(loginSchema, req.body);
    const session = await authService.login(validatedInput);

    const maxAgeMs = validatedInput.rememberMe
      ? 30 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

    // Set secure HTTP-only cookie on the response
    res.cookie(AUTH_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: maxAgeMs,
      path: '/',
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: session,
    });
  });

  static logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const token =
      req.cookies?.[AUTH_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : '');

    if (token) {
      await authService.logout(token);
    }

    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  });

  static me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const token =
      req.cookies?.[AUTH_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : '');

    if (!token) {
      throw new UnauthorizedError('Authentication session not found or expired');
    }

    const user = await authService.verifySession(token);
    if (!user) {
      throw new UnauthorizedError('Session expired or invalid. Please log in again.');
    }

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  });
}

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { type AsyncRequestHandler } from '../types/index.js';

export type { AsyncRequestHandler };

/**
 * Higher-order utility function wrapping async Express route handlers.
 * Catches rejected promises and forwards errors to the global error middleware (next(err)).
 * Eliminates repetitive try-catch blocks across all controllers.
 */
export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;

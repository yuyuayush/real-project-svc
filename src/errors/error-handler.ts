import { Request, Response, NextFunction } from 'express';
import { AppError } from './app-error.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn(
      {
        path: req.path,
        method: req.method,
        statusCode: err.statusCode,
        message: err.message,
        details: err.details,
      },
      'Operational request error'
    );

    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Unexpected internal bugs
  logger.error(
    {
      path: req.path,
      method: req.method,
      stack: err.stack,
      err,
    },
    ' Unhandled Server Error'
  );

  res.status(500).json({
    success: false,
    error: {
      message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}

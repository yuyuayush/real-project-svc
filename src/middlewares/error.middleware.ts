import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '../errors/app-error.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

interface ErrorResponsePayload {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
  requestId?: string;
  timestamp: string;
}

/**
 * 404 Catch-All Route Not Found Middleware
 * Forwards a clean NotFoundError for any unhandled routes.
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  next(new NotFoundError(`Endpoint '${req.method} ${req.originalUrl}' not found`));
}

/**
 * Global Error Handling Middleware
 * Centralizes all error formatting, logging, and status codes across the application.
 */
export function globalErrorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const requestId = (req as Request & { id?: string }).id || (res.getHeader('x-request-id') as string) || undefined;
  const isProduction = env.NODE_ENV === 'production';

  // -------------------------------------------------------------
  // 1. Custom Application / Operational Errors (AppError subclasses)
  // -------------------------------------------------------------
  if (err instanceof AppError) {
    logger.warn(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: err.statusCode,
        message: err.message,
        details: err.details,
      },
      `⚠️ Operational Error [HTTP ${err.statusCode}]: ${err.message}`
    );

    const errorCode = err.constructor.name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();

    const payload: ErrorResponsePayload = {
      success: false,
      error: {
        code: errorCode || 'APP_ERROR',
        message: err.message,
        details: err.details,
        ...(!isProduction && { stack: err.stack }),
      },
      requestId,
      timestamp: new Date().toISOString(),
    };

    res.status(err.statusCode).json(payload);
    return;
  }

  // -------------------------------------------------------------
  // 2. Unhandled Zod Validation Errors
  // -------------------------------------------------------------
  if (err instanceof ZodError) {
    const formattedIssues = err.errors.map((issue) => ({
      field: issue.path.join('.') || 'root',
      message: issue.message,
      code: issue.code,
    }));

    logger.warn(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        issues: formattedIssues,
      },
      '⚠️ Zod Schema Validation Failed'
    );

    const payload: ErrorResponsePayload = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed',
        details: formattedIssues,
        ...(!isProduction && { stack: err.stack }),
      },
      requestId,
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(payload);
    return;
  }

  // -------------------------------------------------------------
  // 3. Malformed JSON Body Parser Syntax Error
  // -------------------------------------------------------------
  if (err instanceof SyntaxError && 'body' in err && (err as unknown as { status?: number }).status === 400) {
    logger.warn(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        message: err.message,
      },
      '⚠️ Malformed JSON in Request Body'
    );

    const payload: ErrorResponsePayload = {
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body',
        details: err.message,
      },
      requestId,
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(payload);
    return;
  }

  // -------------------------------------------------------------
  // 4. Mongoose / MongoDB Database Errors
  // -------------------------------------------------------------
  const mongoError = err as unknown as { name?: string; code?: number; path?: string; value?: unknown; keyValue?: Record<string, unknown> };

  // 4a. Mongoose CastError (e.g. Invalid UUID or ObjectId format)
  if (mongoError.name === 'CastError') {
    const message = `Invalid format for field '${mongoError.path}': ${String(mongoError.value)}`;
    logger.warn({ requestId, path: req.originalUrl, message }, '⚠️ MongoDB CastError');

    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID_FORMAT',
        message,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 4b. MongoDB Duplicate Key (E11000)
  if (mongoError.code === 11000) {
    const duplicateFields = Object.keys(mongoError.keyValue || {}).join(', ') || 'field';
    const message = `A record with this ${duplicateFields} already exists`;
    logger.warn({ requestId, path: req.originalUrl, keyValue: mongoError.keyValue }, '⚠️ MongoDB Duplicate Key Error');

    res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT_DUPLICATE_KEY',
        message,
        details: mongoError.keyValue,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // -------------------------------------------------------------
  // 5. Stripe Gateway Errors
  // -------------------------------------------------------------
  const stripeError = err as unknown as { type?: string; statusCode?: number; raw?: { message?: string; decline_code?: string; code?: string } };
  if (stripeError.type?.startsWith('Stripe') || err.name?.startsWith('Stripe')) {
    const statusCode = stripeError.statusCode || 402;
    const stripeMessage = stripeError.raw?.message || err.message || 'Payment processing gateway error';

    logger.error(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode,
        stripeType: stripeError.type,
        declineCode: stripeError.raw?.decline_code,
      },
      `💳 Stripe Gateway Error: ${stripeMessage}`
    );

    res.status(statusCode).json({
      success: false,
      error: {
        code: stripeError.raw?.code || 'STRIPE_GATEWAY_ERROR',
        message: stripeMessage,
        details: stripeError.raw?.decline_code ? { declineCode: stripeError.raw.decline_code } : undefined,
        ...(!isProduction && { stack: err.stack }),
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // -------------------------------------------------------------
  // 6. Uncaught Internal Server Bugs (HTTP 500)
  // -------------------------------------------------------------
  logger.error(
    {
      requestId,
      method: req.method,
      path: req.originalUrl,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack,
    },
    '🔥 Unhandled Internal Server Error'
  );

  const payload: ErrorResponsePayload = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An unexpected internal server error occurred' : err.message,
      ...(!isProduction && { stack: err.stack }),
    },
    requestId,
    timestamp: new Date().toISOString(),
  };

  res.status(500).json(payload);
}

// Export alias for backward compatibility
export const errorHandler = globalErrorHandler;

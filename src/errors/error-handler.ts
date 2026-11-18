/**
 * Re-export error middleware from src/middlewares/error.middleware.ts
 * for backwards compatibility
 */
export {
  globalErrorHandler,
  errorHandler,
  notFoundHandler,
} from '../middlewares/error.middleware.js';

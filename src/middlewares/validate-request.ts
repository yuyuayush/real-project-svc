import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { validateSchema, validateSchemaAsync, type FormattedValidationError } from '../utils/validator.js';

export { validateSchema, validateSchemaAsync };
export type { FormattedValidationError };

/**
 * Route-level middleware for schema validation across body, query, and params.
 */
export function validateRequest(schema: {
  body?: ZodType<unknown>;
  query?: ZodType<unknown>;
  params?: ZodType<unknown>;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await validateSchemaAsync(schema.body, req.body);
      }
      if (schema.query) {
        req.query = (await validateSchemaAsync(schema.query, req.query)) as typeof req.query;
      }
      if (schema.params) {
        req.params = (await validateSchemaAsync(schema.params, req.params)) as typeof req.params;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

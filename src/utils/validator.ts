import { ZodType, ZodError } from 'zod';
import { BadRequestError } from '../errors/app-error.js';
import { type FormattedValidationError } from '../types/index.js';

export type { FormattedValidationError };

/**
 * Validates any payload directly against a Zod schema in-function.
 * Returns the strongly-typed, parsed, and sanitized data.
 * Throws a formatted BadRequestError (HTTP 400) if validation fails.
 *
 * @example
 * const { customer, items } = validateSchema(createCheckoutSchema, req.body);
 */
export function validateSchema<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const formattedErrors: FormattedValidationError[] = result.error.errors.map((e) => ({
      field: e.path.join('.') || 'root',
      message: e.message,
    }));

    throw new BadRequestError('Validation failed', formattedErrors);
  }

  return result.data;
}

/**
 * Asynchronous schema validation for schemas with async refinements or external DB checks.
 */
export async function validateSchemaAsync<T>(schema: ZodType<T>, data: unknown): Promise<T> {
  try {
    return await schema.parseAsync(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const formattedErrors: FormattedValidationError[] = err.errors.map((e) => ({
        field: e.path.join('.') || 'root',
        message: e.message,
      }));

      throw new BadRequestError('Validation failed', formattedErrors);
    }
    throw err;
  }
}

export default validateSchema;

import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from './errors.js';

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler(async (request, reply) => {
    reply.code(404);
    return {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.id,
      },
    };
  });

  app.setErrorHandler(async (error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      reply.code(400);
      return {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.validation.map((issue) => ({
            path: `${error.validationContext}${issue.instancePath.replaceAll('/', '.')}`,
            message: issue.message,
          })),
          requestId: request.id,
        },
      };
    }

    if (error instanceof AppError) {
      reply.code(error.statusCode);
      return {
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
        },
      };
    }

    if (
      error instanceof Error &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode < 500
    ) {
      reply.code(error.statusCode);
      return {
        error: {
          code: 'BAD_REQUEST',
          message: error.message,
          requestId: request.id,
        },
      };
    }

    request.log.error({ err: error }, 'unhandled error');
    reply.code(500);
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: request.id,
      },
    };
  });
}

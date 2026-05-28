import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        if (typeof obj.message === 'string') message = obj.message;
        else if (Array.isArray(obj.message))
          message = (obj.message as string[]).join(', ');
        if (typeof obj.code === 'string') code = obj.code;
        if (obj.details && typeof obj.details === 'object')
          details = obj.details as Record<string, unknown>;
      }
    } else if (exception instanceof Error) {
      message =
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : exception.message;
    }

    if (
      process.env.NODE_ENV === 'production' &&
      status === HttpStatus.INTERNAL_SERVER_ERROR
    ) {
      message = 'An unexpected error occurred';
    }

    if (status === HttpStatus.BAD_REQUEST)
      code = code === 'INTERNAL_SERVER_ERROR' ? 'VALIDATION_ERROR' : code;
    if (status === HttpStatus.UNAUTHORIZED) code = 'UNAUTHENTICATED';
    if (status === HttpStatus.FORBIDDEN) code = 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) code = 'NOT_FOUND';
    if (status === HttpStatus.CONFLICT) code = 'CONFLICT';
    if (status === HttpStatus.TOO_MANY_REQUESTS) code = 'RATE_LIMITED';

    const errorBody: {
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
    } = {
      error: { code, message },
    };
    if (details) errorBody.error.details = details;

    response.status(status).json(errorBody);
  }
}

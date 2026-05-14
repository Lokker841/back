import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request, Response } from 'express';
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpErrorsTotal,
} from '../../metrics/metrics';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, url } = req;

    // Нормализуем маршрут: /api/v1/catalog/abc123 → /api/v1/catalog/:id
    const route = this.normalizeRoute(url);
    const startHrTime = process.hrtime();

    const recordMetrics = (statusCode: number) => {
      const [sec, ns] = process.hrtime(startHrTime);
      const durationSeconds = sec + ns / 1e9;
      const labels = { method, route, status_code: String(statusCode) };

      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSeconds);

      if (statusCode >= 400) {
        httpErrorsTotal.inc(labels);
      }

      // Структурированный JSON-лог — Filebeat подберёт и отправит в Elasticsearch
      this.logger.log(
        JSON.stringify({
          method,
          url,
          route,
          status_code: statusCode,
          duration_ms: Math.round(durationSeconds * 1000),
        }),
      );
    };

    return next.handle().pipe(
      tap(() => recordMetrics(res.statusCode)),
      catchError((err: unknown) => {
        const statusCode =
          (err as { status?: number })?.status ??
          (err as { statusCode?: number })?.statusCode ??
          500;
        recordMetrics(statusCode);
        return throwError(() => err);
      }),
    );
  }

  private normalizeRoute(url: string): string {
    return url
      .split('?')[0]
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }
}

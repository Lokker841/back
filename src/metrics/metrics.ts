import { Counter, Histogram, collectDefaultMetrics, Registry } from 'prom-client';

// Единый реестр метрик для всего приложения
export const metricsRegistry = new Registry();

// Системные метрики Node.js: CPU, память, event loop lag, GC и т.д.
collectDefaultMetrics({ register: metricsRegistry, prefix: 'sportgid_' });

// Счётчик HTTP-запросов по методу, маршруту и статус-коду
export const httpRequestsTotal = new Counter({
  name: 'sportgid_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

// Гистограмма времени ответа (в секундах) — позволяет считать p50/p95/p99
export const httpRequestDurationSeconds = new Histogram({
  name: 'sportgid_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

// Счётчик ошибок (4xx / 5xx) отдельно — удобно для алертов
export const httpErrorsTotal = new Counter({
  name: 'sportgid_http_errors_total',
  help: 'Total number of HTTP errors (4xx and 5xx)',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

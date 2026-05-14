'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Database, FileText, BarChart2,
  ExternalLink, CheckCircle, XCircle, Loader2, RefreshCw,
  Zap, AlertTriangle, Clock, Server, Cpu,
} from 'lucide-react';

const GRAFANA_URL    = process.env.NEXT_PUBLIC_GRAFANA_URL    ?? 'http://localhost:3002';
const KIBANA_URL     = process.env.NEXT_PUBLIC_KIBANA_URL     ?? 'http://localhost:5601';
const PROMETHEUS_URL = process.env.NEXT_PUBLIC_PROMETHEUS_URL ?? 'http://localhost:9090';
const API_URL        = process.env.NEXT_PUBLIC_API_URL        ?? 'http://localhost:3000/api/v1';

type ServiceStatus = 'checking' | 'up' | 'down';

interface MetricsSummary {
  rps: number;
  errorRate: number;
  p95Ms: number | null;
  heapUsedMb: number | null;
  heapTotalMb: number | null;
  cpuPercent: number | null;
  totalRequests: number | null;
  totalErrors: number | null;
  charts: {
    rps: { t: number; v: number }[];
    errRate: { t: number; v: number }[];
  };
}

const SERVICES = [
  { key: 'api',        name: 'Backend API', url: `${API_URL}/docs`.replace('/api/v1', '') + '/api/docs', icon: Activity,  description: 'NestJS · :3000' },
  { key: 'grafana',    name: 'Grafana',     url: `${GRAFANA_URL}/d/sportgid-main`,                               icon: BarChart2, description: 'Дашборды · :3002' },
  { key: 'prometheus', name: 'Prometheus',  url: `${PROMETHEUS_URL}/targets`,                                    icon: Database,  description: 'Метрики · :9090' },
  { key: 'kibana',     name: 'Kibana',      url: `${KIBANA_URL}/app/discover#/?_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-1h,to:now))`, icon: FileText,  description: 'Логи · :5601' },
];

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === 'checking') return <Loader2 size={14} className="animate-spin text-gray-400" />;
  if (status === 'up') return <CheckCircle size={14} className="text-green-500" />;
  return <XCircle size={14} className="text-red-500" />;
}

function MiniSparkline({ data }: { data: { t: number; v: number }[] }) {
  if (!data.length) return <div className="h-8 flex items-center text-xs text-gray-400">нет данных</div>;
  const max = Math.max(...data.map((d) => d.v), 0.001);
  return (
    <svg viewBox={`0 0 ${data.length} 32`} className="w-full h-8" preserveAspectRatio="none">
      <polyline
        points={data.map((d, i) => `${i},${32 - (d.v / max) * 30}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-blue-500"
      />
    </svg>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'blue',
  warn = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  warn?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    orange: 'text-orange-600 bg-orange-50',
    red: 'text-red-600 bg-red-50',
    purple: 'text-purple-600 bg-purple-50',
  };
  const chosen = warn ? colors.red : colors[color] ?? colors.blue;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${chosen}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function MonitoringPage() {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>(
    Object.fromEntries(SERVICES.map((s) => [s.key, 'checking' as ServiceStatus])),
  );
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(() => {
    setStatuses(Object.fromEntries(SERVICES.map((s) => [s.key, 'checking' as ServiceStatus])));
    fetch('/api/health')
      .then((r) => r.json())
      .then((data: Record<string, boolean>) => {
        setStatuses(Object.fromEntries(Object.entries(data).map(([k, up]) => [k, up ? 'up' : 'down'])));
        setLastChecked(new Date());
      })
      .catch(() => {
        setStatuses(Object.fromEntries(SERVICES.map((s) => [s.key, 'down' as ServiceStatus])));
      });
  }, []);

  const fetchMetrics = useCallback(() => {
    setMetricsLoading(true);
    fetch('/api/metrics')
      .then((r) => r.json())
      .then((data: MetricsSummary) => setMetrics(data))
      .catch(() => setMetrics(null))
      .finally(() => setMetricsLoading(false));
  }, []);

  useEffect(() => {
    checkHealth();
    fetchMetrics();
    const hi = setInterval(checkHealth, 30_000);
    const mi = setInterval(fetchMetrics, 15_000);
    return () => { clearInterval(hi); clearInterval(mi); };
  }, [checkHealth, fetchMetrics]);

  const grafanaStatus = statuses['grafana'];
  const apiStatus     = statuses['api'];

  const fmt = (n: number | null, unit = '', decimals = 1) =>
    n == null ? '—' : `${n.toFixed(decimals)}${unit}`;

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мониторинг</h1>
          <p className="text-sm text-gray-500 mt-1">
            Prometheus · Grafana · ELK Stack
            {lastChecked && (
              <span className="ml-2 text-gray-400">· {lastChecked.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => { checkHealth(); fetchMetrics(); }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} />
          Обновить
        </button>
      </div>

      {/* Статус сервисов */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          const status = statuses[service.key];
          return (
            <div
              key={service.key}
              className={`bg-white rounded-xl border p-4 flex flex-col gap-2 transition-colors ${
                status === 'up' ? 'border-green-200' : status === 'down' ? 'border-red-200' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={16} className="text-gray-500" />
                  <span className="font-medium text-gray-800 text-sm">{service.name}</span>
                </div>
                <StatusBadge status={status} />
              </div>
              <p className="text-xs text-gray-400">{service.description}</p>
              <a href={service.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-auto">
                Открыть <ExternalLink size={10} />
              </a>
            </div>
          );
        })}
      </div>

      {/* Живые метрики */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold text-gray-800">Метрики в реальном времени</h2>
          {metricsLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
          {!metricsLoading && apiStatus === 'down' && (
            <span className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle size={12} /> Бэкенд недоступен
            </span>
          )}
        </div>

        {metrics ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                icon={Zap}
                label="Запросы / сек (RPS)"
                value={fmt(metrics.rps, '', 2)}
                sub="за последнюю минуту"
                color="blue"
              />
              <MetricCard
                icon={AlertTriangle}
                label="Error Rate"
                value={metrics.errorRate > 0 ? `${(metrics.errorRate * 100).toFixed(1)}%` : '0%'}
                sub={`${metrics.totalErrors ?? 0} ошибок всего`}
                color="orange"
                warn={metrics.errorRate > 0.05}
              />
              <MetricCard
                icon={Clock}
                label="Latency p95"
                value={metrics.p95Ms != null ? `${metrics.p95Ms} мс` : '—'}
                sub="95-й процентиль"
                color="purple"
                warn={(metrics.p95Ms ?? 0) > 1000}
              />
              <MetricCard
                icon={Activity}
                label="Запросов всего"
                value={metrics.totalRequests != null ? metrics.totalRequests.toLocaleString() : '—'}
                sub="с момента старта"
                color="green"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 mt-3">
              <MetricCard
                icon={Server}
                label="Heap Used"
                value={metrics.heapUsedMb != null ? `${metrics.heapUsedMb} МБ` : '—'}
                sub={metrics.heapTotalMb != null ? `из ${metrics.heapTotalMb} МБ` : undefined}
                color="blue"
                warn={(metrics.heapUsedMb ?? 0) > 400}
              />
              <MetricCard
                icon={Cpu}
                label="CPU (user)"
                value={metrics.cpuPercent != null ? `${metrics.cpuPercent}%` : '—'}
                sub="нагрузка за последнюю мин"
                color="orange"
                warn={(metrics.cpuPercent ?? 0) > 80}
              />
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">RPS — последние 30 мин</p>
                <MiniSparkline data={metrics.charts.rps} />
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center gap-2 text-gray-400">
            {metricsLoading ? (
              <><Loader2 size={20} className="animate-spin" /><span className="text-sm">Загружаю метрики...</span></>
            ) : (
              <><AlertTriangle size={20} className="text-orange-400" /><span className="text-sm">Метрики недоступны — Prometheus не запущен или нет данных</span></>
            )}
          </div>
        )}
      </div>

      {/* Grafana iframe */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-800">Grafana Dashboard</span>
          <a href={`${GRAFANA_URL}/d/sportgid-main`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            Открыть в новой вкладке <ExternalLink size={13} />
          </a>
        </div>
        {grafanaStatus === 'checking' ? (
          <div className="flex items-center justify-center h-48 text-gray-400 gap-2">
            <Loader2 size={20} className="animate-spin" /><span>Проверяю Grafana...</span>
          </div>
        ) : grafanaStatus === 'up' ? (
          <iframe
            src={`${GRAFANA_URL}/d/sportgid-main?orgId=1&kiosk=tv&refresh=30s&theme=light`}
            className="w-full"
            style={{ height: 600, border: 'none' }}
            title="Grafana Dashboard"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <XCircle size={22} className="text-red-400" />
            <span>Grafana недоступна</span>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">docker compose up -d</code>
          </div>
        )}
      </div>

      {/* Быстрые ссылки */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-800 mb-3">Быстрые ссылки</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Метрики (raw)',      href: `http://localhost:3000/api/v1/metrics` },
            { label: 'Swagger API',         href: `http://localhost:3000/api/docs` },
            { label: 'Prometheus Targets',  href: `${PROMETHEUS_URL}/targets` },
            { label: 'Kibana Discover',     href: `${KIBANA_URL}/app/discover` },
            { label: 'Grafana Dashboards',  href: `${GRAFANA_URL}/dashboards` },
          ].map(({ label, href }) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors">
              {label} <ExternalLink size={12} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

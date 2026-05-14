import { NextRequest, NextResponse } from 'next/server';

const PROMETHEUS_URL = process.env.NEXT_PUBLIC_PROMETHEUS_URL ?? 'http://localhost:9090';

async function query(expr: string): Promise<number | null> {
  try {
    const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(expr)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.data?.result;
    if (!result?.length) return null;
    return parseFloat(result[0].value[1]);
  } catch {
    return null;
  }
}

async function queryRange(expr: string, minutes = 30): Promise<{ t: number; v: number }[]> {
  try {
    const end = Math.floor(Date.now() / 1000);
    const start = end - minutes * 60;
    const url = `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(expr)}&start=${start}&end=${end}&step=60`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.data?.result;
    if (!result?.length) return [];
    return (result[0].values as [number, string][]).map(([t, v]) => ({ t, v: parseFloat(v) }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type') ?? 'summary';

  if (type === 'range') {
    const expr = searchParams.get('expr') ?? '';
    const minutes = parseInt(searchParams.get('minutes') ?? '30', 10);
    const data = await queryRange(expr, minutes);
    return NextResponse.json(data);
  }

  // Summary: все ключевые метрики
  const [
    rps,
    errorRate,
    p95,
    heapUsed,
    heapTotal,
    cpuUser,
    totalRequests,
    totalErrors,
  ] = await Promise.all([
    query('rate(sportgid_http_requests_total[1m])'),
    query('rate(sportgid_http_errors_total[1m]) / rate(sportgid_http_requests_total[1m])'),
    query('histogram_quantile(0.95, rate(sportgid_http_request_duration_seconds_bucket[5m]))'),
    query('sportgid_nodejs_heap_size_used_bytes'),
    query('sportgid_nodejs_heap_size_total_bytes'),
    query('rate(sportgid_process_cpu_user_seconds_total[1m])'),
    query('sum(sportgid_http_requests_total)'),
    query('sum(sportgid_http_errors_total)'),
  ]);

  const rpsRange     = await queryRange('sum(rate(sportgid_http_requests_total[1m]))', 30);
  const errRateRange = await queryRange(
    'sum(rate(sportgid_http_errors_total[1m])) / sum(rate(sportgid_http_requests_total[1m]))',
    30,
  );

  return NextResponse.json({
    rps:           rps ?? 0,
    errorRate:     Number.isFinite(errorRate ?? 0) ? (errorRate ?? 0) : 0,
    p95Ms:         p95 != null ? Math.round(p95 * 1000) : null,
    heapUsedMb:    heapUsed != null ? Math.round(heapUsed / 1024 / 1024) : null,
    heapTotalMb:   heapTotal != null ? Math.round(heapTotal / 1024 / 1024) : null,
    cpuPercent:    cpuUser != null ? Math.round(cpuUser * 100) : null,
    totalRequests: totalRequests != null ? Math.round(totalRequests) : null,
    totalErrors:   totalErrors != null ? Math.round(totalErrors) : null,
    charts: {
      rps:     rpsRange,
      errRate: errRateRange,
    },
  });
}

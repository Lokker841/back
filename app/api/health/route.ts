import { NextResponse } from 'next/server';

const SERVICES = {
  api: {
    url: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
    path: '/catalog',
  },
  grafana: {
    url: process.env.NEXT_PUBLIC_GRAFANA_URL ?? 'http://localhost:3002',
    path: '/api/health',
  },
  prometheus: {
    url: process.env.NEXT_PUBLIC_PROMETHEUS_URL ?? 'http://localhost:9090',
    path: '/-/healthy',
  },
  kibana: {
    url: process.env.NEXT_PUBLIC_KIBANA_URL ?? 'http://localhost:5601',
    path: '/api/status',
  },
};

async function checkService(url: string, path: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}${path}`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const results = await Promise.allSettled(
    Object.entries(SERVICES).map(async ([key, { url, path }]) => ({
      key,
      up: await checkService(url, path),
    })),
  );

  const statuses = Object.fromEntries(
    results.map((r) =>
      r.status === 'fulfilled' ? [r.value.key, r.value.up] : ['unknown', false],
    ),
  );

  return NextResponse.json(statuses);
}

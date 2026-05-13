'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, TrendingUp, AlertCircle } from 'lucide-react';
import { adminApi, DISTRICT_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.stats,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 flex items-center gap-3 text-red-600">
        <AlertCircle size={20} />
        <span>Не удалось загрузить статистику. Убедитесь, что бэкенд запущен.</span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
        <p className="text-gray-500 text-sm mt-1">Общая статистика реестра</p>
      </div>

      {/* Главные метрики */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Всего объектов"
          value={stats.totalObjects}
          icon={<Building2 size={22} />}
        />
        <StatCard
          title="Всего площадок"
          value={stats.totalAreas}
          icon={<MapPin size={22} />}
        />
        <StatCard
          title="Видов спорта"
          value={stats.topSports.length}
          icon={<TrendingUp size={22} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Статусы объектов */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">По статусу</h2>
          <div className="space-y-3">
            {stats.byStatus.map(({ status, count }) => (
              <div key={status} className="flex items-center justify-between">
                <Badge className={STATUS_COLORS[status]}>
                  {STATUS_LABELS[status]}
                </Badge>
                <span className="text-sm font-semibold text-gray-800">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* По районам */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">По районам</h2>
          <div className="space-y-2">
            {stats.byDistrict.map(({ district, count }) => (
              <div key={district} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {DISTRICT_LABELS[district]}
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 bg-blue-400 rounded-full"
                    style={{
                      width: `${Math.max(8, (count / stats.totalObjects) * 80)}px`,
                    }}
                  />
                  <span className="text-sm font-medium text-gray-800 w-4 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Топ видов спорта */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Виды спорта</h2>
          <div className="space-y-2">
            {stats.topSports.map(({ sportType, count }) => (
              <div key={sportType} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{sportType}</span>
                <span className="text-sm font-semibold text-gray-800">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { adminApi, type SportArea } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { inputCls, selectCls } from '@/lib/cn';

function AreaForm({
  initial,
  objects,
  onSubmit,
  loading,
}: {
  initial?: Partial<SportArea>;
  objects: { id: string; name: string }[];
  onSubmit: (data: Partial<SportArea>) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<Partial<SportArea>>(initial ?? {});

  const set = (field: keyof SportArea, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
    >
      {!initial?.id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Объект *
          </label>
          <select
            required
            value={form.objectId ?? ''}
            onChange={(e) => set('objectId', e.target.value)}
            className={selectCls(!!form.objectId)}
          >
            <option value="">Выберите объект</option>
            {objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Название площадки *
        </label>
        <input
          required
          value={form.name ?? ''}
          onChange={(e) => set('name', e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Вид спорта *
        </label>
        <input
          required
          value={form.sportType ?? ''}
          onChange={(e) => set('sportType', e.target.value)}
          placeholder="Футбол, Теннис, Плавание..."
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Цена за час (₽) *
        </label>
        <input
          required
          type="number"
          min={0}
          value={form.pricePerHour ?? ''}
          onChange={(e) => set('pricePerHour', Number(e.target.value))}
          className={inputCls}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
      >
        {loading ? 'Сохранение...' : initial?.id ? 'Сохранить' : 'Создать'}
      </button>
    </form>
  );
}

export default function AreasPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'create' | SportArea | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: areas, isLoading, error } = useQuery({
    queryKey: ['admin', 'areas'],
    queryFn: () => adminApi.areas.list(),
  });

  const { data: objectsData } = useQuery({
    queryKey: ['admin', 'objects'],
    queryFn: () => adminApi.objects.list({ limit: 200 }),
  });

  const createMutation = useMutation({
    mutationFn: adminApi.areas.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setModal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SportArea> }) =>
      adminApi.areas.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.areas.delete,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setDeleteId(null);
    },
  });

  const objects = objectsData?.items.map((o) => ({ id: o.id, name: o.name })) ?? [];

  if (isLoading) {
    return (
      <div className="p-8 space-y-3 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-200 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center gap-3 text-red-600">
        <AlertCircle size={20} />
        <span>Ошибка загрузки данных</span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Площадки</h1>
          <p className="text-sm text-gray-500 mt-1">
            {areas?.length ?? 0} площадок в базе данных
          </p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Добавить площадку
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Название
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Объект
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Вид спорта
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Цена/час
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {areas?.map((area) => {
              const parentObj = objects.find((o) => o.id === area.objectId);
              return (
                <tr key={area.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {area.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {parentObj?.name ?? area.objectId.slice(0, 8) + '…'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{area.sportType}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">
                    {Number(area.pricePerHour).toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setModal(area)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteId(area.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        title={modal === 'create' ? 'Новая площадка' : 'Редактировать площадку'}
        open={modal !== null}
        onClose={() => setModal(null)}
      >
        <AreaForm
          initial={modal !== 'create' && modal ? modal : undefined}
          objects={objects}
          loading={createMutation.isPending || updateMutation.isPending}
          onSubmit={(formData) => {
            if (modal === 'create') {
              createMutation.mutate(formData);
            } else if (modal && typeof modal === 'object') {
              updateMutation.mutate({ id: modal.id, data: formData });
            }
          }}
        />
      </Modal>

      <Modal
        title="Удалить площадку?"
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
      >
        <p className="text-sm text-gray-600 mb-5">
          Площадка будет удалена без возможности восстановления.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteId(null)}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            disabled={deleteMutation.isPending}
            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {deleteMutation.isPending && <RefreshCw size={14} className="animate-spin" />}
            Удалить
          </button>
        </div>
      </Modal>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  adminApi,
  DISTRICT_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  type SportObject,
  type District,
  type SportObjectStatus,
} from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { inputCls, selectCls } from '@/lib/cn';

const DISTRICTS = Object.keys(DISTRICT_LABELS) as District[];
const STATUSES = Object.keys(STATUS_LABELS) as SportObjectStatus[];

function ObjectForm({
  initial,
  onSubmit,
  loading,
}: {
  initial?: Partial<SportObject>;
  onSubmit: (data: Partial<SportObject>) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<Partial<SportObject>>(
    initial ?? { status: 'DRAFT' },
  );

  const set = (field: keyof SportObject, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Название *
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
          Адрес *
        </label>
        <input
          required
          value={form.address ?? ''}
          onChange={(e) => set('address', e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Район *
        </label>
        <select
          required
          value={form.district ?? ''}
          onChange={(e) => set('district', e.target.value as District)}
          className={selectCls(!!form.district)}
        >
          <option value="">Выберите район</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {DISTRICT_LABELS[d]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Описание
        </label>
        <textarea
          rows={3}
          value={form.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          className={`${inputCls} resize-none`}
        />
      </div>

      {initial?.id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Статус
          </label>
          <select
            value={form.status ?? 'DRAFT'}
            onChange={(e) => set('status', e.target.value as SportObjectStatus)}
            className={selectCls(true)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}

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

export default function ObjectsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'create' | SportObject | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'objects'],
    queryFn: () => adminApi.objects.list({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: adminApi.objects.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setModal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SportObject> }) =>
      adminApi.objects.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.objects.delete,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setDeleteId(null);
    },
  });

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
          <h1 className="text-2xl font-bold text-gray-900">Объекты</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data?.total ?? 0} объектов в базе данных
          </p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Добавить объект
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
                Район
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Площадок
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Статус
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Рейтинг
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.items.map((obj) => (
              <tr key={obj.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{obj.name}</div>
                  <div className="text-xs text-gray-400 truncate max-w-xs">
                    {obj.address}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {DISTRICT_LABELS[obj.district]}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {obj.areas?.length ?? 0}
                </td>
                <td className="px-4 py-3">
                  <Badge className={STATUS_COLORS[obj.status]}>
                    {STATUS_LABELS[obj.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  ★ {obj.rating.toFixed(1)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setModal(obj)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteId(obj.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        title={modal === 'create' ? 'Новый объект' : 'Редактировать объект'}
        open={modal !== null}
        onClose={() => setModal(null)}
      >
        <ObjectForm
          initial={modal !== 'create' && modal ? modal : undefined}
          loading={createMutation.isPending || updateMutation.isPending}
          onSubmit={(formData) => {
            if (modal === 'create') {
              createMutation.mutate(formData);
            } else if (modal && modal !== 'create') {
              updateMutation.mutate({ id: modal.id, data: formData });
            }
          }}
        />
        {(createMutation.error || updateMutation.error) && (
          <p className="mt-3 text-sm text-red-600">
            Ошибка сохранения. Проверьте данные.
          </p>
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        title="Удалить объект?"
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
      >
        <p className="text-sm text-gray-600 mb-5">
          Это действие удалит объект и все связанные площадки. Отменить нельзя.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteId(null)}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
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

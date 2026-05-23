import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type District =
  | 'VOROSHILOVSKY' | 'OKTYABRSKY' | 'PERVOMAYSKY' | 'PROLETARSKY'
  | 'KIROVSKY' | 'LENINSKY' | 'SOVETSKY' | 'ZHELEZNODOROZHNY';

export type SportObjectStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface ScheduleSlot {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  priceOverride?: number;
}

export interface SportArea {
  id: string;
  name: string;
  sportType: string;
  pricePerHour: number;
  schedule: ScheduleSlot[];
  objectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: string;
  url: string;
  key: string;
  objectId: string;
}

export interface SportObject {
  id: string;
  name: string;
  description?: string;
  address: string;
  phones: string[];
  website?: string | null;
  district: District;
  latitude?: number;
  longitude?: number;
  rating: number;
  status: SportObjectStatus;
  areas: SportArea[];
  images: Media[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface StatsResponse {
  totalObjects: number;
  totalAreas: number;
  byDistrict: { district: District; count: number }[];
  byStatus: { status: SportObjectStatus; count: number }[];
  topSports: { sportType: string; count: number }[];
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
  stats: () =>
    api.get<StatsResponse>('/admin/stats').then((r) => r.data),

  objects: {
    list: (params?: { limit?: number; offset?: number }) =>
      api.get<PaginatedResponse<SportObject>>('/admin/objects', { params }).then((r) => r.data),
    get: (id: string) =>
      api.get<SportObject>(`/admin/objects/${id}`).then((r) => r.data),
    create: (data: Partial<SportObject> & { imageUrls?: string[] }) =>
      api.post<SportObject>('/admin/objects', data).then((r) => r.data),
    update: (id: string, data: Partial<SportObject> & { imageUrls?: string[] }) =>
      api.patch<SportObject>(`/admin/objects/${id}`, data).then((r) => r.data),
    delete: (id: string) =>
      api.delete(`/admin/objects/${id}`).then((r) => r.data),
  },

  areas: {
    list: (objectId?: string) =>
      api.get<SportArea[]>('/admin/areas', { params: objectId ? { objectId } : undefined }).then((r) => r.data),
    get: (id: string) =>
      api.get<SportArea>(`/admin/areas/${id}`).then((r) => r.data),
    create: (data: Partial<SportArea>) =>
      api.post<SportArea>('/admin/areas', data).then((r) => r.data),
    update: (id: string, data: Partial<SportArea>) =>
      api.patch<SportArea>(`/admin/areas/${id}`, data).then((r) => r.data),
    delete: (id: string) =>
      api.delete(`/admin/areas/${id}`).then((r) => r.data),
  },
};

// ─── Labels ───────────────────────────────────────────────────────────────────

export const DISTRICT_LABELS: Record<District, string> = {
  VOROSHILOVSKY: 'Ворошиловский',
  OKTYABRSKY: 'Октябрьский',
  PERVOMAYSKY: 'Первомайский',
  PROLETARSKY: 'Пролетарский',
  KIROVSKY: 'Кировский',
  LENINSKY: 'Ленинский',
  SOVETSKY: 'Советский',
  ZHELEZNODOROZHNY: 'Железнодорожный',
};

export const STATUS_LABELS: Record<SportObjectStatus, string> = {
  DRAFT: 'Черновик',
  PENDING_REVIEW: 'На модерации',
  PUBLISHED: 'Опубликован',
  ARCHIVED: 'Архив',
};

export const STATUS_COLORS: Record<SportObjectStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

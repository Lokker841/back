/**
 * Готовые примеры ответов для @ApiResponse({ schema: ... })
 * Используются во всех контроллерах.
 */

export const SPORT_AREA_EXAMPLE = {
  id: '567ee751-a805-43cb-8020-087d043ef1f2',
  name: 'Футбольное поле №1',
  sportType: 'Футбол',
  pricePerHour: '2500.00',
  schedule: [
    { dayOfWeek: 1, startTime: '08:00', endTime: '22:00', isAvailable: true },
    { dayOfWeek: 6, startTime: '09:00', endTime: '20:00', isAvailable: true },
  ],
  objectId: '6ead6880-7bad-4472-a2af-1edefccf99e7',
  createdAt: '2026-05-13T15:34:58.434Z',
  updatedAt: '2026-05-13T15:34:58.434Z',
};

export const SPORT_AREA_TENNIS_EXAMPLE = {
  id: '10945812-5dc0-40c5-bb94-77bedfb47296',
  name: 'Теннисный корт №1',
  sportType: 'Теннис',
  pricePerHour: '1200.00',
  schedule: [
    { dayOfWeek: 1, startTime: '07:00', endTime: '21:00', isAvailable: true },
  ],
  objectId: '6ead6880-7bad-4472-a2af-1edefccf99e7',
  createdAt: '2026-05-13T15:34:58.434Z',
  updatedAt: '2026-05-13T15:34:58.434Z',
};

export const SPORT_OBJECT_EXAMPLE = {
  id: '6ead6880-7bad-4472-a2af-1edefccf99e7',
  name: 'Стадион «Олимп»',
  description: 'Многофункциональный спортивный комплекс в центре города',
  address: 'Ростов-на-Дону, ул. Пушкинская, 90',
  district: 'LENINSKY',
  latitude: 47.2224,
  longitude: 39.7186,
  rating: 4.5,
  status: 'PUBLISHED',
  areas: [SPORT_AREA_EXAMPLE, SPORT_AREA_TENNIS_EXAMPLE],
  images: [],
  createdAt: '2026-05-13T15:34:58.434Z',
  updatedAt: '2026-05-13T15:34:58.434Z',
};

export const SPORT_OBJECT_DRAFT_EXAMPLE = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'Спортзал «Чемпион»',
  description: 'Тренажерный зал и зал групповых занятий',
  address: 'Ростов-на-Дону, ул. Красноармейская, 25',
  district: 'VOROSHILOVSKY',
  latitude: null,
  longitude: null,
  rating: 3.8,
  status: 'DRAFT',
  areas: [
    {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      name: 'Тренажерный зал',
      sportType: 'Фитнес',
      pricePerHour: '400.00',
      schedule: [],
      objectId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      createdAt: '2026-05-13T15:34:58.434Z',
      updatedAt: '2026-05-13T15:34:58.434Z',
    },
  ],
  images: [],
  createdAt: '2026-05-13T15:34:58.434Z',
  updatedAt: '2026-05-13T15:34:58.434Z',
};

export const CATALOG_LIST_EXAMPLE = {
  items: [SPORT_OBJECT_EXAMPLE],
  total: 2,
  limit: 20,
  offset: 0,
};

export const ADMIN_OBJECTS_LIST_EXAMPLE = {
  items: [SPORT_OBJECT_EXAMPLE, SPORT_OBJECT_DRAFT_EXAMPLE],
  total: 3,
  limit: 50,
  offset: 0,
};

export const ADMIN_AREAS_LIST_EXAMPLE = [
  SPORT_AREA_EXAMPLE,
  SPORT_AREA_TENNIS_EXAMPLE,
];

export const STATS_EXAMPLE = {
  totalObjects: 3,
  totalAreas: 5,
  byDistrict: [
    { district: 'LENINSKY', count: 1 },
    { district: 'OKTYABRSKY', count: 1 },
    { district: 'VOROSHILOVSKY', count: 1 },
  ],
  byStatus: [
    { status: 'PUBLISHED', count: 2 },
    { status: 'DRAFT', count: 1 },
  ],
  topSports: [
    { sportType: 'Футбол', count: 1 },
    { sportType: 'Теннис', count: 1 },
    { sportType: 'Плавание', count: 1 },
    { sportType: 'Единоборства', count: 1 },
    { sportType: 'Фитнес', count: 1 },
  ],
};

export const ERROR_401 = {
  statusCode: 401,
  error: 'AUTH_EXPIRED',
  message: 'Session timed out',
  path: '/api/v1/admin/objects',
  timestamp: '2026-05-13T15:00:00.000Z',
};

export const ERROR_404_OBJECT = {
  statusCode: 404,
  error: 'Not Found',
  message: 'Объект с id 6ead6880-7bad-4472-a2af-1edefccf99e7 не найден',
  path: '/api/v1/catalog/6ead6880-7bad-4472-a2af-1edefccf99e7',
  timestamp: '2026-05-13T15:00:00.000Z',
};

export const ERROR_400_TRANSITION = {
  statusCode: 400,
  error: 'Bad Request',
  message: 'Переход из DRAFT в PUBLISHED запрещён',
  path: '/api/v1/admin/objects/6ead6880-7bad-4472-a2af-1edefccf99e7',
  timestamp: '2026-05-13T15:00:00.000Z',
};

export const ERROR_422_VALIDATION = {
  statusCode: 422,
  error: 'Unprocessable Entity',
  message: ['name should not be empty', 'district must be a valid enum value'],
  path: '/api/v1/admin/objects',
  timestamp: '2026-05-13T15:00:00.000Z',
};

export const GEOCODE_RESULT_EXAMPLE = {
  latitude: 47.2224,
  longitude: 39.7186,
};

export const SEARCH_RESULT_EXAMPLE = {
  items: [SPORT_OBJECT_EXAMPLE],
  total: 1,
};

import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient, District, SportObjectStatus } from '@prisma/client';

const prisma = new PrismaClient();
const geocodeCache = new Map<string, { latitude: number; longitude: number }>();

// Стандартное расписание 07:00-20:00 каждый день
const schedule = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  dayOfWeek: day,
  startTime: '07:00',
  endTime: '20:00',
  isAvailable: true,
}));

type AreaInput = { name: string; sportType: string };

function areas(list: AreaInput[]) {
  return list.map(({ name, sportType }) => ({
    name,
    sportType,
    pricePerHour: 0,
    schedule,
  }));
}

type SeedImage = { url: string; key: string; position?: number };

type SeedObject = {
  name: string;
  description: string;
  address: string;
  district: District;
  phone?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  status?: SportObjectStatus;
  images?: SeedImage[];
  areas: ReturnType<typeof areas>;
};

function parsePhones(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[;,]+/)
    .map((phone) => phone.trim())
    .filter(Boolean);
}

function normalizeAddress(address: string): string {
  let normalized = address
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/пр-т/gi, 'проспект')
    .replace(/пр\./gi, 'проспект')
    .replace(/пер\./gi, 'переулок')
    .trim();

  normalized = normalized
    .replace(/(\d)\s*([абвгдежзийклмнопрстуфхцчшщ])\b/gi, '$1$2')
    .replace(/\bул\.\s*/gi, 'улица ')
    .replace(/\bпроспект\s+/gi, 'проспект ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',');

  return normalized;
}

function cacheLookupKey(address: string): string {
  return normalizeAddress(address)
    .toLowerCase()
    .replace(/[«»"'`,]/g, '')
    .replace(/\s+/g, '')
    .replace(/ё/g, 'е')
    .replace(/1-ой/g, '1-й');
}

function loadGeocodeCache(): void {
  const cachePath = join(__dirname, 'data', 'geocode-cache.json');
  if (!existsSync(cachePath)) {
    console.warn('geocode-cache.json not found, using live geocoding only');
    return;
  }

  const data = JSON.parse(readFileSync(cachePath, 'utf-8')) as Record<
    string,
    { latitude: number; longitude: number }
  >;

  for (const [address, { latitude, longitude }] of Object.entries(data)) {
    const coords = { latitude, longitude };
    for (const key of [address, normalizeAddress(address), cacheLookupKey(address)]) {
      geocodeCache.set(key, coords);
    }
  }

  console.log(`Loaded ${Object.keys(data).length} cached geocodes`);
}

loadGeocodeCache();

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number }> {
  const apiKey = process.env.YANDEX_GEOCODER_API_KEY;
  const normalized = normalizeAddress(address);
  const cached =
    geocodeCache.get(normalized) ??
    geocodeCache.get(address) ??
    geocodeCache.get(cacheLookupKey(address));
  if (cached) return cached;

  let latitude: number | null = null;
  let longitude: number | null = null;
  const queries = [
    normalized,
    normalized.replace(', Россия', ''),
    normalized.replace(/\bг\.\s*/gi, ''),
    normalized.replace(/\bг\.\s*/gi, '').replace(/улица/gi, ''),
    normalized.replace(/\bпереулок\s+/gi, ''),
    normalized.replace(/\bпроспект\s+/gi, ''),
    normalized.replace(/\bулица\s+/gi, ''),
    normalized.replace(/,\s*(\d+[а-яa-z0-9/-]*)/gi, ' $1'),
    normalized.replace(/,\s*\d+\/\d+.*$/gi, ''),
  ].filter((v, i, arr) => !!v && arr.indexOf(v) === i);

  if (apiKey && apiKey !== 'your_api_key_here') {
    for (const q of queries) {
      const baseUrl = process.env.YANDEX_GEOCODER_URL ?? 'https://geocode-maps.yandex.ru/v1';
      const url = new URL(baseUrl);
      url.searchParams.set('apikey', apiKey);
      url.searchParams.set('geocode', q);
      url.searchParams.set('format', 'json');
      url.searchParams.set('results', '1');

      const response = await fetch(url);
      if (!response.ok) continue;
      const data = (await response.json()) as {
        response?: {
          GeoObjectCollection?: {
            featureMember?: Array<{
              GeoObject?: {
                Point?: { pos?: string };
              };
            }>;
          };
        };
      };

      const pos =
        data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
      if (pos) {
        const [lonStr, latStr] = pos.split(' ');
        longitude = Number.parseFloat(lonStr);
        latitude = Number.parseFloat(latStr);
        if (
          Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          (latitude as number) >= 47.05 &&
          (latitude as number) <= 47.45 &&
          (longitude as number) >= 39.45 &&
          (longitude as number) <= 40.05
        ) {
          break;
        }
        latitude = null;
        longitude = null;
      }
    }
  }

  // Fallback: OSM Nominatim, если Yandex недоступен/ограничен
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    for (const q of queries) {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', q);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('countrycodes', 'ru');

      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'sportgid-seed/1.0' },
      });
      if (!response.ok) continue;
      const data = (await response.json()) as Array<{ lat: string; lon: string }>;
      if (!data.length) continue;
      latitude = Number.parseFloat(data[0].lat);
      longitude = Number.parseFloat(data[0].lon);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) break;
    }
  }

  const inRostov =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    (latitude as number) >= 47.05 &&
    (latitude as number) <= 47.45 &&
    (longitude as number) >= 39.45 &&
    (longitude as number) <= 40.05;

  if (!inRostov) {
    throw new Error(`Invalid coordinates for "${normalized}"`);
  }
  if (latitude === 0 || longitude === 0) {
    throw new Error(`Zero coordinates for "${normalized}"`);
  }

  const result = { latitude: latitude as number, longitude: longitude as number };
  geocodeCache.set(normalized, result);
  return result;
}

const OBJECTS: SeedObject[] = [
  {
    name: 'ГБПОУ РО «РОУОР»',
    description:
      'Многопрофильный спортивный объект. Развиваются баскетбол, бокс, водное поло, велоспорт, гандбол, гребной спорт, лёгкая атлетика, парусный спорт, плавание, синхронное плавание, самбо, современное пятиборье, спортивная борьба, спортивная гимнастика, художественная гимнастика, триатлон, фехтование, футбол.',
    address: 'г. Ростов-на-Дону, пр-т Будённовский, 101',
    district: District.OKTYABRSKY,
    phone: '8 (863) 234-50-02',
    website: 'https://rouor.ru/',
    latitude: 47.2362452,
    longitude: 39.698687,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/737e118c-c24f-4d96-9032-d539e6d4f177/6d1e9e37-2b75-4041-9f94-0c884502e375.jpeg', key: 'objects/737e118c-c24f-4d96-9032-d539e6d4f177/6d1e9e37-2b75-4041-9f94-0c884502e375.jpeg', position: 0 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Баскетбол' },
      { name: 'Спортивный зал', sportType: 'Бокс' },
      { name: 'Бассейн', sportType: 'Водное поло' },
      { name: 'Спортивный зал', sportType: 'Гандбол' },
      { name: 'Гребной канал', sportType: 'Гребля на байдарках и каноэ' },
      { name: 'Гребной канал', sportType: 'Гребной спорт (академическая гребля)' },
      { name: 'Стадион', sportType: 'Лёгкая атлетика' },
      { name: 'Акватория р. Дон', sportType: 'Парусный спорт' },
      { name: 'Бассейн', sportType: 'Плавание' },
      { name: 'Спортивный зал', sportType: 'Самбо' },
      { name: 'Бассейн', sportType: 'Синхронное плавание' },
      { name: 'Спортивный зал', sportType: 'Современное пятиборье' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (вольная)' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
      { name: 'Спортивный зал', sportType: 'Спортивная гимнастика' },
      { name: 'Спортивный зал', sportType: 'Фехтование' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «ПАСШ № 27»',
    description:
      'Многофункциональный спортивный объект для лиц с ограниченными возможностями здоровья. Комплекс ориентирован на подготовку спортсменов по адаптивным видам спорта: плавание, лёгкая атлетика, настольный теннис, шахматы, шашки, спортивная гимнастика.',
    address: 'г. Ростов-на-Дону, пр-т Королева, 24',
    district: District.VOROSHILOVSKY,
    phone: '8 (863) 231-10-40',
    website: 'https://pash27.ru/',
    latitude: 47.2948264,
    longitude: 39.716346,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/f0373f30-06c0-4b8c-8c08-df14bb68cf9d/9779eecb-745a-4241-bc68-4907afa67e90.jpg', key: 'objects/f0373f30-06c0-4b8c-8c08-df14bb68cf9d/9779eecb-745a-4241-bc68-4907afa67e90.jpg', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/f0373f30-06c0-4b8c-8c08-df14bb68cf9d/304f83d2-19f5-4bbb-aac2-723bf108af66.jpg', key: 'objects/f0373f30-06c0-4b8c-8c08-df14bb68cf9d/304f83d2-19f5-4bbb-aac2-723bf108af66.jpg', position: 1 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Баскетбол' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Беговые дорожки', sportType: 'Лёгкая атлетика' },
      { name: 'Спортивный зал', sportType: 'Настольный теннис' },
      { name: 'Бассейн', sportType: 'Плавание' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо' },
      { name: 'Спортивный зал', sportType: 'Фехтование' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
      { name: 'Спортивный зал', sportType: 'Шахматы' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР «ЦОП № 1»»',
    description:
      'Центр олимпийской подготовки. Развиваются бокс, велоспорт, гребной спорт, гребля на байдарках и каноэ, дзюдо, лёгкая атлетика, парусный спорт, прыжки на батуте, современное пятиборье, спортивная борьба, стрельба из лука, тхэквондо, тяжёлая атлетика, фехтование, художественная гимнастика.',
    address: 'г. Ростов-на-Дону, пр-т Шолохова, 31',
    district: District.PERVOMAYSKY,
    phone: '8 (863) 261-33-08',
    website: 'https://olympicrostov.ru/',
    latitude: 47.2431181,
    longitude: 39.7601294,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/e0d5e4c5-5fdf-420f-8204-f8738e41f31f/2b7a5a76-9a14-4531-b6c2-af5fd7752670.jpeg', key: 'objects/e0d5e4c5-5fdf-420f-8204-f8738e41f31f/2b7a5a76-9a14-4531-b6c2-af5fd7752670.jpeg', position: 0 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Бокс' },
      { name: 'Велотрек', sportType: 'Велоспорт (трек)' },
      { name: 'Гребной канал', sportType: 'Гребля на байдарках и каноэ' },
      { name: 'Гребной канал', sportType: 'Гребной спорт (академическая гребля)' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Стадион', sportType: 'Лёгкая атлетика' },
      { name: 'Акватория р. Дон', sportType: 'Парусный спорт' },
      { name: 'Спортивный зал', sportType: 'Прыжки на батуте' },
      { name: 'Спортивный зал', sportType: 'Современное пятиборье' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (вольная)' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
      { name: 'Площадка для стрельбы', sportType: 'Стрельба из лука' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо (ВТФ)' },
      { name: 'Спортивный зал', sportType: 'Тяжёлая атлетика' },
      { name: 'Спортивный зал', sportType: 'Фехтование' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 11»',
    description:
      'Спортивный объект для подготовки спортсменов по тхэквондо, фехтованию, художественной гимнастике, бильярдному спорту и акробатическому рок-н-роллу.',
    address: 'г. Ростов-на-Дону, ул. Большая Садовая, 127б',
    district: District.KIROVSKY,
    phone: '8 (863) 263-54-46',
    website: 'https://osd-11.ru/',
    latitude: 47.2267453,
    longitude: 39.7366904,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/ce473f5a-d6a5-47c6-8640-ec605c05180e/e3592d92-4439-4d9c-ac6e-1055f41fd6d8.webp', key: 'objects/ce473f5a-d6a5-47c6-8640-ec605c05180e/e3592d92-4439-4d9c-ac6e-1055f41fd6d8.webp', position: 0 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Акробатический рок-н-ролл' },
      { name: 'Спортивный зал', sportType: 'Бильярдный спорт' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо (ВТФ)' },
      { name: 'Спортивный зал', sportType: 'Фехтование' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 19»',
    description:
      'Спортивная школа олимпийского резерва. Развиваются бокс, велоспорт (ВМХ, МТБ, трек, шоссе), пулевая стрельба, стендовая стрельба, стрельба из лука, теннис, футбол.',
    address: 'г. Ростов-на-Дону, пр. Стачки, 28',
    district: District.ZHELEZNODOROZHNY,
    phone: '8 (863) 236-13-27',
    website: 'https://сшор19.рф/',
    latitude: 47.2115259,
    longitude: 39.6694871,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/cc943d7d-780f-425f-9ad0-1c99e0d66821/70340007-7494-49cb-b2fc-daa219b6d386.webp', key: 'objects/cc943d7d-780f-425f-9ad0-1c99e0d66821/70340007-7494-49cb-b2fc-daa219b6d386.webp', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/cc943d7d-780f-425f-9ad0-1c99e0d66821/de27e632-bbb9-4b9a-baf7-d36670c85ebb.webp', key: 'objects/cc943d7d-780f-425f-9ad0-1c99e0d66821/de27e632-bbb9-4b9a-baf7-d36670c85ebb.webp', position: 1 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/cc943d7d-780f-425f-9ad0-1c99e0d66821/a3153a13-baf8-4ec2-9256-e8aa72ccedf6.jpg', key: 'objects/cc943d7d-780f-425f-9ad0-1c99e0d66821/a3153a13-baf8-4ec2-9256-e8aa72ccedf6.jpg', position: 2 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Бокс' },
      { name: 'Велотрасса', sportType: 'Велоспорт (ВМХ)' },
      { name: 'Велотрасса', sportType: 'Велоспорт (МТБ)' },
      { name: 'Велотрек', sportType: 'Велоспорт (трек)' },
      { name: 'Стрелковый тир', sportType: 'Пулевая стрельба' },
      { name: 'Стрелковый тир', sportType: 'Стендовая стрельба' },
      { name: 'Площадка для стрельбы', sportType: 'Стрельба из лука' },
      { name: 'Теннисный корт', sportType: 'Теннис' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 1»',
    description:
      'Спортивная школа олимпийского резерва. Специализируется на самбо и дзюдо.',
    address: 'г. Ростов-на-Дону, ул. Шеболдаева, 97/2',
    district: District.OKTYABRSKY,
    phone: '8(863) 283-90-07',
    website: 'https://schor1-rr.ru/',
    latitude: 47.2483341,
    longitude: 39.696968,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/b749b7eb-1ccd-4e60-9cad-02ec59fd9807/bd50e672-bcc7-4c7f-9de0-85c82bb0b2b8.jpeg', key: 'objects/b749b7eb-1ccd-4e60-9cad-02ec59fd9807/bd50e672-bcc7-4c7f-9de0-85c82bb0b2b8.jpeg', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/b749b7eb-1ccd-4e60-9cad-02ec59fd9807/9c7f2e7c-7562-449f-919d-3504b6602c44.webp', key: 'objects/b749b7eb-1ccd-4e60-9cad-02ec59fd9807/9c7f2e7c-7562-449f-919d-3504b6602c44.webp', position: 1 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Спортивный зал', sportType: 'Самбо' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 22»',
    description:
      'Спортивный объект с бассейном. Развиваются водное поло, конный спорт, плавание, синхронное плавание, современное пятиборье и фехтование.',
    address: 'г. Ростов-на-Дону, ул. 1-й Конной Армии, 6д',
    district: District.PERVOMAYSKY,
    phone: '8 (863) 252-59-89',
    website: 'https://korall-rostov.ru/',
    latitude: 47.2466149,
    longitude: 39.7593135,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/464cccf0-a14c-4f99-8ab0-df886dd04a9a/a22dae3a-b25d-40d3-bfa9-7f7072af3e60.webp', key: 'objects/464cccf0-a14c-4f99-8ab0-df886dd04a9a/a22dae3a-b25d-40d3-bfa9-7f7072af3e60.webp', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/464cccf0-a14c-4f99-8ab0-df886dd04a9a/2a6ee307-95b7-4a58-a643-02d836209c4d.jpeg', key: 'objects/464cccf0-a14c-4f99-8ab0-df886dd04a9a/2a6ee307-95b7-4a58-a643-02d836209c4d.jpeg', position: 1 },
    ],
    areas: areas([
      { name: 'Бассейн', sportType: 'Водное поло' },
      { name: 'Конноспортивный клуб', sportType: 'Конный спорт' },
      { name: 'Бассейн', sportType: 'Плавание' },
      { name: 'Бассейн', sportType: 'Синхронное плавание' },
      { name: 'Спортивный зал', sportType: 'Современное пятиборье' },
      { name: 'Спортивный зал', sportType: 'Фехтование' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 35 им. братьев Самургашевых»',
    description:
      'Многофункциональный спортивный объект, предназначенный для проведения тренировок, соревнований и физкультурно-оздоровительных занятий. Комплекс ориентирован на подготовку спортсменов по вольной и греко-римской борьбе, тяжёлой атлетике и художественной гимнастике.',
    address: 'г. Ростов-на-Дону, ул. Волкова, 18',
    district: District.VOROSHILOVSKY,
    phone: '8 (863) 240-94-45',
    website: 'https://sdushor-35.ru/',
    latitude: 47.2830767,
    longitude: 39.7185429,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/0c92d47f-dd64-4ab4-a741-ead04d45016f/ae5e7ff1-36f9-4364-833e-05966e31cb0c.webp', key: 'objects/0c92d47f-dd64-4ab4-a741-ead04d45016f/ae5e7ff1-36f9-4364-833e-05966e31cb0c.webp', position: 0 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (вольная)' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
      { name: 'Спортивный зал', sportType: 'Тяжёлая атлетика' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 6»',
    description:
      'Спортивная школа олимпийского резерва, специализирующаяся на зимних видах спорта: фигурное катание на коньках и хоккей.',
    address: 'г. Ростов-на-Дону, пр. Коммунистический, 36/4',
    district: District.SOVETSKY,
    phone: '8 (863) 210-35-69',
    website: 'https://zimarostov.ru/',
    latitude: 47.2081572,
    longitude: 39.6272808,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/fe935ec8-cb7f-4f9c-8b13-6cb007c0c722/b51fa571-fa86-4723-bb6a-72a185ff4849.webp', key: 'objects/fe935ec8-cb7f-4f9c-8b13-6cb007c0c722/b51fa571-fa86-4723-bb6a-72a185ff4849.webp', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/fe935ec8-cb7f-4f9c-8b13-6cb007c0c722/73dd7d5d-09cb-4e46-ae05-8e1069d04cac.jpeg', key: 'objects/fe935ec8-cb7f-4f9c-8b13-6cb007c0c722/73dd7d5d-09cb-4e46-ae05-8e1069d04cac.jpeg', position: 1 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/fe935ec8-cb7f-4f9c-8b13-6cb007c0c722/37e9303c-38e8-452f-91b3-2690a3fa3522.webp', key: 'objects/fe935ec8-cb7f-4f9c-8b13-6cb007c0c722/37e9303c-38e8-452f-91b3-2690a3fa3522.webp', position: 2 },
    ],
    areas: areas([
      { name: 'Ледовый каток', sportType: 'Фигурное катание на коньках' },
      { name: 'Ледовый каток', sportType: 'Хоккей' },
    ]),
  },
  {
    name: 'МБУ ДО «Гребной канал «Дон»',
    description:
      'Многофункциональный спортивный объект для подготовки спортсменов по гребному спорту, гребле на байдарках и каноэ, BMX, волейболу, теннису, футболу, триатлону, скалолазанию, шахматам и другим видам спорта.',
    address: 'г. Ростов-на-Дону, ул. Пойменная, 2а',
    district: District.KIROVSKY,
    phone: '8 (863) 240-50-65',
    website: 'https://grebnoykanal.ru/',
    latitude: 47.2042508,
    longitude: 39.7339165,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/39c5d44c-b188-4ad8-b7ce-3e95b62ba298/1243183f-0878-4767-8886-df725d0eb735.jpg', key: 'objects/39c5d44c-b188-4ad8-b7ce-3e95b62ba298/1243183f-0878-4767-8886-df725d0eb735.jpg', position: 0 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Акробатический рок-н-ролл' },
      { name: 'Велотрасса', sportType: 'Велоспорт-БМХ' },
      { name: 'Велотрасса', sportType: 'Велоспорт-маунтинбайк (МТБ)' },
      { name: 'Спортивный зал', sportType: 'Волейбол' },
      { name: 'Гребной бассейн', sportType: 'Гребля на байдарках и каноэ' },
      { name: 'Гребной бассейн', sportType: 'Гребной спорт' },
      { name: 'Скалодром', sportType: 'Скалолазание' },
      { name: 'Теннисные корты', sportType: 'Теннис' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
      { name: 'Спортивный зал', sportType: 'Шахматы' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ «13»»',
    description:
      'Спортивный объект для проведения учебно-тренировочных занятий и соревнований. Развиваются плавание, кудо, гандбол, тхэквондо, футбол, теннис, самбо, волейбол, спортивная акробатика, спортивная борьба и настольный теннис.',
    address: 'г. Ростов-на-Дону, ул. 26 Июня, 103А/15',
    district: District.PERVOMAYSKY,
    phone: '8 (863) 223-83-39',
    website: 'https://dussh13.ru/',
    latitude: 47.271043,
    longitude: 39.792898,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/61b56d70-dafa-4bd1-91ce-dbdfa2ad2229/f83d244c-9e49-4816-80f1-ef1f40968ccb.webp', key: 'objects/61b56d70-dafa-4bd1-91ce-dbdfa2ad2229/f83d244c-9e49-4816-80f1-ef1f40968ccb.webp', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/61b56d70-dafa-4bd1-91ce-dbdfa2ad2229/fc2ebd9c-0bab-42c5-b8ce-093b2207406b.jpeg', key: 'objects/61b56d70-dafa-4bd1-91ce-dbdfa2ad2229/fc2ebd9c-0bab-42c5-b8ce-093b2207406b.jpeg', position: 1 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Волейбол' },
      { name: 'Спортивный зал', sportType: 'Гандбол' },
      { name: 'Спортивный зал', sportType: 'Кудо' },
      { name: 'Бассейн', sportType: 'Плавание' },
      { name: 'Спортивный зал', sportType: 'Самбо' },
      { name: 'Спортивный зал', sportType: 'Спортивная акробатика' },
      { name: 'Теннисный корт', sportType: 'Теннис' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ «Боевые перчатки»»',
    description:
      'Многофункциональный спортивный объект, предназначенный для проведения тренировок, соревнований и физкультурно-оздоровительных занятий. Комплекс ориентирован на подготовку спортсменов по боксу и кикбоксингу, а также проведение спортивно-массовых мероприятий.',
    address: 'г. Ростов-на-Дону, ул. Капустина, 18/1',
    district: District.VOROSHILOVSKY,
    phone: '8 (863) 233-46-23',
    website: 'https://xn--80abdlbawp4anmz7d9b.xn--p1ai/',
    latitude: 47.278482,
    longitude: 39.7180706,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/a970c768-0c20-4aee-aa6d-052d9f928b9e/57950a7b-5d60-481f-8bac-95f9da0b6356.jpeg', key: 'objects/a970c768-0c20-4aee-aa6d-052d9f928b9e/57950a7b-5d60-481f-8bac-95f9da0b6356.jpeg', position: 0 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Бокс' },
      { name: 'Спортивный зал', sportType: 'Кикбоксинг' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 10»',
    description:
      'Многофункциональный спортивный объект, предназначенный для проведения тренировок, соревнований и физкультурно-оздоровительных занятий. Комплекс ориентирован на подготовку спортсменов и организацию занятий по плаванию, синхронному плаванию, боксу и дзюдо.',
    address: 'г. Ростов-на-Дону, пр. Михаила Нагибина, 12/3',
    district: District.VOROSHILOVSKY,
    phone: '8 (863) 201-38-00',
    website: 'https://dussh10rostov.ru/',
    latitude: 47.2632589,
    longitude: 39.7196364,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/a825233d-9a3e-4712-a5f5-90b42bba7d04/bd23f778-c359-4034-bdaa-d042ed7e25f2.webp', key: 'objects/a825233d-9a3e-4712-a5f5-90b42bba7d04/bd23f778-c359-4034-bdaa-d042ed7e25f2.webp', position: 0 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Бокс' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Бассейн', sportType: 'Плавание' },
      { name: 'Бассейн', sportType: 'Синхронное плавание' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 11»',
    description:
      'Спортивная школа с широким профилем единоборств и гимнастики. Развиваются кудо, дзюдо, тхэквондо, киокусинкай, чир спорт, акробатический рок-н-ролл, спортивная борьба, прыжки в воду, брейкинг.',
    address: 'г. Ростов-на-Дону',
    district: District.KIROVSKY,
    phone: '8 (863) 269-38-85',
    website: 'https://dussh11.ru/',
    latitude: 47.222078,
    longitude: 39.720358,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/73c386ca-c319-4d49-99e4-2241cf377f34/9da7ea30-3bc8-42be-9a41-4b5ffae7345b.jpg', key: 'objects/73c386ca-c319-4d49-99e4-2241cf377f34/9da7ea30-3bc8-42be-9a41-4b5ffae7345b.jpg', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/73c386ca-c319-4d49-99e4-2241cf377f34/b08715ef-de31-4dd7-a34e-53d7857812c3.jpeg', key: 'objects/73c386ca-c319-4d49-99e4-2241cf377f34/b08715ef-de31-4dd7-a34e-53d7857812c3.jpeg', position: 1 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Акробатический рок-н-ролл' },
      { name: 'Бильярдная', sportType: 'Бильярдный спорт' },
      { name: 'Танцевальный зал', sportType: 'Брейкинг' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Спортивный зал', sportType: 'Киокусинкай' },
      { name: 'Спортивный зал', sportType: 'Кудо' },
      { name: 'Бассейн', sportType: 'Прыжки в воду' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (вольная)' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо' },
      { name: 'Спортивный зал', sportType: 'Чир спорт' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 12»',
    description:
      'Спортивный объект с разнообразной инфраструктурой. Развиваются футбол, настольный теннис, акробатический рок-н-ролл, художественная гимнастика, лёгкая атлетика, волейбол.',
    address: 'г. Ростов-на-Дону, ул. 2-я Краснодарская, 149В',
    district: District.SOVETSKY,
    phone: '8 (863) 207-52-08',
    website: 'https://сш12.рф/',
    latitude: 47.2020337,
    longitude: 39.6208726,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/f1bed018-9349-45cd-9716-73d97e69dd3c/b3a83659-6ccc-47f3-a843-897c58771283.webp', key: 'objects/f1bed018-9349-45cd-9716-73d97e69dd3c/b3a83659-6ccc-47f3-a843-897c58771283.webp', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/f1bed018-9349-45cd-9716-73d97e69dd3c/55175e44-057a-4894-993e-b5b1e5d81928.jpeg', key: 'objects/f1bed018-9349-45cd-9716-73d97e69dd3c/55175e44-057a-4894-993e-b5b1e5d81928.jpeg', position: 1 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Акробатический рок-н-ролл' },
      { name: 'Спортивный зал', sportType: 'Волейбол' },
      { name: 'Стадион', sportType: 'Лёгкая атлетика' },
      { name: 'Спортивный зал', sportType: 'Настольный теннис' },
      { name: 'Стадион', sportType: 'Футбол' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 1»',
    description:
      'Спортивная школа с разнообразной инфраструктурой. Развиваются лёгкая атлетика, пулевая стрельба, дартс и баскетбол.',
    address: 'г. Ростов-на-Дону, пр. 40-летия Победы, 63/14',
    district: District.PROLETARSKY,
    phone: '8 (863) 257-04-23',
    website: 'https://дсш1-ростов.рф/',
    latitude: 47.23708,
    longitude: 39.8144391,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/c22da32b-80c5-4812-b996-0f2b2e05248d/0e424878-8f2b-4798-ab8c-6acc64f2a3a9.jpeg', key: 'objects/c22da32b-80c5-4812-b996-0f2b2e05248d/0e424878-8f2b-4798-ab8c-6acc64f2a3a9.jpeg', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/c22da32b-80c5-4812-b996-0f2b2e05248d/34fd0487-436e-4c05-8114-2eeab9237426.jpeg', key: 'objects/c22da32b-80c5-4812-b996-0f2b2e05248d/34fd0487-436e-4c05-8114-2eeab9237426.jpeg', position: 1 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/c22da32b-80c5-4812-b996-0f2b2e05248d/b8de0f99-f76a-4e52-90f6-281cd1f739ec.webp', key: 'objects/c22da32b-80c5-4812-b996-0f2b2e05248d/b8de0f99-f76a-4e52-90f6-281cd1f739ec.webp', position: 2 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Баскетбол' },
      { name: 'Спортивный зал', sportType: 'Дартс' },
      { name: 'Стадион', sportType: 'Лёгкая атлетика' },
      { name: 'Стрелковый тир', sportType: 'Пулевая стрельба' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 3»',
    description:
      'Центр спортивной подготовки, ориентированный на развитие игровых и индивидуальных видов спорта: бадминтон, настольный теннис, теннис и чир спорт.',
    address: 'г. Ростов-на-Дону, пер. Днепровский, 131',
    district: District.PERVOMAYSKY,
    phone: '8 (863) 223-39-68',
    website: 'https://дюсш-3-ростов.рф/',
    latitude: 47.2866502,
    longitude: 39.752941,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/7e88527d-d6a3-4b00-bab6-3903cc82340d/b1e80392-40f4-49db-9ecc-3b645b0a4851.jpeg', key: 'objects/7e88527d-d6a3-4b00-bab6-3903cc82340d/b1e80392-40f4-49db-9ecc-3b645b0a4851.jpeg', position: 0 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Бадминтон' },
      { name: 'Бильярдная', sportType: 'Бильярдный спорт' },
      { name: 'Спортивный зал', sportType: 'Настольный теннис' },
      { name: 'Танцевальный зал', sportType: 'Танцевальный спорт' },
      { name: 'Теннисный корт', sportType: 'Теннис' },
      { name: 'Спортивный зал', sportType: 'Чир спорт' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 5»',
    description:
      'Спортивная школа с широким профилем. Развиваются волейбол, гандбол, художественная гимнастика, каратэ, борьба на поясах.',
    address: 'г. Ростов-на-Дону, ул. Загорская, 10',
    district: District.ZHELEZNODOROZHNY,
    phone: '8 (863) 680-76-73',
    website: 'https://sport-shkola.ru/',
    latitude: 47.20944,
    longitude: 39.6893517,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/f4b5d73f-2124-4757-9a2b-f95bfb05eb4c/d6633050-edb7-4282-a520-da47434dca7e.jpeg', key: 'objects/f4b5d73f-2124-4757-9a2b-f95bfb05eb4c/d6633050-edb7-4282-a520-da47434dca7e.jpeg', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/f4b5d73f-2124-4757-9a2b-f95bfb05eb4c/8d7b1d15-d7aa-4c53-aab6-21558dce8fd6.webp', key: 'objects/f4b5d73f-2124-4757-9a2b-f95bfb05eb4c/8d7b1d15-d7aa-4c53-aab6-21558dce8fd6.webp', position: 1 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Борьба на поясах' },
      { name: 'Спортивный зал', sportType: 'Волейбол' },
      { name: 'Спортивный зал', sportType: 'Гандбол' },
      { name: 'Спортивный зал', sportType: 'Каратэ' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 6»',
    description:
      'Спортивная школа, специализирующаяся на игровых видах спорта и подготовке спортсменов. Проводятся тренировки по волейболу, футболу, баскетболу, тхэквондо, дзюдо, кудо, художественной гимнастике.',
    address: 'г. Ростов-на-Дону, ул. Веры Пановой, 27',
    district: District.PERVOMAYSKY,
    phone: '8 (863) 250-82-83',
    website: 'https://дюсш6.рф/',
    latitude: 47.2563634,
    longitude: 39.7716247,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/7e8677b1-4d64-4ea7-8750-ea9cd10cdd80/beb95f02-9f77-4093-ba48-56efeb2fedd5.jpeg', key: 'objects/7e8677b1-4d64-4ea7-8750-ea9cd10cdd80/beb95f02-9f77-4093-ba48-56efeb2fedd5.jpeg', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/7e8677b1-4d64-4ea7-8750-ea9cd10cdd80/a9c7e832-64d2-426a-9cf4-655ef216fd41.webp', key: 'objects/7e8677b1-4d64-4ea7-8750-ea9cd10cdd80/a9c7e832-64d2-426a-9cf4-655ef216fd41.webp', position: 1 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Спортивный зал', sportType: 'Кудо' },
      { name: 'Спортивный зал', sportType: 'Прыжки на батуте' },
      { name: 'Спортивный зал', sportType: 'Спортивная акробатика' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 7»',
    description:
      'Спортивная школа, специализирующаяся на баскетболе и спортивной борьбе.',
    address: 'г. Ростов-на-Дону, ул. Максима Горького, 274',
    district: District.PROLETARSKY,
    phone: '8 (863) 266-64-57',
    website: 'https://dushrostov-7.ru/',
    latitude: 47.231933,
    longitude: 39.7446053,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/08d182b8-cd44-4518-bc9d-1b5ed4e7e8be/af06f330-3c02-4110-b9a1-5b2c5de8808c.jpeg', key: 'objects/08d182b8-cd44-4518-bc9d-1b5ed4e7e8be/af06f330-3c02-4110-b9a1-5b2c5de8808c.jpeg', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/08d182b8-cd44-4518-bc9d-1b5ed4e7e8be/230a240c-e929-4c5e-beb2-18ccb727e83f.webp', key: 'objects/08d182b8-cd44-4518-bc9d-1b5ed4e7e8be/230a240c-e929-4c5e-beb2-18ccb727e83f.webp', position: 1 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/08d182b8-cd44-4518-bc9d-1b5ed4e7e8be/1be90ce4-b417-43cd-afc0-9eab97ce2d24.webp', key: 'objects/08d182b8-cd44-4518-bc9d-1b5ed4e7e8be/1be90ce4-b417-43cd-afc0-9eab97ce2d24.webp', position: 2 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Баскетбол' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 8»',
    description:
      'Спортивная школа с уклоном в единоборства: спортивная борьба (греко-римская и вольная), бокс, самбо, дзюдо.',
    address: 'г. Ростов-на-Дону, ул. Таганрогская, 118/2',
    district: District.OKTYABRSKY,
    phone: '8 (863) 276-98-51',
    website: 'https://olimpic8.ru/',
    latitude: 47.256245,
    longitude: 39.6489182,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/db6de80b-a5bf-48f0-a7a8-78402535bd56/c9d8da40-1d38-4275-8a7b-6042ccd2a14a.jpeg', key: 'objects/db6de80b-a5bf-48f0-a7a8-78402535bd56/c9d8da40-1d38-4275-8a7b-6042ccd2a14a.jpeg', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/db6de80b-a5bf-48f0-a7a8-78402535bd56/c10cd779-0844-4a28-b591-566aea8a4980.webp', key: 'objects/db6de80b-a5bf-48f0-a7a8-78402535bd56/c10cd779-0844-4a28-b591-566aea8a4980.webp', position: 1 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Бокс' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Спортивный зал', sportType: 'Самбо' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (вольная)' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
    ]),
  },
  {
    name: 'МБУ ДО «СШОР № 2»',
    description:
      'Спортивный объект, специализирующийся на подготовке спортсменов по спортивной гимнастике и проведении учебно-тренировочных занятий.',
    address: 'г. Ростов-на-Дону, пер. Беломорский, 16б',
    district: District.PERVOMAYSKY,
    phone: '8 (863) 291-85-90',
    website: 'https://rostovgymnast.ru/',
    latitude: 47.2693558,
    longitude: 39.7528899,
    status: SportObjectStatus.PUBLISHED,
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Спортивная гимнастика' },
    ]),
  },
  {
    name: 'МБУ ДО «СШОР № 8 им. В.В. Понедельника»',
    description:
      'Спортивная школа, специализирующаяся на подготовке спортсменов в видах единоборств: бокс, дзюдо, самбо, вольная и греко-римская борьба. Также развиваются гандбол, гребной спорт, лёгкая атлетика, парусный спорт, скалолазание, теннис, футбол.',
    address: 'г. Ростов-на-Дону, ул. 1-й Конной Армии, 4е',
    district: District.PERVOMAYSKY,
    phone: '8 (863) 242-29-77',
    website: 'https://olimpic8.ru/',
    latitude: 47.2453296,
    longitude: 39.7597171,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/2ed40b24-9bdb-4027-a682-efdddb66a7b9/99e45447-2147-4fde-a18a-0d2ac8c306fe.jpeg', key: 'objects/2ed40b24-9bdb-4027-a682-efdddb66a7b9/99e45447-2147-4fde-a18a-0d2ac8c306fe.jpeg', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/2ed40b24-9bdb-4027-a682-efdddb66a7b9/3ad7385d-0e70-4ff2-a45a-d9ab321a2b81.webp', key: 'objects/2ed40b24-9bdb-4027-a682-efdddb66a7b9/3ad7385d-0e70-4ff2-a45a-d9ab321a2b81.webp', position: 1 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Гандбол' },
      { name: 'Гребной канал', sportType: 'Гребной спорт (академическая гребля)' },
      { name: 'Стадион', sportType: 'Лёгкая атлетика' },
      { name: 'Акватория р. Дон', sportType: 'Парусный спорт' },
      { name: 'Скалодром', sportType: 'Скалолазание' },
      { name: 'Спортивный зал', sportType: 'Софтбол' },
      { name: 'Теннисный корт', sportType: 'Теннис' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
    ]),
  },
  {
    name: 'МБУ ДО СШ № 4',
    description:
      'Спортивный объект, предназначенный для проведения тренировочных занятий, соревнований и физкультурно-оздоровительных мероприятий. На базе школы развиваются футбол, велоспорт, плавание и шахматы.',
    address: 'г. Ростов-на-Дону, ул. Тельмана, 14а',
    district: District.OKTYABRSKY,
    phone: '8 (863) 282-83-64',
    website: 'https://sports-school.ru/',
    latitude: 47.2277546,
    longitude: 39.7052943,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/ba138679-f408-455e-b324-d9cd700614e0/f353a099-d34e-4262-bf91-e46d2a17a065.jpeg', key: 'objects/ba138679-f408-455e-b324-d9cd700614e0/f353a099-d34e-4262-bf91-e46d2a17a065.jpeg', position: 0 },
    ],
    areas: areas([
      { name: 'Велотрасса', sportType: 'Велоспорт' },
      { name: 'Бассейн', sportType: 'Плавание' },
      { name: 'Спортивный зал', sportType: 'Шахматы' },
    ]),
  },
  {
    name: 'Спортивная школа олимпийского резерва № 5',
    description:
      'Спортивный комплекс, обеспечивающий проведение учебно-тренировочного процесса, соревнований и массовых спортивных мероприятий. На базе объекта развиваются футбол, бейсбол, лёгкая атлетика, баскетбол, волейбол и гандбол.',
    address: 'г. Ростов-на-Дону, ул. Пойменная, 2а',
    district: District.KIROVSKY,
    phone: '8 (863) 282-83-64',
    website: '',
    latitude: 47.2042508,
    longitude: 39.7339165,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/ba853fe4-c2be-4c80-be95-53a3d6d4a078/9f3b8b09-3894-4293-9b46-a46d93672d66.jpeg', key: 'objects/ba853fe4-c2be-4c80-be95-53a3d6d4a078/9f3b8b09-3894-4293-9b46-a46d93672d66.jpeg', position: 0 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Баскетбол' },
      { name: 'Спортивная площадка', sportType: 'Бейсбол' },
      { name: 'Спортивный зал', sportType: 'Волейбол' },
      { name: 'Беговые дорожки', sportType: 'Лёгкая атлетика' },
      { name: 'Спортивная площадка', sportType: 'Пляжный волейбол' },
      { name: 'Спортивный зал', sportType: 'Регби' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
      { name: 'Футбольное поле', sportType: 'Хоккей на траве' },
    ]),
  },
  {
    name: 'Филиал ФАУ МО РФ ЦСКА (СКА, г. Ростов-на-Дону)',
    description:
      'Многофункциональный спортивный объект, предназначенный для проведения тренировок, соревнований и физкультурно-оздоровительных занятий. Комплекс ориентирован на подготовку спортсменов по лёгкой атлетике, плаванию, футболу, теннису, тхэквондо и греко-римской борьбе.',
    address: 'г. Ростов-на-Дону, ул. Фурмановская, 150',
    district: District.VOROSHILOVSKY,
    phone: '8(863)235-09-13',
    website: 'https://rostovcska.ru/',
    latitude: 47.2715626,
    longitude: 39.7309516,
    status: SportObjectStatus.PUBLISHED,
    images: [
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/a44b7618-99c1-4df0-92d6-189685612437/aa6034d8-f46f-47b3-94f5-c15b6edf1d19.webp', key: 'objects/a44b7618-99c1-4df0-92d6-189685612437/aa6034d8-f46f-47b3-94f5-c15b6edf1d19.webp', position: 0 },
      { url: 'https://storage.yandexcloud.net/sportgid-photo/objects/a44b7618-99c1-4df0-92d6-189685612437/3c42d022-6996-4d38-836a-5e73ce20252c.jpeg', key: 'objects/a44b7618-99c1-4df0-92d6-189685612437/3c42d022-6996-4d38-836a-5e73ce20252c.jpeg', position: 1 },
    ],
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Беговые дорожки', sportType: 'Лёгкая атлетика' },
      { name: 'Бассейн', sportType: 'Плавание' },
      { name: 'Спортивный зал', sportType: 'Самбо' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба' },
      { name: 'Теннисные корты', sportType: 'Теннис' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
    ]),
  },
];

async function main() {
  console.log('Seeding database...');

  await prisma.media.deleteMany();
  await prisma.sportArea.deleteMany();
  await prisma.sportObject.deleteMany();
  console.log('Cleared old data');

  let created = 0;
  let areasCreated = 0;
  let imagesCreated = 0;

  for (const obj of OBJECTS) {
    const {
      areas: areasList,
      phone,
      website,
      images: imagesList,
      latitude,
      longitude,
      status,
      ...rest
    } = obj;

    const coords =
      latitude != null && longitude != null
        ? { latitude, longitude }
        : await geocodeAddress(obj.address);

    const result = await prisma.sportObject.create({
      data: {
        ...rest,
        phones: parsePhones(phone ?? ''),
        website: website && website.trim().length > 0 ? website.trim() : null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: status ?? SportObjectStatus.PUBLISHED,
        areas: { create: areasList },
        ...(imagesList?.length
          ? {
              images: {
                create: imagesList.map((img, idx) => ({
                  url: img.url,
                  key: img.key,
                  position: img.position ?? idx,
                })),
              },
            }
          : {}),
      },
      include: { areas: true, images: true },
    });
    created++;
    areasCreated += result.areas.length;
    imagesCreated += result.images.length;
  }

  console.log(
    `Created ${created} sport objects, ${areasCreated} areas, ${imagesCreated} images`,
  );
  console.log('Seeding complete ✓');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

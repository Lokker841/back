import 'dotenv/config';
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

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number }> {
  const apiKey = process.env.YANDEX_GEOCODER_API_KEY;
  const normalized = normalizeAddress(address);
  const cached = geocodeCache.get(normalized);
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

const OBJECTS = [
  {
    name: 'МБУ ДО «СШ «Боевые перчатки»»',
    description:
      'Многофункциональный спортивный объект, предназначенный для проведения тренировок, соревнований и физкультурно-оздоровительных занятий. Комплекс ориентирован на подготовку спортсменов по боксу и кикбоксингу, а также проведение спортивно-массовых мероприятий.',
    address: 'г. Ростов-на-Дону, ул. Капустина, 18/1',
    district: District.LENINSKY,
    phone: '8 (863) 233-46-23',
    website: 'https://xn--80abdlbawp4anmz7d9b.xn--p1ai/',
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
    district: District.OKTYABRSKY,
    phone: '8 (863) 201-38-00',
    website: 'https://dussh10rostov.ru/',
    areas: areas([
      { name: 'Бассейн', sportType: 'Плавание' },
      { name: 'Бассейн', sportType: 'Синхронное плавание' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Спортивный зал', sportType: 'Бокс' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 35 им. братьев Самургашевых»',
    description:
      'Многофункциональный спортивный объект, предназначенный для проведения тренировок, соревнований и физкультурно-оздоровительных занятий. Комплекс ориентирован на подготовку спортсменов по вольной и греко-римской борьбе, тяжёлой атлетике и художественной гимнастике.',
    address: 'г. Ростов-на-Дону, ул. Волкова, 18',
    district: District.LENINSKY,
    phone: '8 (863) 240-94-45',
    website: 'https://sdushor-35.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (вольная)' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
      { name: 'Спортивный зал', sportType: 'Тяжёлая атлетика' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «ПАСШ № 27»',
    description:
      'Многофункциональный спортивный объект для лиц с ограниченными возможностями здоровья. Комплекс ориентирован на подготовку спортсменов по адаптивным видам спорта: плавание, лёгкая атлетика, настольный теннис, шахматы, шашки, спортивная гимнастика.',
    address: 'г. Ростов-на-Дону, пр-т Королева, 24',
    district: District.SOVETSKY,
    phone: '8 (863) 231-10-40',
    website: 'https://pash27.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Баскетбол' },
      { name: 'Бассейн', sportType: 'Плавание' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо' },
      { name: 'Спортивный зал', sportType: 'Шахматы' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Спортивный зал', sportType: 'Настольный теннис' },
      { name: 'Беговые дорожки', sportType: 'Лёгкая атлетика' },
      { name: 'Спортивный зал', sportType: 'Фехтование' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
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
  {
    name: 'МБУ ДО «Гребной канал «Дон»',
    description:
      'Многофункциональный спортивный объект для подготовки спортсменов по гребному спорту, гребле на байдарках и каноэ, BMX, волейболу, теннису, футболу, триатлону, скалолазанию, шахматам и другим видам спорта.',
    address: 'г. Ростов-на-Дону, ул. Пойменная, 2а',
    district: District.ZHELEZNODOROZHNY,
    phone: '8 (863) 240-50-65',
    website: 'https://grebnoykanal.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Акробатический рок-н-ролл' },
      { name: 'Спортивный зал', sportType: 'Волейбол' },
      { name: 'Гребной бассейн', sportType: 'Гребля на байдарках и каноэ' },
      { name: 'Гребной бассейн', sportType: 'Гребной спорт' },
      { name: 'Скалодром', sportType: 'Скалолазание' },
      { name: 'Теннисные корты', sportType: 'Теннис' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
      { name: 'Спортивный зал', sportType: 'Шахматы' },
      { name: 'Велотрасса', sportType: 'Велоспорт-маунтинбайк (МТБ)' },
      { name: 'Велотрасса', sportType: 'Велоспорт-БМХ' },
    ]),
  },
  {
    name: 'Спортивная школа олимпийского резерва № 5',
    description:
      'Спортивный комплекс, обеспечивающий проведение учебно-тренировочного процесса, соревнований и массовых спортивных мероприятий. На базе объекта развиваются футбол, бейсбол, лёгкая атлетика, баскетбол, волейбол и гандбол.',
    address: 'г. Ростов-на-Дону, ул. Пойменная, 2а',
    district: District.ZHELEZNODOROZHNY,
    phone: '8 (863) 282-83-64',
    website: '',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Баскетбол' },
      { name: 'Спортивная площадка', sportType: 'Бейсбол' },
      { name: 'Спортивный зал', sportType: 'Волейбол' },
      { name: 'Спортивная площадка', sportType: 'Пляжный волейбол' },
      { name: 'Беговые дорожки', sportType: 'Лёгкая атлетика' },
      { name: 'Спортивный зал', sportType: 'Регби' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
      { name: 'Футбольное поле', sportType: 'Хоккей на траве' },
    ]),
  },
  {
    name: 'МБУ ДО СШ № 4',
    description:
      'Спортивный объект, предназначенный для проведения тренировочных занятий, соревнований и физкультурно-оздоровительных мероприятий. На базе школы развиваются футбол, велоспорт, плавание и шахматы.',
    address: 'г. Ростов-на-Дону, ул. Тельмана, 14а',
    district: District.ZHELEZNODOROZHNY,
    phone: '8 (863) 282-83-64',
    website: 'https://sports-school.ru/',
    areas: areas([
      { name: 'Бассейн', sportType: 'Плавание' },
      { name: 'Спортивный зал', sportType: 'Шахматы' },
      { name: 'Велотрасса', sportType: 'Велоспорт' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 11»',
    description:
      'Спортивный объект для подготовки спортсменов по тхэквондо, фехтованию, художественной гимнастике, бильярдному спорту и акробатическому рок-н-роллу.',
    address: 'г. Ростов-на-Дону, ул. Большая Садовая, 127б',
    district: District.LENINSKY,
    phone: '8 (863) 263-54-46',
    website: 'https://osd-11.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Акробатический рок-н-ролл' },
      { name: 'Спортивный зал', sportType: 'Бильярдный спорт' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо (ВТФ)' },
      { name: 'Спортивный зал', sportType: 'Фехтование' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
    ]),
  },
  {
    name: 'МБУ ДО «СШОР № 2»',
    description:
      'Спортивный объект, специализирующийся на подготовке спортсменов по спортивной гимнастике и проведении учебно-тренировочных занятий.',
    address: 'г. Ростов-на-Дону, пер. Беломорский, 16б',
    district: District.PROLETARSKY,
    phone: '8 (863) 291-85-90',
    website: 'https://rostovgymnast.ru/',
    areas: areas([{ name: 'Спортивный зал', sportType: 'Спортивная гимнастика' }]),
  },
  {
    name: 'МБУ ДО «СШ «13»»',
    description:
      'Спортивный объект для проведения учебно-тренировочных занятий и соревнований. Развиваются плавание, кудо, гандбол, тхэквондо, футбол, теннис, самбо, волейбол, спортивная акробатика, спортивная борьба и настольный теннис.',
    address: 'г. Ростов-на-Дону, ул. 26 Июня, 103А/15',
    district: District.OKTYABRSKY,
    phone: '8 (863) 223-83-39',
    website: 'https://dussh13.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Гандбол' },
      { name: 'Спортивный зал', sportType: 'Кудо' },
      { name: 'Спортивный зал', sportType: 'Самбо' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо' },
      { name: 'Бассейн', sportType: 'Плавание' },
      { name: 'Теннисный корт', sportType: 'Теннис' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
      { name: 'Спортивный зал', sportType: 'Волейбол' },
      { name: 'Спортивный зал', sportType: 'Спортивная акробатика' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 3»',
    description:
      'Центр спортивной подготовки, ориентированный на развитие игровых и индивидуальных видов спорта: бадминтон, настольный теннис, теннис и чир спорт.',
    address: 'г. Ростов-на-Дону, пер. Днепровский, 131',
    district: District.PROLETARSKY,
    phone: '8 (863) 223-39-68',
    website: 'https://дюсш-3-ростов.рф/',
    areas: areas([
      { name: 'Теннисный корт', sportType: 'Теннис' },
      { name: 'Спортивный зал', sportType: 'Настольный теннис' },
      { name: 'Бильярдная', sportType: 'Бильярдный спорт' },
      { name: 'Танцевальный зал', sportType: 'Танцевальный спорт' },
      { name: 'Спортивный зал', sportType: 'Бадминтон' },
      { name: 'Спортивный зал', sportType: 'Чир спорт' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 6»',
    description:
      'Спортивная школа, специализирующаяся на игровых видах спорта и подготовке спортсменов. Проводятся тренировки по волейболу, футболу, баскетболу, тхэквондо, дзюдо, кудо, художественной гимнастике.',
    address: 'г. Ростов-на-Дону, ул. Веры Пановой, 27',
    district: District.SOVETSKY,
    phone: '8 (863) 250-82-83',
    website: 'https://дюсш6.рф/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
      { name: 'Спортивный зал', sportType: 'Спортивная акробатика' },
      { name: 'Спортивный зал', sportType: 'Прыжки на батуте' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо' },
      { name: 'Спортивный зал', sportType: 'Кудо' },
    ]),
  },
  {
    name: 'МБУ ДО «СШОР № 8 им. В.В. Понедельника»',
    description:
      'Спортивная школа, специализирующаяся на подготовке спортсменов в видах единоборств: бокс, дзюдо, самбо, вольная и греко-римская борьба. Также развиваются гандбол, гребной спорт, лёгкая атлетика, парусный спорт, скалолазание, теннис, футбол.',
    address: 'г. Ростов-на-Дону, ул. 1-й Конной Армии, 4е',
    district: District.SOVETSKY,
    phone: '8 (863) 242-29-77',
    website: 'https://olimpic8.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Гандбол' },
      { name: 'Гребной канал', sportType: 'Гребной спорт (академическая гребля)' },
      { name: 'Стадион', sportType: 'Лёгкая атлетика' },
      { name: 'Акватория р. Дон', sportType: 'Парусный спорт' },
      { name: 'Скалодром', sportType: 'Скалолазание' },
      { name: 'Теннисный корт', sportType: 'Теннис' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
      { name: 'Спортивный зал', sportType: 'Софтбол' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР «ЦОП № 1»»',
    description:
      'Центр олимпийской подготовки. Развиваются бокс, велоспорт, гребной спорт, гребля на байдарках и каноэ, дзюдо, лёгкая атлетика, парусный спорт, прыжки на батуте, современное пятиборье, спортивная борьба, стрельба из лука, тхэквондо, тяжёлая атлетика, фехтование, художественная гимнастика.',
    address: 'г. Ростов-на-Дону, пр-т Шолохова, 31',
    district: District.SOVETSKY,
    phone: '8 (863) 261-33-08',
    website: 'https://olympicrostov.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Бокс' },
      { name: 'Велотрек', sportType: 'Велоспорт (трек)' },
      { name: 'Гребной канал', sportType: 'Гребной спорт (академическая гребля)' },
      { name: 'Гребной канал', sportType: 'Гребля на байдарках и каноэ' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Стадион', sportType: 'Лёгкая атлетика' },
      { name: 'Акватория р. Дон', sportType: 'Парусный спорт' },
      { name: 'Спортивный зал', sportType: 'Прыжки на батуте' },
      { name: 'Спортивный зал', sportType: 'Современное пятиборье' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (вольная)' },
      { name: 'Площадка для стрельбы', sportType: 'Стрельба из лука' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо (ВТФ)' },
      { name: 'Спортивный зал', sportType: 'Тяжёлая атлетика' },
      { name: 'Спортивный зал', sportType: 'Фехтование' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 22»',
    description:
      'Спортивный объект с бассейном. Развиваются водное поло, конный спорт, плавание, синхронное плавание, современное пятиборье и фехтование.',
    address: 'г. Ростов-на-Дону, ул. 1-й Конной Армии, 6д',
    district: District.SOVETSKY,
    phone: '8 (863) 252-59-89',
    website: 'https://korall-rostov.ru/',
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
    name: 'МБУ ДО «СШ № 11»',
    description:
      'Спортивная школа с широким профилем единоборств и гимнастики. Развиваются кудо, дзюдо, тхэквондо, киокусинкай, чир спорт, акробатический рок-н-ролл, спортивная борьба, прыжки в воду, брейкинг.',
    address: 'г. Ростов-на-Дону',
    district: District.LENINSKY,
    phone: '8 (863) 269-38-85',
    website: 'https://dussh11.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Кудо' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
      { name: 'Спортивный зал', sportType: 'Тхэквондо' },
      { name: 'Спортивный зал', sportType: 'Киокусинкай' },
      { name: 'Спортивный зал', sportType: 'Чир спорт' },
      { name: 'Спортивный зал', sportType: 'Акробатический рок-н-ролл' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (вольная)' },
      { name: 'Бассейн', sportType: 'Прыжки в воду' },
      { name: 'Танцевальный зал', sportType: 'Брейкинг' },
      { name: 'Бильярдная', sportType: 'Бильярдный спорт' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 1»',
    description:
      'Спортивная школа с разнообразной инфраструктурой. Развиваются лёгкая атлетика, пулевая стрельба, дартс и баскетбол.',
    address: 'г. Ростов-на-Дону, пр. 40-летия Победы, 63/14',
    district: District.LENINSKY,
    phone: '8 (863) 257-04-23',
    website: 'https://дсш1-ростов.рф/',
    areas: areas([
      { name: 'Стадион', sportType: 'Лёгкая атлетика' },
      { name: 'Стрелковый тир', sportType: 'Пулевая стрельба' },
      { name: 'Спортивный зал', sportType: 'Дартс' },
      { name: 'Спортивный зал', sportType: 'Баскетбол' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 7»',
    description:
      'Спортивная школа, специализирующаяся на баскетболе и спортивной борьбе.',
    address: 'г. Ростов-на-Дону, ул. Максима Горького, 274',
    district: District.LENINSKY,
    phone: '8 (863) 266-64-57',
    website: 'https://dushrostov-7.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Баскетбол' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 12»',
    description:
      'Спортивный объект с разнообразной инфраструктурой. Развиваются футбол, настольный теннис, акробатический рок-н-ролл, художественная гимнастика, лёгкая атлетика, волейбол.',
    address: 'г. Ростов-на-Дону, ул. 2-я Краснодарская, 149В',
    district: District.PROLETARSKY,
    phone: '8 (863) 207-52-08',
    website: 'https://сш12.рф/',
    areas: areas([
      { name: 'Стадион', sportType: 'Футбол' },
      { name: 'Спортивный зал', sportType: 'Настольный теннис' },
      { name: 'Спортивный зал', sportType: 'Акробатический рок-н-ролл' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
      { name: 'Стадион', sportType: 'Лёгкая атлетика' },
      { name: 'Спортивный зал', sportType: 'Волейбол' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 6»',
    description:
      'Спортивная школа олимпийского резерва, специализирующаяся на зимних видах спорта: фигурное катание на коньках и хоккей.',
    address: 'г. Ростов-на-Дону, пр. Коммунистический, 36/4',
    district: District.LENINSKY,
    phone: '8 (863) 210-35-69',
    website: 'https://zimarostov.ru/',
    areas: areas([
      { name: 'Ледовый каток', sportType: 'Фигурное катание на коньках' },
      { name: 'Ледовый каток', sportType: 'Хоккей' },
    ]),
  },
  {
    name: 'МБУ ДО «СШ № 5»',
    description:
      'Спортивная школа с широким профилем. Развиваются волейбол, гандбол, художественная гимнастика, каратэ, борьба на поясах.',
    address: 'г. Ростов-на-Дону, ул. Загорская, 10',
    district: District.SOVETSKY,
    phone: '8 (863) 680-76-73',
    website: 'https://sport-shkola.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Волейбол' },
      { name: 'Спортивный зал', sportType: 'Гандбол' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
      { name: 'Спортивный зал', sportType: 'Каратэ' },
      { name: 'Спортивный зал', sportType: 'Борьба на поясах' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 19»',
    description:
      'Спортивная школа олимпийского резерва. Развиваются бокс, велоспорт (ВМХ, МТБ, трек, шоссе), пулевая стрельба, стендовая стрельба, стрельба из лука, теннис, футбол.',
    address: 'г. Ростов-на-Дону, пр. Стачки, 28',
    district: District.LENINSKY,
    phone: '8 (863) 236-13-27',
    website: 'https://сшор19.рф/',
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
    name: 'МБУ ДО «СШ № 8»',
    description:
      'Спортивная школа с уклоном в единоборства: спортивная борьба (греко-римская и вольная), бокс, самбо, дзюдо.',
    address: 'г. Ростов-на-Дону, ул. Таганрогская, 118/2',
    district: District.ZHELEZNODOROZHNY,
    phone: '8 (863) 276-98-51',
    website: 'https://olimpic8.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (вольная)' },
      { name: 'Спортивный зал', sportType: 'Бокс' },
      { name: 'Спортивный зал', sportType: 'Самбо' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
    ]),
  },
  {
    name: 'ГБУ ДО РО «СШОР № 1»',
    description: 'Спортивная школа олимпийского резерва. Специализируется на самбо и дзюдо.',
    address: 'г. Ростов-на-Дону, ул. Шеболдаева, 97/2',
    district: District.SOVETSKY,
    phone: '8(863) 283-90-07',
    website: 'https://schor1-rr.ru/',
    areas: areas([
      { name: 'Спортивный зал', sportType: 'Самбо' },
      { name: 'Спортивный зал', sportType: 'Дзюдо' },
    ]),
  },
  {
    name: 'ГБПОУ РО «РОУОР»',
    description:
      'Многопрофильный спортивный объект. Развиваются баскетбол, бокс, водное поло, велоспорт, гандбол, гребной спорт, лёгкая атлетика, парусный спорт, плавание, синхронное плавание, самбо, современное пятиборье, спортивная борьба, спортивная гимнастика, художественная гимнастика, триатлон, фехтование, футбол.',
    address: 'г. Ростов-на-Дону, пр-т Будённовский, 101',
    district: District.LENINSKY,
    phone: '8 (863) 234-50-02',
    website: 'https://rouor.ru/',
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
      { name: 'Бассейн', sportType: 'Синхронное плавание' },
      { name: 'Спортивный зал', sportType: 'Самбо' },
      { name: 'Спортивный зал', sportType: 'Современное пятиборье' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (вольная)' },
      { name: 'Спортивный зал', sportType: 'Спортивная борьба (греко-римская)' },
      { name: 'Спортивный зал', sportType: 'Спортивная гимнастика' },
      { name: 'Спортивный зал', sportType: 'Художественная гимнастика' },
      { name: 'Спортивный зал', sportType: 'Фехтование' },
      { name: 'Футбольное поле', sportType: 'Футбол' },
    ]),
  },
];

async function main() {
  console.log('Seeding database...');

  // Очищаем старые тестовые данные
  await prisma.sportArea.deleteMany();
  await prisma.sportObject.deleteMany();
  console.log('Cleared old data');

  let created = 0;
  let areasCreated = 0;

  for (const obj of OBJECTS) {
    const { areas: areasList, phone: _phone, website: _website, ...rest } = obj;
    const coords = await geocodeAddress(obj.address);
    const result = await prisma.sportObject.create({
      data: {
        ...rest,
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: SportObjectStatus.PUBLISHED,
        areas: { create: areasList },
      },
      include: { areas: true },
    });
    created++;
    areasCreated += result.areas.length;
  }

  console.log(`Created ${created} sport objects with ${areasCreated} areas`);
  console.log('Seeding complete ✓');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

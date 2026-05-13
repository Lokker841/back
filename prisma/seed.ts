import 'dotenv/config';
import { PrismaClient, District, SportObjectStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await Promise.all([
    prisma.sportObject.create({
      data: {
        name: 'Стадион «Олимп»',
        description: 'Многофункциональный спортивный комплекс в центре города',
        address: 'Ростов-на-Дону, ул. Пушкинская, 90',
        district: District.LENINSKY,
        latitude: 47.2224,
        longitude: 39.7186,
        rating: 4.5,
        status: SportObjectStatus.PUBLISHED,
        areas: {
          create: [
            {
              name: 'Футбольное поле №1',
              sportType: 'Футбол',
              pricePerHour: 2500,
              schedule: [
                { dayOfWeek: 1, startTime: '08:00', endTime: '22:00', isAvailable: true },
                { dayOfWeek: 2, startTime: '08:00', endTime: '22:00', isAvailable: true },
                { dayOfWeek: 3, startTime: '08:00', endTime: '22:00', isAvailable: true },
                { dayOfWeek: 4, startTime: '08:00', endTime: '22:00', isAvailable: true },
                { dayOfWeek: 5, startTime: '08:00', endTime: '22:00', isAvailable: true },
                { dayOfWeek: 6, startTime: '09:00', endTime: '20:00', isAvailable: true },
                { dayOfWeek: 0, startTime: '09:00', endTime: '20:00', isAvailable: true },
              ],
            },
            {
              name: 'Теннисный корт №1',
              sportType: 'Теннис',
              pricePerHour: 1200,
              schedule: [
                { dayOfWeek: 1, startTime: '07:00', endTime: '21:00', isAvailable: true },
                { dayOfWeek: 6, startTime: '08:00', endTime: '20:00', isAvailable: true },
              ],
            },
          ],
        },
      },
    }),
    prisma.sportObject.create({
      data: {
        name: 'СК «Динамо»',
        description: 'Спортивный клуб с бассейном и залами единоборств',
        address: 'Ростов-на-Дону, пр. Стачки, 201',
        district: District.OKTYABRSKY,
        latitude: 47.2301,
        longitude: 39.689,
        rating: 4.2,
        status: SportObjectStatus.PUBLISHED,
        areas: {
          create: [
            {
              name: 'Бассейн 25м',
              sportType: 'Плавание',
              pricePerHour: 800,
              schedule: [
                { dayOfWeek: 1, startTime: '06:00', endTime: '22:00', isAvailable: true },
                { dayOfWeek: 3, startTime: '06:00', endTime: '22:00', isAvailable: true },
                { dayOfWeek: 5, startTime: '06:00', endTime: '22:00', isAvailable: true },
              ],
            },
            {
              name: 'Зал борьбы',
              sportType: 'Единоборства',
              pricePerHour: 600,
              schedule: [
                { dayOfWeek: 2, startTime: '10:00', endTime: '21:00', isAvailable: true },
                { dayOfWeek: 4, startTime: '10:00', endTime: '21:00', isAvailable: true },
              ],
            },
          ],
        },
      },
    }),
    prisma.sportObject.create({
      data: {
        name: 'Спортзал «Чемпион»',
        description: 'Тренажерный зал и зал групповых занятий',
        address: 'Ростов-на-Дону, ул. Красноармейская, 25',
        district: District.VOROSHILOVSKY,
        rating: 3.8,
        status: SportObjectStatus.DRAFT,
        areas: {
          create: [
            {
              name: 'Тренажерный зал',
              sportType: 'Фитнес',
              pricePerHour: 400,
              schedule: [],
            },
          ],
        },
      },
    }),
  ]);

  console.log('Created 3 sport objects with areas');
  console.log('Seeding complete ✓');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

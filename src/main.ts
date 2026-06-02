import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ClusterService } from './cluster.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Заменяем встроенный NestJS logger на Winston
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Спорт Гид Ростов API')
    .setDescription(
      'Реестр спортивных объектов Ростова-на-Дону.\n\n' +
      '**Публичные эндпоинты:**\n' +
      '- `GET /api/v1/catalog` — список опубликованных объектов (`limit`, `offset`)\n' +
      '- `GET /api/v1/catalog/sports` — уникальные виды спорта\n' +
      '- `GET /api/v1/catalog/:id` — карточка объекта\n' +
      '- `GET /api/v1/search` — поиск и фильтры (`q`, `district`, `sport`)\n\n' +
      '**Админ (JWT Bearer):**\n' +
      '- CRUD объектов и площадок\n' +
      '- `POST /api/v1/admin/objects/:id/images` — загрузка фото (multipart `files[]`)\n' +
      '- `DELETE /api/v1/admin/objects/:id/images/:mediaId` — удаление фото\n' +
      '- `PATCH /api/v1/admin/objects/:id/images/reorder` — порядок фото (`orderedIds`)\n\n' +
      'В публичных ответах (catalog/search) фото — только `imageUrls` (ссылки S3). ' +
      'Поля `phones` и `imageUrls` всегда массивы, `website`/`description`/`latitude`/`longitude` — `null`, если не заданы.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('catalog', 'Публичный каталог объектов')
    .addTag('search', 'Поиск объектов')
    .addTag('admin', 'Панель администрирования')
    .addTag('geo', 'Геокодирование')
    .addTag('auth', 'Авторизация')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

// В development — обычный запуск (совместим с nest --watch)
// В production  — кластерный запуск (по числу CPU ядер)
if (process.env.NODE_ENV === 'production') {
  ClusterService.clusterize(bootstrap);
} else {
  void bootstrap();
}

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
    .setDescription('Реестр спортивных объектов Ростова-на-Дону')
    .setVersion('1.0')
    .addTag('catalog', 'Публичный каталог объектов')
    .addTag('search', 'Поиск объектов')
    .addTag('admin', 'Панель администрирования')
    .addTag('geo', 'Геокодирование')
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

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { createKeyv } from '@keyv/redis';
import { Keyv } from 'keyv';
import { CacheableMemory } from 'cacheable';
import { PrismaModule } from './prisma/prisma.module';
import { CatalogModule } from './catalog/catalog.module';
import { SearchModule } from './search/search.module';
import { GeoModule } from './geo/geo.module';
import { AdminModule } from './admin/admin.module';
import { MetricsModule } from './metrics/metrics.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';

const isDev = process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: isDev
            ? winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'HH:mm:ss' }),
                winston.format.printf(
                  ({ level, message, timestamp, context }) =>
                    `${timestamp} [${context ?? 'App'}] ${level}: ${message}`,
                ),
              )
            : winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
              ),
        }),
        // Прямая отправка логов в Elasticsearch (работает на всех платформах без Filebeat)
        new ElasticsearchTransport({
          level: 'info',
          indexPrefix: 'sportgid-logs',
          clientOpts: {
            node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
          },
          transformer: (logData) => {
            const d = logData as unknown as Record<string, unknown>;
            return {
              '@timestamp': new Date().toISOString(),
              severity: logData.level,
              message: logData.message,
              context: d['context'] ?? 'App',
              service: 'sportgid-backend',
              environment: process.env.NODE_ENV ?? 'development',
              ...(d['meta'] as object ?? {}),
            };
          },
        }),
      ],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = config.get<number>('REDIS_PORT', 6379);
        const ttl = config.get<number>('REDIS_TTL', 300);
        return {
          stores: [
            new Keyv({
              store: new CacheableMemory({ ttl: 30000, lruSize: 5000 }),
            }),
            createKeyv(`redis://${host}:${port}`),
          ],
          ttl,
        };
      },
    }),
    PrismaModule,
    AuthModule,
    StorageModule,
    CatalogModule,
    SearchModule,
    GeoModule,
    AdminModule,
    MetricsModule,
  ],
})
export class AppModule {}

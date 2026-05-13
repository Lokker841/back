import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { createKeyv } from '@keyv/redis';
import { Keyv } from 'keyv';
import { CacheableMemory } from 'cacheable';
import { PrismaModule } from './prisma/prisma.module';
import { CatalogModule } from './catalog/catalog.module';
import { SearchModule } from './search/search.module';
import { GeoModule } from './geo/geo.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
    CatalogModule,
    SearchModule,
    GeoModule,
    AdminModule,
  ],
})
export class AppModule {}

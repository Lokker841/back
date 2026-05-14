import cluster from 'node:cluster';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

interface GeocoderResponse {
  response: {
    GeoObjectCollection: {
      featureMember: Array<{
        GeoObject: {
          Point: { pos: string };
        };
      }>;
    };
  };
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async geocodeAddress(address: string): Promise<Coordinates | null> {
    const apiKey = this.configService.get<string>('YANDEX_GEOCODER_API_KEY');
    const baseUrl = this.configService.get<string>(
      'YANDEX_GEOCODER_URL',
      'https://geocode-maps.yandex.ru/1.x',
    );

    if (!apiKey || apiKey === 'your_api_key_here') {
      this.logger.warn(
        `Yandex Geocoder API key not set, skipping geocoding for: ${address}`,
      );
      return null;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<GeocoderResponse>(baseUrl, {
          params: {
            apikey: apiKey,
            geocode: address,
            format: 'json',
            results: 1,
          },
        }),
      );

      const members =
        response.data.response.GeoObjectCollection.featureMember;

      if (!members.length) {
        this.logger.warn(`No geocoding result for address: ${address}`);
        return null;
      }

      const pos = members[0].GeoObject.Point.pos;
      const [lonStr, latStr] = pos.split(' ');
      return {
        latitude: parseFloat(latStr),
        longitude: parseFloat(lonStr),
      };
    } catch (error) {
      this.logger.error(
        `Geocoding failed for address "${address}": ${(error as Error).message}`,
      );
      return null;
    }
  }

  async geocodeObject(objectId: string): Promise<void> {
    const object = await this.prisma.sportObject.findUnique({
      where: { id: objectId },
      select: { id: true, address: true },
    });

    if (!object) return;

    const coords = await this.geocodeAddress(object.address);
    if (!coords) return;

    await this.prisma.sportObject.update({
      where: { id: objectId },
      data: { latitude: coords.latitude, longitude: coords.longitude },
    });

    this.logger.log(
      `Geocoded object ${objectId}: lat=${coords.latitude}, lon=${coords.longitude}`,
    );
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON)
  async refreshAllCoordinates(): Promise<void> {
    // В кластерном режиме задача выполняется только в воркере #1,
    // чтобы избежать N параллельных запусков геокодинга
    if (cluster.isWorker && cluster.worker?.id !== 1) return;

    this.logger.log('Starting monthly geocoding refresh...');

    const objects = await this.prisma.sportObject.findMany({
      select: { id: true, address: true },
    });

    let updated = 0;
    for (const obj of objects) {
      const coords = await this.geocodeAddress(obj.address);
      if (coords) {
        await this.prisma.sportObject.update({
          where: { id: obj.id },
          data: { latitude: coords.latitude, longitude: coords.longitude },
        });
        updated++;
      }
    }

    this.logger.log(
      `Monthly geocoding refresh complete: ${updated}/${objects.length} objects updated`,
    );
  }
}

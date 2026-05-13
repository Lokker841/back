import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GeoService } from './geo.service';
import { GEOCODE_RESULT_EXAMPLE } from '../common/swagger/response-examples';

class GeocodeDto {
  @ApiProperty({
    description: 'Адрес для геокодирования через Yandex Maps API',
    example: 'Ростов-на-Дону, ул. Пушкинская, 90',
  })
  @IsString()
  address: string;
}

class RefreshObjectDto {
  @ApiProperty({
    description: 'UUID объекта, для которого нужно обновить координаты',
    example: '6ead6880-7bad-4472-a2af-1edefccf99e7',
  })
  @IsString()
  objectId: string;
}

@ApiTags('geo')
@Controller({ path: 'geo', version: '1' })
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Post('geocode')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Геокодировать адрес',
    description:
      'Отправляет адрес в Yandex Maps Geocoder API и возвращает координаты. ' +
      'Возвращает `null`, если ключ API не задан или адрес не найден.',
  })
  @ApiBody({
    type: GeocodeDto,
    examples: {
      pushkinskaya: {
        summary: 'Улица Пушкинская',
        value: { address: 'Ростов-на-Дону, ул. Пушкинская, 90' },
      },
      prospekt: {
        summary: 'Проспект Стачки',
        value: { address: 'Ростов-на-Дону, пр. Стачки, 201' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Координаты адреса или null, если адрес не найден / API недоступен',
    schema: {
      oneOf: [
        {
          description: 'Координаты найдены',
          example: GEOCODE_RESULT_EXAMPLE,
        },
        {
          description: 'Адрес не геокодирован (API ключ не задан или адрес не найден)',
          example: null,
          nullable: true,
        },
      ],
    },
  })
  geocode(@Body() body: GeocodeDto) {
    return this.geoService.geocodeAddress(body.address);
  }

  @Post('refresh-object')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Обновить координаты одного объекта',
    description:
      'Геокодирует адрес конкретного объекта и записывает координаты в БД. ' +
      'Запускается автоматически при создании объекта без координат.',
  })
  @ApiBody({
    type: RefreshObjectDto,
    examples: {
      example: {
        summary: 'Обновление объекта',
        value: { objectId: '6ead6880-7bad-4472-a2af-1edefccf99e7' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Координаты обновлены (void)',
    schema: { example: null },
  })
  @ApiResponse({
    status: 404,
    description: 'Объект с таким ID не существует',
    schema: {
      example: {
        statusCode: 404,
        error: 'Not Found',
        message: 'Объект 6ead6880-7bad-4472-a2af-1edefccf99e7 не найден',
        path: '/api/v1/geo/refresh-object',
        timestamp: '2026-05-13T15:00:00.000Z',
      },
    },
  })
  refreshObject(@Body() body: RefreshObjectDto) {
    return this.geoService.geocodeObject(body.objectId);
  }

  @Post('refresh-all')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Запустить пересчёт координат всех объектов',
    description:
      'Асинхронно геокодирует **все** объекты в БД. Запускается немедленно и работает фоново. ' +
      'Также выполняется автоматически по расписанию 1-го числа каждого месяца в 12:00.',
  })
  @ApiResponse({
    status: 200,
    description: 'Задача запущена асинхронно',
    schema: {
      example: { message: 'Geocoding refresh started' },
    },
  })
  refreshAll() {
    void this.geoService.refreshAllCoordinates();
    return { message: 'Geocoding refresh started' };
  }
}

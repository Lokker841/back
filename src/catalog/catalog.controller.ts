import {
  Controller,
  Get,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import {
  CATALOG_LIST_EXAMPLE,
  SPORT_OBJECT_EXAMPLE,
  ERROR_404_OBJECT,
} from '../common/swagger/response-examples';

@ApiTags('catalog')
@UseInterceptors(CacheInterceptor)
@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @CacheTTL(300)
  @ApiOperation({
    summary: 'Список спортивных объектов',
    description:
      'Возвращает постраничный список **опубликованных** объектов без фильтров. ' +
      'Для поиска и фильтрации по району/виду спорта используйте `/api/v1/search`. ' +
      'Результат кэшируется в Redis на 5 минут.\n\n' +
      'Примеры запросов:\n' +
      '- `/api/v1/catalog?limit=20&offset=0`\n' +
      '- `/api/v1/catalog?limit=100&offset=200`',
  })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Кол-во записей (1–100)' })
  @ApiQuery({ name: 'offset', required: false, example: 0, description: 'Смещение для пагинации' })
  @ApiResponse({
    status: 200,
    description: 'Список опубликованных объектов с пагинацией',
    schema: {
      example: CATALOG_LIST_EXAMPLE,
    },
  })
  findAll(@Query() query: CatalogQueryDto) {
    return this.catalogService.findAll(query);
  }

  @Get('sports')
  @CacheTTL(300)
  @ApiOperation({
    summary: 'Список всех видов спорта',
    description:
      'Возвращает уникальный список видов спорта по **опубликованным** объектам каталога. ' +
      'Результат кэшируется в Redis на 5 минут.',
  })
  @ApiResponse({
    status: 200,
    description: 'Уникальные виды спорта',
    schema: {
      example: ['Баскетбол', 'Бокс', 'Плавание', 'Футбол'],
    },
  })
  findSports() {
    return this.catalogService.findSports();
  }

  @Get(':id')
  @CacheTTL(600)
  @ApiOperation({
    summary: 'Карточка спортивного объекта',
    description:
      'Возвращает полную карточку объекта включая все площадки (`areas`) ' +
      'и ссылки на фото в S3 (`imageUrls`, в порядке загрузки). ' +
      'Кэшируется в Redis на 10 минут.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID спортивного объекта',
    example: '6ead6880-7bad-4472-a2af-1edefccf99e7',
  })
  @ApiResponse({
    status: 200,
    description: 'Карточка объекта со всеми площадками и медиа',
    schema: {
      example: SPORT_OBJECT_EXAMPLE,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Объект с указанным ID не найден',
    schema: {
      example: ERROR_404_OBJECT,
    },
  })
  findOne(@Param('id') id: string) {
    return this.catalogService.findOne(id);
  }
}

import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
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
      'Возвращает постраничный список **опубликованных** объектов с фильтрацией по ' +
      'району и виду спорта. Результат кэшируется в Redis на 5 минут.',
  })
  @ApiQuery({ name: 'district', required: false, enum: ['LENINSKY', 'OKTYABRSKY', 'VOROSHILOVSKY', 'KIROVSKY', 'PERVOMAYSKY', 'PROLETARSKY', 'SOVETSKY', 'ZHELEZNODOROZHNY'], description: 'Район города' })
  @ApiQuery({ name: 'sport', required: false, example: 'Футбол', description: 'Вид спорта (частичное совпадение)' })
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

  @Get(':id')
  @CacheTTL(600)
  @ApiOperation({
    summary: 'Карточка спортивного объекта',
    description:
      'Возвращает полную карточку объекта включая все площадки (`areas`) и медиафайлы (`images`). ' +
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
  async findOne(@Param('id') id: string) {
    const object = await this.catalogService.findOne(id);
    if (!object) {
      throw new NotFoundException(`Объект с id ${id} не найден`);
    }
    return object;
  }
}

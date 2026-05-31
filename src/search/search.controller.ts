import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SEARCH_RESULT_EXAMPLE } from '../common/swagger/response-examples';

@ApiTags('search')
@UseInterceptors(CacheInterceptor)
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @CacheTTL(120)
  @ApiOperation({
    summary: 'Поиск и фильтрация спортивных объектов',
    description:
      'Единая точка поиска и фильтрации по опубликованным объектам. ' +
      'Первый этап: выборка из БД по индексированным полям (status, district). ' +
      'Второй этап: in-memory фильтрация по `q` и `sport`.\n\n' +
      '**Параметр `q`** (опционально) ищет одновременно по:\n' +
      '- названию объекта\n' +
      '- описанию объекта\n' +
      '- адресу объекта\n' +
      '- виду спорта любой из площадок объекта\n\n' +
      '**Параметры `district` и `sport`** можно использовать отдельно или вместе с `q`. ' +
      'Все параметры комбинируются через **AND**. Кэш 2 минуты.',
  })
  @ApiQuery({ name: 'q', required: false, example: 'Футбол', description: 'Текстовый поиск (мин. 2 символа)' })
  @ApiQuery({ name: 'district', required: false, example: 'LENINSKY', description: 'Фильтр по району города' })
  @ApiQuery({ name: 'sport', required: false, example: 'Теннис', description: 'Фильтр по виду спорта (частичное совпадение)' })
  @ApiResponse({
    status: 200,
    description: 'Массив найденных объектов с общим количеством совпадений',
    schema: {
      example: SEARCH_RESULT_EXAMPLE,
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации: параметр `q` короче 2 символов или передан невалидный district',
    schema: {
      example: {
        statusCode: 400,
        error: 'Bad Request',
        message: ['q must be longer than or equal to 2 characters'],
        path: '/api/v1/search',
        timestamp: '2026-05-13T15:00:00.000Z',
      },
    },
  })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }
}

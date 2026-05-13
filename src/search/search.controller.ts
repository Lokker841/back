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
    summary: 'Поиск спортивных объектов',
    description:
      'Двухэтапный поиск: сначала выбирает кандидатов из PostgreSQL по переданным фильтрам, ' +
      'затем применяет дополнительную фильтрацию в памяти для точного совпадения. ' +
      'Работает только по **опубликованным** объектам. Кэш 2 минуты.',
  })
  @ApiQuery({ name: 'q', required: false, example: 'Олимп', description: 'Текстовый поиск по названию, описанию, адресу (мин. 2 символа)' })
  @ApiQuery({ name: 'district', required: false, example: 'LENINSKY', description: 'Район города' })
  @ApiQuery({ name: 'sport', required: false, example: 'Теннис', description: 'Вид спорта (частичное совпадение)' })
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

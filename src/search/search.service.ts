import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { Prisma, SportObjectStatus } from '@prisma/client';
import { sportObjectInclude } from '../common/prisma/includes';
import { normalizeSportObjects } from '../common/serializers/sport-object.serializer';

type SportObjectWithRelations = Awaited<
  ReturnType<SearchService['fetchCandidates']>
>[number];

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchQueryDto) {
    const candidates = await this.fetchCandidates(query);
    const results = this.applyInMemoryFilters(candidates, query);
    const items = normalizeSportObjects(results);
    return { items, total: items.length };
  }

  /**
   * DB-слой: фильтрует только по проиндексированным полям (status, district).
   * Текстовый поиск и фильтр по виду спорта — в in-memory, чтобы охватить
   * и название объекта, и sportType его площадок одним запросом.
   */
  private async fetchCandidates(query: SearchQueryDto) {
    const where: Prisma.SportObjectWhereInput = {
      status: SportObjectStatus.PUBLISHED,
    };

    if (query.district) {
      where.district = query.district;
    }

    return this.prisma.sportObject.findMany({
      where,
      include: sportObjectInclude,
      orderBy: { rating: 'desc' },
      take: 500,
    });
  }

  /**
   * In-memory: применяет текстовый поиск и фильтр по виду спорта.
   *
   * Параметр `q` ищет по:
   *   - названию объекта
   *   - описанию объекта
   *   - адресу объекта
   *   - виду спорта любой из площадок объекта
   *
   * Параметр `sport` — дополнительный явный фильтр только по виду спорта
   * (используется независимо от `q`, комбинируется через AND).
   */
  private applyInMemoryFilters(
    candidates: SportObjectWithRelations[],
    query: SearchQueryDto,
  ): SportObjectWithRelations[] {
    let results = candidates;

    if (query.q) {
      const qLower = query.q.toLowerCase();
      results = results.filter(
        (obj) =>
          obj.name.toLowerCase().includes(qLower) ||
          (obj.description?.toLowerCase().includes(qLower) ?? false) ||
          obj.address.toLowerCase().includes(qLower) ||
          obj.areas.some((area) =>
            area.sportType.toLowerCase().includes(qLower),
          ),
      );
    }

    if (query.sport) {
      const sportLower = query.sport.toLowerCase();
      results = results.filter((obj) =>
        obj.areas.some((area) =>
          area.sportType.toLowerCase().includes(sportLower),
        ),
      );
    }

    return results;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { District, SportObjectStatus } from '@prisma/client';

type SportObjectWithRelations = Awaited<
  ReturnType<SearchService['fetchCandidates']>
>[number];

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchQueryDto) {
    const candidates = await this.fetchCandidates(query);
    const results = this.applyInMemoryFilters(candidates, query);
    return { items: results, total: results.length };
  }

  private async fetchCandidates(query: SearchQueryDto) {
    const where: {
      status: SportObjectStatus;
      district?: District;
      name?: { contains: string; mode: 'insensitive' };
    } = {
      status: SportObjectStatus.PUBLISHED,
    };

    if (query.district) {
      where.district = query.district;
    }

    if (query.q) {
      where.name = { contains: query.q, mode: 'insensitive' };
    }

    return this.prisma.sportObject.findMany({
      where,
      include: { areas: true, images: true },
      orderBy: { rating: 'desc' },
      take: 200,
    });
  }

  private applyInMemoryFilters(
    candidates: SportObjectWithRelations[],
    query: SearchQueryDto,
  ): SportObjectWithRelations[] {
    let results = candidates;

    if (query.sport) {
      const sportLower = query.sport.toLowerCase();
      results = results.filter((obj) =>
        obj.areas.some((area) =>
          area.sportType.toLowerCase().includes(sportLower),
        ),
      );
    }

    if (query.q) {
      const qLower = query.q.toLowerCase();
      results = results.filter(
        (obj) =>
          obj.name.toLowerCase().includes(qLower) ||
          (obj.description?.toLowerCase().includes(qLower) ?? false) ||
          obj.address.toLowerCase().includes(qLower),
      );
    }

    return results;
  }
}

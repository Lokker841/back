import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { District } from '@prisma/client';

export class CatalogQueryDto {
  @ApiPropertyOptional({
    description: 'Фильтр по административному району Ростова-на-Дону',
    enum: District,
    example: 'LENINSKY',
  })
  @IsEnum(District)
  @IsOptional()
  district?: District;

  @ApiPropertyOptional({
    description: 'Фильтр по виду спорта (частичное совпадение)',
    example: 'Футбол',
  })
  @IsString()
  @IsOptional()
  sport?: string;

  @ApiPropertyOptional({
    description: 'Максимальное количество записей в ответе',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 10,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Смещение для постраничной навигации',
    default: 0,
    minimum: 0,
    example: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}

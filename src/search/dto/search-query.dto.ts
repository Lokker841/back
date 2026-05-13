import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { District } from '@prisma/client';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Строка поиска по названию, описанию и адресу объекта (минимум 2 символа)',
    minLength: 2,
    example: 'Олимп',
  })
  @IsString()
  @MinLength(2)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по административному району',
    enum: District,
    example: 'LENINSKY',
  })
  @IsEnum(District)
  @IsOptional()
  district?: District;

  @ApiPropertyOptional({
    description: 'Фильтр по виду спорта (частичное совпадение)',
    example: 'Теннис',
  })
  @IsString()
  @IsOptional()
  sport?: string;
}

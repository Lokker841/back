import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { District } from '@prisma/client';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description:
      'Строка поиска (минимум 2 символа). Ищет по: ' +
      'названию объекта, описанию, адресу, а также по виду спорта ' +
      'любой из площадок объекта. Можно не передавать, если нужна только фильтрация.',
    minLength: 2,
    example: 'Олимп',
  })
  @IsString()
  @MinLength(2)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по административному району города',
    enum: District,
    example: 'LENINSKY',
  })
  @IsEnum(District)
  @IsOptional()
  district?: District;

  @ApiPropertyOptional({
    description:
      'Фильтр по виду спорта (частичное совпадение). ' +
      'Работает отдельно или вместе с q и district.',
    example: 'Теннис',
  })
  @IsString()
  @IsOptional()
  sport?: string;
}

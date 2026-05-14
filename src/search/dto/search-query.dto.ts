import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { District } from '@prisma/client';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description:
      'Строка поиска (минимум 2 символа). Ищет по: ' +
      'названию объекта, описанию, адресу, а также по виду спорта ' +
      'любой из площадок объекта. Например, запрос "Футбол" найдёт ' +
      'и объекты с "Футбол" в названии, и объекты с футбольными площадками.',
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
      'Дополнительный фильтр строго по виду спорта (частичное совпадение). ' +
      'Комбинируется с q и district через AND.',
    example: 'Теннис',
  })
  @IsString()
  @IsOptional()
  sport?: string;
}

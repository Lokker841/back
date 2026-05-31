import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CatalogQueryDto {
  @ApiPropertyOptional({
    description: 'Максимальное количество записей в ответе',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { District } from '@prisma/client';

export class CreateObjectDto {
  @ApiProperty({
    description: 'Название спортивного объекта',
    maxLength: 255,
    example: 'Стадион «Олимп»',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Подробное описание объекта',
    example: 'Многофункциональный спортивный комплекс в центре города',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Полный адрес объекта',
    maxLength: 500,
    example: 'Ростов-на-Дону, ул. Пушкинская, 90',
  })
  @IsString()
  @MaxLength(500)
  address: string;

  @ApiProperty({
    description: 'Административный район Ростова-на-Дону',
    enum: District,
    example: 'LENINSKY',
  })
  @IsEnum(District)
  district: District;

  @ApiPropertyOptional({
    description: 'Широта (заполняется автоматически через Yandex Geocoder)',
    example: 47.2224,
  })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Долгота (заполняется автоматически через Yandex Geocoder)',
    example: 39.7186,
  })
  @IsNumber()
  @IsOptional()
  longitude?: number;
}

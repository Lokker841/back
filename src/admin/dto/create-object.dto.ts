import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ArrayMaxSize,
  ArrayUnique,
  IsNotEmpty,
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

  @ApiPropertyOptional({
    description: 'Контактные телефоны объекта (можно несколько)',
    example: ['8 (863) 233-46-23', '8 (863) 233-40-00'],
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  @IsOptional()
  phones?: string[];

  @ApiPropertyOptional({
    description: 'Сайт объекта',
    example: 'https://rostovcska.ru/',
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({
    description: 'Ссылки на изображения объекта',
    example: ['https://example.com/image-1.jpg', 'https://example.com/image-2.jpg'],
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsUrl({}, { each: true })
  @IsOptional()
  imageUrls?: string[];
}

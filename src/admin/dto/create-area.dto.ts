import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ScheduleSlotDto {
  @ApiProperty({
    description: 'День недели: 0 = Воскресенье, 1 = Понедельник, ..., 6 = Суббота',
    minimum: 0,
    maximum: 6,
    example: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;

  @ApiProperty({
    description: 'Время начала работы в формате HH:mm',
    example: '09:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @ApiProperty({
    description: 'Время окончания работы в формате HH:mm',
    example: '21:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @ApiProperty({
    description: 'Доступна ли площадка в данный слот',
    example: true,
  })
  @IsBoolean()
  isAvailable: boolean;

  @ApiPropertyOptional({
    description: 'Переопределение цены (₽/час) для конкретного слота',
    example: 3000,
  })
  @IsNumber()
  @IsOptional()
  priceOverride?: number;
}

export class CreateAreaDto {
  @ApiProperty({
    description: 'UUID спортивного объекта, которому принадлежит площадка',
    example: '6ead6880-7bad-4472-a2af-1edefccf99e7',
  })
  @IsString()
  objectId: string;

  @ApiProperty({
    description: 'Название площадки',
    maxLength: 255,
    example: 'Футбольное поле №1',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Вид спорта',
    maxLength: 100,
    example: 'Футбол',
  })
  @IsString()
  @MaxLength(100)
  sportType: string;

  @ApiProperty({
    description: 'Базовая стоимость аренды в рублях за час',
    minimum: 0,
    example: 2500,
  })
  @IsNumber()
  @Min(0)
  pricePerHour: number;

  @ApiPropertyOptional({
    description: 'Расписание работы площадки по слотам',
    type: [ScheduleSlotDto],
    example: [
      { dayOfWeek: 1, startTime: '08:00', endTime: '22:00', isAvailable: true },
      { dayOfWeek: 6, startTime: '09:00', endTime: '20:00', isAvailable: true },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  @IsOptional()
  schedule?: ScheduleSlotDto[];
}

import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SportObjectStatus } from '@prisma/client';
import { CreateObjectDto } from './create-object.dto';

export class UpdateObjectDto extends PartialType(CreateObjectDto) {
  @IsEnum(SportObjectStatus)
  @IsOptional()
  status?: SportObjectStatus;
}

import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateAreaDto } from './create-area.dto';

export class UpdateAreaDto extends PartialType(
  OmitType(CreateAreaDto, ['objectId'] as const),
) {}

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { GeoModule } from '../geo/geo.module';

@Module({
  imports: [GeoModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

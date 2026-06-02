import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { GeoModule } from '../geo/geo.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [GeoModule, StorageModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

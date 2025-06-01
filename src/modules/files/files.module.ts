import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesController } from './controllers/files.controller';
import { FileSortingService } from './services/file-sorting.service';
import { FileEntity } from './entities/file.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity]),
    TenantModule,
  ],
  controllers: [FilesController],
  providers: [FileSortingService],
  exports: [FileSortingService],
})
export class FilesModule {}
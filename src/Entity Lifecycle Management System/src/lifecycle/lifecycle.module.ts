import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AuditLog } from "./entities/audit-log.entity"
import { EntityVersion } from "./entities/entity-version.entity"
import { EntityArchive } from "./entities/entity-archive.entity"
import { AuditService } from "./services/audit.service"
import { VersioningService } from "./services/versioning.service"
import { ArchivingService } from "./services/archiving.service"
import { LifecycleService } from "./services/lifecycle.service"
import { LifecycleSubscriber } from "./subscribers/lifecycle.subscriber"
import { LifecycleListener } from "./listeners/lifecycle.listener"

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, EntityVersion, EntityArchive])],
  providers: [
    AuditService,
    VersioningService,
    ArchivingService,
    LifecycleService,
    LifecycleSubscriber,
    LifecycleListener,
  ],
  exports: [AuditService, VersioningService, ArchivingService, LifecycleService],
})
export class LifecycleModule {}

import { Module } from "@nestjs/common"
import { BullModule } from "@nestjs/bull"
import { ExportService } from "./export.service"
import { ExportProcessor } from "./export.processor"
import { DashboardModule } from "../dashboard/dashboard.module"

@Module({
  imports: [
    BullModule.registerQueue({
      name: "export",
    }),
    DashboardModule,
  ],
  providers: [ExportService, ExportProcessor],
  exports: [ExportService],
})
export class ExportModule {}

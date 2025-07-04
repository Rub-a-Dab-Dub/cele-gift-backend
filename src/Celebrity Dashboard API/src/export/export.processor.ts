import { Process, Processor } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { ExportService, ExportRequest } from "./export.service"

@Processor("export")
export class ExportProcessor {
  private readonly logger = new Logger(ExportProcessor.name)

  constructor(private exportService: ExportService) {}

  @Process("generate-export")
  async handleExport(job: Job<ExportRequest>) {
    const { format, query, userId } = job.data

    this.logger.log(`Processing export job ${job.id} for user ${userId}`)

    try {
      let result: Buffer | string

      switch (format) {
        case "excel":
          result = await this.exportService.generateExcelExport(query)
          break
        case "pdf":
          result = await this.exportService.generatePDFExport(query)
          break
        case "csv":
          result = await this.exportService.generateCSVExport(query)
          break
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }

      // In a real application, you would save the file to cloud storage
      // and send a notification to the user
      this.logger.log(`Export job ${job.id} completed successfully`)

      return { success: true, size: result.length }
    } catch (error) {
      this.logger.error(`Export job ${job.id} failed:`, error)
      throw error
    }
  }
}

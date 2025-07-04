import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bull"
import * as ExcelJS from "exceljs"
import * as PDFDocument from "pdfkit"
import type { DashboardService } from "../dashboard/dashboard.service"
import type { DashboardQueryDto } from "../dashboard/dto/dashboard-query.dto"

export interface ExportRequest {
  format: "excel" | "pdf" | "csv"
  query: DashboardQueryDto
  userId: string
  email?: string
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name)

  constructor(
    private exportQueue: Queue,
    private dashboardService: DashboardService,
  ) {}

  async requestExport(exportRequest: ExportRequest): Promise<string> {
    const job = await this.exportQueue.add("generate-export", exportRequest, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    })

    return job.id.toString()
  }

  async generateExcelExport(query: DashboardQueryDto): Promise<Buffer> {
    const dashboardData = await this.dashboardService.getDashboardData(query)

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "Celebrity Dashboard API"
    workbook.created = new Date()

    // Summary sheet
    const summarySheet = workbook.addWorksheet("Summary")
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 20 },
      { header: "Platform", key: "platform", width: 15 },
      { header: "Average", key: "average", width: 15 },
      { header: "Total", key: "total", width: 15 },
      { header: "Max", key: "max", width: 15 },
      { header: "Min", key: "min", width: 15 },
    ]

    // Add data rows
    Object.entries(dashboardData.metrics).forEach(([metricType, metricData]: [string, any]) => {
      Object.entries(metricData.platforms).forEach(([platform, platformData]: [string, any]) => {
        summarySheet.addRow({
          metric: metricType,
          platform,
          average: platformData.avg,
          total: platformData.total,
          max: platformData.max,
          min: platformData.min,
        })
      })
    })

    // Time series sheet
    const timeSeriesSheet = workbook.addWorksheet("Time Series")
    timeSeriesSheet.columns = [
      { header: "Timestamp", key: "timestamp", width: 20 },
      { header: "Metric Type", key: "metricType", width: 15 },
      { header: "Platform", key: "platform", width: 15 },
      { header: "Value", key: "value", width: 15 },
    ]

    dashboardData.metrics.timeSeries?.forEach((dataPoint: any) => {
      timeSeriesSheet.addRow(dataPoint)
    })

    // Trending sheet
    const trendingSheet = workbook.addWorksheet("Trending Analysis")
    trendingSheet.columns = [
      { header: "Metric", key: "metric", width: 20 },
      { header: "Platform", key: "platform", width: 15 },
      { header: "Trend", key: "trend", width: 10 },
      { header: "Change %", key: "changePercent", width: 15 },
      { header: "Significance", key: "significance", width: 15 },
    ]

    dashboardData.trending?.forEach((trend: any) => {
      trendingSheet.addRow(trend)
    })

    return workbook.xlsx.writeBuffer() as Promise<Buffer>
  }

  async generatePDFExport(query: DashboardQueryDto): Promise<Buffer> {
    const dashboardData = await this.dashboardService.getDashboardData(query)

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument()
      const chunks: Buffer[] = []

      doc.on("data", (chunk) => chunks.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(chunks)))
      doc.on("error", reject)

      // Header
      doc.fontSize(20).text("Celebrity Dashboard Report", 50, 50)
      doc.fontSize(12).text(`Generated: ${new Date().toISOString()}`, 50, 80)

      let yPosition = 120

      // Metrics Summary
      doc.fontSize(16).text("Metrics Summary", 50, yPosition)
      yPosition += 30

      Object.entries(dashboardData.metrics).forEach(([metricType, metricData]: [string, any]) => {
        doc.fontSize(14).text(`${metricType.toUpperCase()}`, 50, yPosition)
        yPosition += 20

        Object.entries(metricData.platforms).forEach(([platform, platformData]: [string, any]) => {
          doc.fontSize(10).text(`${platform}: Avg: ${platformData.avg}, Total: ${platformData.total}`, 70, yPosition)
          yPosition += 15
        })
        yPosition += 10
      })

      // Trending Analysis
      if (dashboardData.trending?.length > 0) {
        doc.fontSize(16).text("Trending Analysis", 50, yPosition)
        yPosition += 30

        dashboardData.trending.forEach((trend: any) => {
          doc
            .fontSize(12)
            .text(
              `${trend.metric} (${trend.platform}): ${trend.trend} ${trend.changePercent.toFixed(2)}%`,
              50,
              yPosition,
            )
          yPosition += 20
        })
      }

      doc.end()
    })
  }

  async generateCSVExport(query: DashboardQueryDto): Promise<string> {
    const dashboardData = await this.dashboardService.getDashboardData(query)

    const csvRows = ["Metric,Platform,Average,Total,Max,Min"]

    Object.entries(dashboardData.metrics).forEach(([metricType, metricData]: [string, any]) => {
      Object.entries(metricData.platforms).forEach(([platform, platformData]: [string, any]) => {
        csvRows.push(
          `${metricType},${platform},${platformData.avg},${platformData.total},${platformData.max},${platformData.min}`,
        )
      })
    })

    return csvRows.join("\n")
  }
}

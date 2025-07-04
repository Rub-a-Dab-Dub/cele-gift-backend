import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from "@nestjs/websockets"
import type { Server, Socket } from "socket.io"
import { Logger } from "@nestjs/common"
import type { MetricsService } from "../metrics/metrics.service"
import type { CacheService } from "../cache/cache.service"

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(RealtimeGateway.name)
  private activeSubscriptions = new Map<string, Set<string>>()

  constructor(
    private metricsService: MetricsService,
    private cacheService: CacheService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)
    this.cleanupSubscriptions(client.id)
  }

  @SubscribeMessage("subscribe_celebrity")
  async handleSubscribeCelebrity(client: Socket, data: { celebrityId: string }) {
    const { celebrityId } = data

    if (!this.activeSubscriptions.has(celebrityId)) {
      this.activeSubscriptions.set(celebrityId, new Set())
    }

    this.activeSubscriptions.get(celebrityId)!.add(client.id)
    client.join(`celebrity:${celebrityId}`)

    // Send initial data
    const initialData = await this.metricsService.getRealTimeMetrics(celebrityId)
    client.emit("celebrity_data", { celebrityId, data: initialData })

    this.logger.log(`Client ${client.id} subscribed to celebrity ${celebrityId}`)
  }

  @SubscribeMessage("unsubscribe_celebrity")
  handleUnsubscribeCelebrity(client: Socket, data: { celebrityId: string }) {
    const { celebrityId } = data

    if (this.activeSubscriptions.has(celebrityId)) {
      this.activeSubscriptions.get(celebrityId)!.delete(client.id)

      if (this.activeSubscriptions.get(celebrityId)!.size === 0) {
        this.activeSubscriptions.delete(celebrityId)
      }
    }

    client.leave(`celebrity:${celebrityId}`)
    this.logger.log(`Client ${client.id} unsubscribed from celebrity ${celebrityId}`)
  }

  async broadcastMetricUpdate(celebrityId: string, metricData: any) {
    const room = `celebrity:${celebrityId}`
    this.server.to(room).emit("metric_update", {
      celebrityId,
      data: metricData,
      timestamp: new Date().toISOString(),
    })
  }

  async broadcastTrendingUpdate(trendingData: any) {
    this.server.emit("trending_update", {
      data: trendingData,
      timestamp: new Date().toISOString(),
    })
  }

  private cleanupSubscriptions(clientId: string) {
    this.activeSubscriptions.forEach((clients, celebrityId) => {
      clients.delete(clientId)
      if (clients.size === 0) {
        this.activeSubscriptions.delete(celebrityId)
      }
    })
  }
}

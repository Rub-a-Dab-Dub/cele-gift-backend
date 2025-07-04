import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common"
import type { DataSource } from "typeorm"
import type { EventEmitter2 } from "@nestjs/event-emitter"
import { Client } from "pg"

export interface PostgresNotification {
  channel: string
  payload: string
  processId: number
}

@Injectable()
export class PostgresNotificationService implements OnModuleDestroy {
  private readonly logger = new Logger(PostgresNotificationService.name)
  private client: Client
  private isConnected = false
  private listeners = new Map<string, Set<(notification: PostgresNotification) => void>>()

  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async initialize(): Promise<void> {
    try {
      // Create a separate client for notifications
      const options = this.dataSource.options as any
      this.client = new Client({
        host: options.host,
        port: options.port,
        user: options.username,
        password: options.password,
        database: options.database,
      })

      await this.client.connect()
      this.isConnected = true

      // Set up notification handler
      this.client.on("notification", (msg) => {
        const notification: PostgresNotification = {
          channel: msg.channel,
          payload: msg.payload,
          processId: msg.processId,
        }

        this.handleNotification(notification)
      })

      this.logger.log("PostgreSQL notification service initialized")
    } catch (error) {
      this.logger.error("Failed to initialize notification service", error)
      throw error
    }
  }

  async listen(channel: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Notification service not initialized")
    }

    await this.client.query(`LISTEN ${channel}`)
    this.logger.log(`Listening to channel: ${channel}`)
  }

  async unlisten(channel: string): Promise<void> {
    if (!this.isConnected) {
      return
    }

    await this.client.query(`UNLISTEN ${channel}`)
    this.listeners.delete(channel)
    this.logger.log(`Stopped listening to channel: ${channel}`)
  }

  async notify(channel: string, payload?: string): Promise<void> {
    const query = payload ? `NOTIFY ${channel}, '${payload.replace(/'/g, "''")}'` : `NOTIFY ${channel}`

    await this.dataSource.query(query)
  }

  addListener(channel: string, callback: (notification: PostgresNotification) => void): void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set())
      this.listen(channel).catch((error) => {
        this.logger.error(`Failed to listen to channel ${channel}`, error)
      })
    }

    this.listeners.get(channel).add(callback)
  }

  removeListener(channel: string, callback: (notification: PostgresNotification) => void): void {
    const channelListeners = this.listeners.get(channel)
    if (channelListeners) {
      channelListeners.delete(callback)

      if (channelListeners.size === 0) {
        this.unlisten(channel).catch((error) => {
          this.logger.error(`Failed to unlisten from channel ${channel}`, error)
        })
      }
    }
  }

  private handleNotification(notification: PostgresNotification): void {
    // Emit event for global listeners
    this.eventEmitter.emit("postgres.notification", notification)
    this.eventEmitter.emit(`postgres.notification.${notification.channel}`, notification)

    // Call registered callbacks
    const channelListeners = this.listeners.get(notification.channel)
    if (channelListeners) {
      channelListeners.forEach((callback) => {
        try {
          callback(notification)
        } catch (error) {
          this.logger.error("Error in notification callback", error)
        }
      })
    }

    this.logger.debug(`Received notification on channel ${notification.channel}: ${notification.payload}`)
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.end()
      this.isConnected = false
      this.logger.log("PostgreSQL notification service disconnected")
    }
  }

  // Utility methods for common notification patterns
  async createTriggerFunction(functionName: string, channel: string, payloadExpression?: string): Promise<void> {
    const payload = payloadExpression || "row_to_json(NEW)::text"

    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION ${functionName}()
      RETURNS TRIGGER AS $$
      BEGIN
        PERFORM pg_notify('${channel}', ${payload});
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)
  }

  async createTableTrigger(
    tableName: string,
    triggerName: string,
    functionName: string,
    events: ("INSERT" | "UPDATE" | "DELETE")[] = ["INSERT", "UPDATE", "DELETE"],
  ): Promise<void> {
    await this.dataSource.query(`
      CREATE TRIGGER ${triggerName}
      AFTER ${events.join(" OR ")} ON ${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION ${functionName}();
    `)
  }
}

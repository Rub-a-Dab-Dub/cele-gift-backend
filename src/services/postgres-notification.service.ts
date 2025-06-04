import { Client } from 'pg';
import { EventEmitter } from 'events';
import { NotificationPayload } from '../types/postgres.types';

export class PostgreSQLNotificationService extends EventEmitter {
  private client: Client;
  private isConnected = false;

  constructor(connectionConfig: any) {
    super();
    this.client = new Client(connectionConfig);
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    await this.client.connect();
    this.isConnected = true;

    this.client.on('notification', (msg) => {
      const payload: NotificationPayload = {
        channel: msg.channel,
        payload: msg.payload || '',
        processId: msg.processId
      };
      this.emit('notification', payload);
      this.emit(msg.channel, payload);
    });

    this.client.on('error', (err) => {
      console.error('PostgreSQL notification client error:', err);
      this.emit('error', err);
    });
  }

  async listen(channel: string): Promise<void> {
    await this.ensureConnected();
    await this.client.query(`LISTEN ${channel}`);
  }

  async unlisten(channel: string): Promise<void> {
    await this.ensureConnected();
    await this.client.query(`UNLISTEN ${channel}`);
  }

  async notify(channel: string, payload?: string): Promise<void> {
    await this.ensureConnected();
    const query = payload 
      ? `NOTIFY ${channel}, '${payload.replace(/'/g, "''")}'`
      : `NOTIFY ${channel}`;
    await this.client.query(query);
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.end();
      this.isConnected = false;
    }
  }
}

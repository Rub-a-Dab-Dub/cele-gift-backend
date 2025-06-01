import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AlertRule, AlertSeverity } from '../entities/alert-rule.entity';
import * as nodemailer from 'nodemailer';

export interface AlertPayload {
  type: string;
  severity: AlertSeverity | string;
  message: string;
  value: number;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private emailTransporter: nodemailer.Transporter;
  private notificationChannels: Map<string, NotificationChannel> = new Map();

  constructor(
    @InjectRepository(AlertRule)
    private alertRuleRepository: Repository<AlertRule>,
    private configService: ConfigService,
  ) {
    this.initializeNotificationChannels();
  }

  private initializeNotificationChannels(): void {
    // Email configuration
    if (this.configService.get('SMTP_HOST')) {
      this.emailTransporter = nodemailer.createTransporter({
        host: this.configService.get('SMTP_HOST'),
        port: this.configService.get('SMTP_PORT', 587),
        secure: this.configService.get('SMTP_SECURE', false),
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });

      this.notificationChannels.set('email', {
        type: 'email',
        config: {
          from: this.configService.get('ALERT_EMAIL_FROM'),
          to: this.configService.get('ALERT_EMAIL_TO', '').split(','),
        },
        enabled: true,
      });
    }

    // Slack configuration
    if (this.configService.get('SLACK_WEBHOOK_URL')) {
      this.notificationChannels.set('slack', {
        type: 'slack',
        config: {
          webhookUrl: this.configService.get('SLACK_WEBHOOK_URL'),
          channel: this.configService.get('SLACK_CHANNEL', '#alerts'),
        },
        enabled: true,
      });
    }

    // Generic webhook configuration
    if (this.configService.get('WEBHOOK_URL')) {
      this.notificationChannels.set('webhook', {
        type: 'webhook',
        config: {
          url: this.configService.get('WEBHOOK_URL'),
          headers: JSON.parse(this.configService.get('WEBHOOK_HEADERS', '{}')),
        },
        enabled: true,
      });
    }
  }

  async sendAlert(alert: AlertPayload): Promise<void> {
    try {
      // Check if this alert should be sent based on rules
      const shouldSend = await this.shouldSendAlert(alert);
      if (!shouldSend) {
        return;
      }

      // Get active notification channels for this alert type
      const channels = await this.getNotificationChannelsForAlert(alert);
      
      // Send notifications to all configured channels
      const notifications = channels.map(channel => this.sendNotification(alert, channel));
      await Promise.allSettled(notifications);

      this.logger.log(`Alert sent: ${alert.type} - ${alert.message}`);
    } catch (error) {
      this.logger.error('Failed to send alert', error);
    }
  }

  private async shouldSendAlert(alert: AlertPayload): Promise<boolean> {
    // Check if there's a matching alert rule
    const rule = await this.alertRuleRepository.findOne({
      where: {
        metricType: alert.type,
        status: 'active',
      },
    });

    if (!rule) {
      // No rule found, send based on severity
      return ['high', 'critical'].includes(alert.severity.toLowerCase());
    }

    // Evaluate the rule condition
    return this.evaluateAlertCondition(alert, rule);
  }

  private evaluateAlertCondition(alert: AlertPayload, rule: AlertRule): boolean {
    const { value } = alert;
    const { thresholdValue, comparisonOperator } = rule;

    switch (comparisonOperator) {
      case '>':
        return value > thresholdValue;
      case '<':
        return value < thresholdValue;
      case '>=':
        return value >= thresholdValue;
      case '<=':
        return value <= thresholdValue;
      case '==':
        return value === thresholdValue;
      default:
        return false;
    }
  }

  private async getNotificationChannelsForAlert(alert: AlertPayload): Promise<string[]> {
    const rule = await this.alertRuleRepository.findOne({
      where: { metricType: alert.type },
    });

    if (rule && rule.notificationChannels.length > 0) {
      return rule.notificationChannels;
    }

    // Default channels based on severity
    switch (alert.severity.toLowerCase()) {
      case 'critical':
        return ['email', 'slack', 'webhook'];
      case 'high':
        return ['email', 'slack'];
      case 'medium':
        return ['slack'];
      default:
        return [];
    }
  }

  private async sendNotification(alert: AlertPayload, channelName: string): Promise<void> {
    const channel = this.notificationChannels.get(channelName);
    if (!channel || !channel.enabled) {
      return;
    }

    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmailNotification(alert, channel);
          break;
        case 'slack':
          await this.sendSlackNotification(alert, channel);
          break;
        case 'webhook':
          await this.sendWebhookNotification(alert, channel);
          break;
        default:
          this.logger.warn(`Unknown notification channel type: ${channel.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send ${channel.type} notification`, error);
    }
  }

  private async sendEmailNotification(alert: AlertPayload, channel: NotificationChannel): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not initialized');
    }

    const subject = `Database Alert: ${alert.type} - ${alert.severity.toUpperCase()}`;
    const html = this.generateEmailTemplate(alert);

    await this.emailTransporter.sendMail({
      from: channel.config.from,
      to: channel.config.to,
      subject,
      html,
    });
  }

  private async sendSlackNotification(alert: AlertPayload, channel: NotificationChannel): Promise<void> {
    const payload = {
      channel: channel.config.channel,
      username: 'Database Monitor',
      icon_emoji: this.getSeverityEmoji(alert.severity),
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          title: `Database Alert: ${alert.type}`,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Value',
              value: alert.value.toString(),
              short: true,
            },
            {
              title: 'Timestamp',
              value: (alert.timestamp || new Date()).toISOString(),
              short: true,
            },
          ],
          footer: 'Database Monitoring System',
          ts: Math.floor((alert.timestamp || new Date()).getTime() / 1000),
        },
      ],
    };

    const response = await fetch(channel.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  private async sendWebhookNotification(alert: AlertPayload, channel: NotificationChannel): Promise<void> {
    const payload = {
      alert: {
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        value: alert.value,
        timestamp: alert.timestamp || new Date(),
        metadata: alert.metadata,
      },
      source: 'database-monitoring-system',
    };

    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...channel.config.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }
  }

  private generateEmailTemplate(alert: AlertPayload): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Database Alert</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .alert-container { max-width: 600px; margin: 0 auto; }
          .alert-header { 
            padding: 20px; 
            background-color: ${this.getSeverityColor(alert.severity)}; 
            color: white; 
            border-radius: 5px 5px 0 0; 
          }
          .alert-body { 
            padding: 20px; 
            background-color: #f9f9f9; 
            border: 1px solid #ddd; 
            border-radius: 0 0 5px 5px; 
          }
          .alert-details { margin-top: 15px; }
          .detail-item { margin: 5px 0; }
          .label { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="alert-container">
          <div class="alert-header">
            <h2>Database Alert: ${alert.type}</h2>
            <p>Severity: ${alert.severity.toUpperCase()}</p>
          </div>
          <div class="alert-body">
            <p><strong>Message:</strong> ${alert.message}</p>
            <div class="alert-details">
              <div class="detail-item">
                <span class="label">Value:</span> ${alert.value}
              </div>
              <div class="detail-item">
                <span class="label">Timestamp:</span> ${(alert.timestamp || new Date()).toISOString()}
              </div>
              ${alert.metadata ? `
                <div class="detail-item">
                  <span class="label">Additional Info:</span>
                  <pre>${JSON.stringify(alert.metadata, null, 2)}</pre>
                </div>
              ` : ''}
            </div>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
              This alert was generated by the Database Monitoring System.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getSeverityColor(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical':
        return '#dc3545';
      case 'high':
        return '#fd7e14';
      case 'medium':
        return '#ffc107';
      case 'low':
        return '#17a2b8';
      default:
        return '#6c757d';
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical':
        return ':rotating_light:';
      case 'high':
        return ':warning:';
      case 'medium':
        return ':exclamation:';
      case 'low':
        return ':information_source:';
      default:
        return ':grey_question:';
    }
  }

  // Alert rule management methods
  async createAlertRule(rule: Partial<AlertRule>): Promise<AlertRule> {
    const alertRule = this.alertRuleRepository.create(rule);
    return await this.alertRuleRepository.save(alertRule);
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule> {
    await this.alertRuleRepository.update(id, updates);
    return await this.alertRuleRepository.findOne({ where: { id } });
  }

  async deleteAlertRule(id: string): Promise<void> {
    await this.alertRuleRepository.delete(id);
  }

  async getAlertRules(): Promise<AlertRule[]> {
    return await this.alertRuleRepository.find();
  }

  async testNotificationChannel(channelName: string): Promise<boolean> {
    try {
      const testAlert: AlertPayload = {
        type: 'test_alert',
        severity: 'low',
        message: 'This is a test alert to verify notification channel configuration',
        value: 0,
        timestamp: new Date(),
      };

      await this.sendNotification(testAlert, channelName);
      return true;
    } catch (error) {
      this.logger.error(`Test notification failed for channel ${channelName}`, error);
      return false;
    }
  }
}
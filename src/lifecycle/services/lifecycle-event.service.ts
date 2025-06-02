import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ILifecycleEventData } from '../interfaces/lifecycle-event.interface';
import { LifecycleEvent } from '../enums/lifecycle-event.enum';

@Injectable()
export class LifecycleEventService {
  private readonly logger = new Logger(LifecycleEventService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  async emit<T>(event: LifecycleEvent, data: ILifecycleEventData<T>): Promise<void> {
    try {
      this.logger.debug(`Emitting lifecycle event: ${event} for entity ${data.entity?.constructor?.name}`);
      await this.eventEmitter.emitAsync(event, data);
    } catch (error) {
      this.logger.error(`Error emitting lifecycle event ${event}:`, error);
      throw error;
    }
  }

  async emitBulk<T>(events: Array<{ event: LifecycleEvent; data: ILifecycleEventData<T> }>): Promise<void> {
    const promises = events.map(({ event, data }) => this.emit(event, data));
    await Promise.all(promises);
  }
}
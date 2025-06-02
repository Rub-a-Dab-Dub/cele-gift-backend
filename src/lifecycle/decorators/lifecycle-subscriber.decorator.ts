import { SetMetadata } from '@nestjs/common';

export const LIFECYCLE_SUBSCRIBER_METADATA = 'lifecycle_subscriber';

export const LifecycleSubscriber = (entityTypes: string[]) =>
  SetMetadata(LIFECYCLE_SUBSCRIBER_METADATA, entityTypes);
import { SetMetadata } from '@nestjs/common';
import { LifecycleEvent } from '../enums/lifecycle-event.enum';

export const LIFECYCLE_HOOK_METADATA = 'lifecycle_hook';

export const LifecycleHook = (event: LifecycleEvent) =>
  SetMetadata(LIFECYCLE_HOOK_METADATA, event);
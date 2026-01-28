import type { LoggerService } from '@core/logging';
import type { FallbackConfig } from '@payments/domain/models/fallback/fallback-config.types';
import type { FallbackUserResponse } from '@payments/domain/models/fallback/fallback-event.types';

export function warnUnknown(
  response: FallbackUserResponse,
  currentEventId: string | null,
  config: FallbackConfig,
  logger: LoggerService,
): void {
  logger.warn(
    '[FallbackOrchestrator] Response for unknown or expired event',
    'fallback-orchestrator',
    {
      responseEventId: response.eventId,
      currentEventId,
      ttl: config.userResponseTimeout,
    },
  );
}

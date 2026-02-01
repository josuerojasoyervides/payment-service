import type { FallbackConfig } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-config.types';
import type { FallbackUserResponse } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-event.model';
import type { LoggerService } from '@core/logging';

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

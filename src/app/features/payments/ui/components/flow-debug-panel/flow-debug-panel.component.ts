import { CommonModule } from '@angular/common';
import { Component, computed, inject, isDevMode } from '@angular/core';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { I18nKeys, I18nService } from '@core/i18n';
import type { PaymentHistoryEntry } from '@payments/application/api/ports/payment-store.port';

const RECENT_HISTORY_COUNT = 5;

/**
 * Reusable debug panel that shows flow state (debugSummary, history) and
 * dev-friendly actions (reset, clearError, clearHistory).
 * Uses only PaymentFlowPort; no orchestration/adapters.
 */
@Component({
  selector: 'app-flow-debug-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flow-debug-panel.component.html',
})
export class FlowDebugPanelComponent {
  readonly isDevMode = isDevMode();
  private readonly state = inject(PAYMENT_STATE);
  private readonly i18n = inject(I18nService);

  readonly debugSummary = computed(() => this.state.debugSummary());
  readonly debugStateNode = computed(() => this.state.debugStateNode());
  readonly debugTags = computed(() => this.state.debugTags());
  readonly debugLastEventType = computed(() => this.state.debugLastEventType());
  readonly debugLastEventPayload = computed(() => this.state.debugLastEventPayload());
  readonly historyCount = computed(() => this.state.historyCount());
  readonly lastHistoryEntry = computed(() => this.state.lastHistoryEntry());
  readonly history = computed(() => this.state.history());
  readonly isLoading = computed(() => this.state.isLoading());
  readonly isReady = computed(() => this.state.isReady());
  readonly hasError = computed(() => this.state.hasError());

  readonly recentHistory = computed(() => {
    const list = this.history();
    return list.slice(-RECENT_HISTORY_COUNT);
  });

  readonly labels = computed(() => ({
    title: this.i18n.t(I18nKeys.ui.debug_info),
    status: this.i18n.t(I18nKeys.ui.status_label),
    provider: this.i18n.t(I18nKeys.ui.provider_label),
    intentId: this.i18n.t(I18nKeys.ui.intent_id),
    historyCount: this.i18n.t(I18nKeys.ui.payments_in_session),
    recentHistory: 'Recent history',
    reset: this.i18n.t(I18nKeys.ui.retry),
    clearError: 'Clear error',
    clearHistory: this.i18n.t(I18nKeys.ui.clear_history),
    debugStateNode: this.i18n.t(I18nKeys.ui.debug_state_node),
    debugTags: this.i18n.t(I18nKeys.ui.debug_tags),
    debugLastEventType: this.i18n.t(I18nKeys.ui.debug_last_event_type),
    debugLastEventPayload: this.i18n.t(I18nKeys.ui.debug_last_event_payload),
  }));

  onReset(): void {
    this.state.reset();
  }

  onClearError(): void {
    this.state.clearError();
  }

  onClearHistory(): void {
    this.state.clearHistory();
  }

  formatEntry(entry: PaymentHistoryEntry): string {
    return `${entry.intentId} | ${entry.provider} | ${entry.status} | ${entry.amount} ${entry.currency}`;
  }
}

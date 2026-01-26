import { Directive, HostListener, inject, Input } from '@angular/core';
import { LoggerService } from '@core/logging';

@Directive({
  selector: '[appTrackClick]',
  standalone: true,
})
export class TrackClickDirective {
  private readonly logger = inject(LoggerService);

  @Input('appTrackClick') eventName = 'ui_click';
  @Input() trackClickContext = 'UI';
  @Input() trackClickMetadata?: Record<string, unknown>;

  @HostListener('click', ['$event'])
  handleClick(event: Event): void {
    const target = event.target as HTMLButtonElement | null;
    if (target?.disabled) return;

    this.logger.info(this.eventName, this.trackClickContext, {
      ...this.trackClickMetadata,
      target: target?.tagName?.toLowerCase() ?? 'unknown',
    });
  }
}

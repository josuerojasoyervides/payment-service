import type { AfterViewInit } from '@angular/core';
import { Directive, ElementRef, inject, Input } from '@angular/core';

@Directive({
  selector: '[appAutofocus]',
  standalone: true,
})
export class AutofocusDirective implements AfterViewInit {
  @Input('appAutofocus') enabled = true;

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    if (!this.enabled) return;
    queueMicrotask(() => {
      const element = this.elementRef.nativeElement;
      if (element && 'focus' in element) {
        (element as HTMLElement).focus();
      }
    });
  }
}

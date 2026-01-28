import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject } from '@angular/core';
import { I18nKeys, I18nService, Language } from '@core/i18n';

export interface LanguageOption {
  code: Language;
  name: string;
  flag: string;
}

/**
 * Language selector component.
 *
 * Shows a dropdown to change the application language.
 *
 * @example
 * ```html
 * <app-language-selector />
 * ```
 */
@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-selector.component.html',
  styleUrls: ['./language-selector.component.scss'],
})
export class LanguageSelectorComponent {
  private readonly i18n = inject(I18nService);

  readonly languages: LanguageOption[] = [
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
  ];

  /** Current language */
  readonly currentLang = this.i18n.currentLang;

  /** Selected language with metadata */
  readonly selectedLanguage = computed(() => {
    const lang = this.currentLang();
    return this.languages.find((l) => l.code === lang) || this.languages[0];
  });

  isOpen = false;

  /**
   * Change the application language.
   */
  selectLanguage(langCode: Language): void {
    this.i18n.setLanguage(langCode);
    this.isOpen = false;
  }

  /**
   * Toggle dropdown state.
   */
  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
  }

  /**
   * Close the dropdown.
   */
  closeDropdown(): void {
    this.isOpen = false;
  }

  get selectLanguageLabel(): string {
    return this.i18n.t(I18nKeys.ui.select_language);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.language-selector-container')) {
      this.closeDropdown();
    }
  }
}

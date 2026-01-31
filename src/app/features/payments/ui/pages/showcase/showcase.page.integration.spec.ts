import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import providePayments from '@payments/config/payment.providers';
import { ShowcaseComponent } from '@payments/ui/pages/showcase/showcase.page';

describe('ShowcaseComponent - Integration', () => {
  let component: ShowcaseComponent;
  let fixture: ComponentFixture<ShowcaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowcaseComponent],
      providers: [provideRouter([]), ...providePayments()],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowcaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render with real provider descriptors from catalog', () => {
    expect(component.providerDescriptors().length).toBeGreaterThanOrEqual(1);
    expect(component.catalogDisplay().length).toBeGreaterThanOrEqual(1);
  });

  it('should derive catalogProviderIds from catalog (no hardcoded provider ids)', () => {
    const { p0, p1 } = component.catalogProviderIds();
    const descriptors = component.providerDescriptors();
    expect(descriptors.some((d) => d.id === p0)).toBe(true);
    if (descriptors.length > 1) {
      expect(p1).toBeDefined();
      expect(descriptors.some((d) => d.id === p1)).toBe(true);
    }
  });

  it('should have sampleIntent with provider from catalog when catalog has descriptors', () => {
    const intent = component.sampleIntent();
    if (!intent) return;
    const ids = component.catalogProviderIds();
    expect(ids.p0).toBe(intent.provider);
  });
});

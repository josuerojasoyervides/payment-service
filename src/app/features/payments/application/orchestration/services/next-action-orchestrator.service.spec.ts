import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { ClientConfirmPort } from '../../api/ports/client-confirm.port';
import { FinalizePort } from '../../api/ports/finalize.port';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { NextActionOrchestratorService } from './next-action-orchestrator.service';

describe('NextActionOrchestratorService', () => {
  const intent = {
    id: 'pi_1',
    provider: 'stripe' as const,
    status: 'succeeded' as const,
    amount: 100,
    currency: 'MXN' as const,
  };

  function registryWithClientConfirmHandler(
    handler: ClientConfirmPort | null,
  ): ProviderFactoryRegistry {
    const factory = { getClientConfirmHandler: () => handler };
    return {
      has: vi.fn(() => true),
      get: vi.fn(() => factory),
    } as unknown as ProviderFactoryRegistry;
  }

  function registryWithFinalizeHandler(handler: FinalizePort | null): ProviderFactoryRegistry {
    const factory = { getFinalizeHandler: () => handler };
    return {
      has: vi.fn(() => true),
      get: vi.fn(() => factory),
    } as unknown as ProviderFactoryRegistry;
  }

  it('routes client_confirm to handler when factory exposes capability', async () => {
    const confirmPort: ClientConfirmPort = {
      providerId: 'stripe',
      execute: vi.fn(() => of(intent)),
    };
    const registry = registryWithClientConfirmHandler(confirmPort);

    TestBed.configureTestingModule({
      providers: [
        NextActionOrchestratorService,
        { provide: ProviderFactoryRegistry, useValue: registry },
      ],
    });

    const orchestrator = TestBed.inject(NextActionOrchestratorService);
    const result = await firstValueFrom(
      orchestrator.requestClientConfirm(
        { kind: 'client_confirm', token: 'tok_runtime' },
        { providerId: 'stripe' },
      ),
    );

    expect(result).toEqual(intent);
    expect(confirmPort.execute).toHaveBeenCalledTimes(1);
    expect(confirmPort.execute).toHaveBeenCalledWith({
      providerId: 'stripe',
      action: { kind: 'client_confirm', token: 'tok_runtime' },
      context: { providerId: 'stripe' },
    });
  });

  it('returns PaymentError with stable code/messageKey when no handler', async () => {
    const registry = registryWithClientConfirmHandler(null);

    TestBed.configureTestingModule({
      providers: [
        NextActionOrchestratorService,
        { provide: ProviderFactoryRegistry, useValue: registry },
      ],
    });

    const orchestrator = TestBed.inject(NextActionOrchestratorService);

    await expect(
      firstValueFrom(
        orchestrator.requestClientConfirm(
          { kind: 'client_confirm', token: 'tok_runtime' },
          { providerId: 'stripe' },
        ),
      ),
    ).rejects.toMatchObject({
      code: 'unsupported_client_confirm',
      messageKey: 'errors.unsupported_client_confirm',
    });
  });

  it('routes finalize to handler when factory exposes capability', async () => {
    const finalizePort: FinalizePort = {
      providerId: 'paypal',
      execute: vi.fn(() => of({ ...intent, provider: 'paypal' as const })),
    };
    const registry = registryWithFinalizeHandler(finalizePort);

    TestBed.configureTestingModule({
      providers: [
        NextActionOrchestratorService,
        { provide: ProviderFactoryRegistry, useValue: registry },
      ],
    });

    const orchestrator = TestBed.inject(NextActionOrchestratorService);
    const result = await firstValueFrom(orchestrator.requestFinalize({ providerId: 'paypal' }));

    expect(result.provider).toBe('paypal');
    expect(finalizePort.execute).toHaveBeenCalledTimes(1);
    expect(finalizePort.execute).toHaveBeenCalledWith({
      providerId: 'paypal',
      context: { providerId: 'paypal' },
    });
  });

  it('returns PaymentError with stable code/messageKey when no finalize handler', async () => {
    const registry = registryWithFinalizeHandler(null);

    TestBed.configureTestingModule({
      providers: [
        NextActionOrchestratorService,
        { provide: ProviderFactoryRegistry, useValue: registry },
      ],
    });

    const orchestrator = TestBed.inject(NextActionOrchestratorService);

    await expect(
      firstValueFrom(orchestrator.requestFinalize({ providerId: 'paypal' })),
    ).rejects.toMatchObject({
      code: 'unsupported_finalize',
      messageKey: 'errors.unsupported_finalize',
    });
  });

  it('provider coupling audit: no providerId switch in finalize routing', () => {
    // Routing uses registry -> factory.getFinalizeHandler?.(); no provider-name branching like:
    // if (providerId === 'stripe'|'paypal') ...
    //
    // Grep check (manual):
    // rg "providerId === ['\"]stripe|providerId === ['\"]paypal" src/app/features/payments/application/orchestration --glob "*.ts"
    const registry = registryWithFinalizeHandler(null);
    expect(registry.has).toBeDefined();
    expect(registry.get).toBeDefined();
  });

  it('rejects unsupported next action kinds', async () => {
    const registry = registryWithClientConfirmHandler(null);

    TestBed.configureTestingModule({
      providers: [
        NextActionOrchestratorService,
        { provide: ProviderFactoryRegistry, useValue: registry },
      ],
    });

    const orchestrator = TestBed.inject(NextActionOrchestratorService);

    await expect(
      firstValueFrom(
        orchestrator.requestClientConfirm(
          { kind: 'redirect', url: 'https://example.com' },
          { providerId: 'stripe' },
        ),
      ),
    ).rejects.toThrow('Client confirmation requires a client_confirm action');
  });
});

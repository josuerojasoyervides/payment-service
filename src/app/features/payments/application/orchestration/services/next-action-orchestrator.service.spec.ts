import { TestBed } from '@angular/core/testing';
import { firstValueFrom,of } from 'rxjs';

import { ClientConfirmPort } from '../../api/ports/client-confirm.port';
import { FinalizePort } from '../../api/ports/finalize.port';
import { CLIENT_CONFIRM_PORTS } from '../../api/tokens/client-confirm.token';
import { FINALIZE_PORTS } from '../../api/tokens/finalize.token';
import { NextActionOrchestratorService } from './next-action-orchestrator.service';

describe('NextActionOrchestratorService', () => {
  const intent = {
    id: 'pi_1',
    provider: 'stripe',
    status: 'succeeded' as const,
    amount: 100,
    currency: 'MXN' as const,
  };

  it('routes client_confirm actions to the matching port', async () => {
    const confirmPort: ClientConfirmPort = {
      providerId: 'stripe',
      execute: vi.fn(() => of(intent)),
    };

    TestBed.configureTestingModule({
      providers: [
        NextActionOrchestratorService,
        { provide: CLIENT_CONFIRM_PORTS, useValue: [confirmPort] },
        { provide: FINALIZE_PORTS, useValue: [] },
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
  });

  it('rejects client_confirm when no port is available', async () => {
    TestBed.configureTestingModule({
      providers: [
        NextActionOrchestratorService,
        { provide: CLIENT_CONFIRM_PORTS, useValue: [] },
        { provide: FINALIZE_PORTS, useValue: [] },
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
    ).rejects.toThrow('No client confirmation port for stripe');
  });

  it('routes finalization requests to the matching port', async () => {
    const finalizePort: FinalizePort = {
      providerId: 'paypal',
      execute: vi.fn(() => of({ ...intent, provider: 'paypal' as const })),
    };

    TestBed.configureTestingModule({
      providers: [
        NextActionOrchestratorService,
        { provide: CLIENT_CONFIRM_PORTS, useValue: [] },
        { provide: FINALIZE_PORTS, useValue: [finalizePort] },
      ],
    });

    const orchestrator = TestBed.inject(NextActionOrchestratorService);
    const result = await firstValueFrom(orchestrator.requestFinalize({ providerId: 'paypal' }));

    expect(result.provider).toBe('paypal');
    expect(finalizePort.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported next action kinds', async () => {
    TestBed.configureTestingModule({
      providers: [
        NextActionOrchestratorService,
        { provide: CLIENT_CONFIRM_PORTS, useValue: [] },
        { provide: FINALIZE_PORTS, useValue: [] },
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

import { firstValueFrom, of } from "rxjs";
import { SpeiStrategy } from './spei-strategy';
import { PaymentGateway } from "../../domain/ports";
import { CreatePaymentRequest, PaymentIntent, NextActionSpei } from "../../domain/models";
import { I18nService } from "@core/i18n";

describe('SpeiStrategy', () => {
    let strategy: SpeiStrategy;
    let gatewayMock: Pick<PaymentGateway, 'createIntent' | 'providerId'>;
    let i18nMock: I18nService;

    const validReq: CreatePaymentRequest = {
        orderId: 'order_1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'spei' },
    };

    const intentResponse: PaymentIntent = {
        id: 'src_1',
        provider: 'stripe',
        status: 'requires_action',
        amount: 100,
        currency: 'MXN',
        raw: {
            spei: {
                clabe: '646180111812345678',
                reference: '1234567',
                bank: 'STP',
            }
        }
    };

    beforeEach(() => {
        gatewayMock = {
            providerId: 'stripe',
            createIntent: vi.fn(() => of(intentResponse))
        } as any;

        i18nMock = {
            t: vi.fn((key: string, params?: Record<string, string | number>) => {
                const translations: Record<string, string> = {
                    'errors.invalid_request': 'Invalid request',
                    'errors.min_amount': params ? `Minimum amount for card payments is ${params['amount']} ${params['currency']}` : 'Minimum amount for card payments',
                    'messages.spei_instructions': 'Realiza una transferencia SPEI con los siguientes datos:',
                    'ui.spei_instructions_title': 'Para completar tu pago de',
                    'ui.spei_step_1': 'Abre tu app bancaria o banca en línea',
                    'ui.spei_step_2': 'Selecciona "Transferencia SPEI"',
                    'ui.spei_step_3': 'Ingresa la CLABE:',
                    'ui.spei_step_4': 'Monto exacto:',
                    'ui.spei_step_5': 'Referencia:',
                    'ui.spei_step_6': 'Beneficiario:',
                    'ui.spei_deadline': 'Fecha límite:',
                    'ui.spei_processing_time': 'El pago puede tardar de 5 minutos a 24 horas en reflejarse.',
                };
                return translations[key] || key;
            }),
            setLanguage: vi.fn(),
            getLanguage: vi.fn(() => 'es'),
            has: vi.fn(() => true),
            currentLang: { asReadonly: vi.fn() } as any,
        } as any;

        strategy = new SpeiStrategy(gatewayMock as any, i18nMock);
    });

    describe('validate()', () => {
        it('throws if currency is not MXN', () => {
            const req = { ...validReq, currency: 'USD' as const };
            expect(() => strategy.validate(req)).toThrowError(/SPEI only supports MXN/);
        });

        it('throws if amount is below minimum', () => {
            const req = { ...validReq, amount: 0.5 };
            expect(() => strategy.validate(req)).toThrowError(/Minimum amount/);
        });

        it('throws if amount exceeds maximum', () => {
            const req = { ...validReq, amount: 10_000_000 };
            expect(() => strategy.validate(req)).toThrowError(/Maximum amount/);
        });

        it('accepts valid MXN amounts', () => {
            expect(() => strategy.validate(validReq)).not.toThrow();
            expect(() => strategy.validate({ ...validReq, amount: 5_000_000 })).not.toThrow();
        });

        it('warns but does not throw if token is provided', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const req = { ...validReq, method: { type: 'spei' as const, token: 'tok_ignored' } };

            expect(() => strategy.validate(req)).not.toThrow();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Token provided but will be ignored'));

            consoleSpy.mockRestore();
        });
    });

    describe('prepare()', () => {
        it('returns prepared request without token', () => {
            const reqWithToken = { ...validReq, method: { type: 'spei' as const, token: 'tok_ignore' } };
            const result = strategy.prepare(reqWithToken);

            expect(result.preparedRequest.method.token).toBeUndefined();
            expect(result.preparedRequest.method.type).toBe('spei');
        });

        it('calculates expiration date (72 hours)', () => {
            const result = strategy.prepare(validReq);
            const expiresAt = new Date(result.metadata['expires_at'] as string);
            const now = new Date();

            const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
            expect(hoursDiff).toBeGreaterThan(71);
            expect(hoursDiff).toBeLessThan(73);
        });

        it('includes metadata for SPEI tracking', () => {
            const result = strategy.prepare(validReq);

            expect(result.metadata['payment_method_type']).toBe('spei');
            expect(result.metadata['requires_polling']).toBe(true);
            expect(result.metadata['payment_concept']).toBeDefined();
        });
    });

    describe('start()', () => {
        it('validates, prepares and calls gateway.createIntent', async () => {
            const result = await firstValueFrom(strategy.start(validReq));

            expect(gatewayMock.createIntent).toHaveBeenCalledTimes(1);
            expect(result.id).toBe('src_1');
        });

        it('throws validation error before calling gateway', () => {
            const invalidReq = { ...validReq, currency: 'USD' as const };

            // Error is thrown synchronously in start() before returning Observable
            expect(() => strategy.start(invalidReq)).toThrowError(/SPEI only supports MXN/);

            expect(gatewayMock.createIntent).not.toHaveBeenCalled();
        });

        it('enriches intent with SPEI instructions', async () => {
            const result = await firstValueFrom(strategy.start(validReq));

            expect(result.status).toBe('requires_action');
            expect(result.nextAction?.type).toBe('spei');

            const speiAction = result.nextAction as NextActionSpei;
            expect(speiAction.clabe).toBeDefined();
            expect(speiAction.reference).toBeDefined();
            expect(speiAction.bank).toBeDefined();
            expect(speiAction.expiresAt).toBeDefined();
        });

        it('removes token from prepared request', async () => {
            const reqWithToken = { ...validReq, method: { type: 'spei' as const, token: 'tok_ignore' } };

            await firstValueFrom(strategy.start(reqWithToken));

            const calledWith = (gatewayMock.createIntent as any).mock.calls[0][0];
            expect(calledWith.method.token).toBeUndefined();
        });
    });

    describe('requiresUserAction()', () => {
        it('returns true when status is requires_action with spei nextAction', () => {
            const intent: PaymentIntent = {
                ...intentResponse,
                nextAction: {
                    type: 'spei',
                    instructions: 'Transfer',
                    clabe: '123',
                    reference: '456',
                    bank: 'STP',
                    beneficiary: 'Test',
                    amount: 100,
                    currency: 'MXN',
                    expiresAt: new Date().toISOString(),
                },
            };
            expect(strategy.requiresUserAction(intent)).toBe(true);
        });

        it('returns false for completed payments', () => {
            expect(strategy.requiresUserAction({ ...intentResponse, status: 'succeeded' })).toBe(false);
        });
    });

    describe('getUserInstructions()', () => {
        it('returns detailed SPEI instructions', () => {
            const intent: PaymentIntent = {
                ...intentResponse,
                nextAction: {
                    type: 'spei',
                    instructions: 'Transfer',
                    clabe: '646180111812345678',
                    reference: '1234567',
                    bank: 'STP',
                    beneficiary: 'Test Company',
                    amount: 100,
                    currency: 'MXN',
                    expiresAt: new Date().toISOString(),
                },
            };

            const instructions = strategy.getUserInstructions(intent);

            expect(instructions).toContain('100');
            expect(instructions).toContain('646180111812345678');
            expect(instructions).toContain('1234567');
            expect(instructions).toContain('SPEI');
        });

        it('returns null when not a SPEI intent', () => {
            const intent: PaymentIntent = { ...intentResponse, nextAction: undefined };
            expect(strategy.getUserInstructions(intent)).toBeNull();
        });
    });
});
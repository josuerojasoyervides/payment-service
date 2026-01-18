import { CreatePaymentRequest } from "../../domain/models/payment.requests";
import { PaymentGateway } from "../../domain/ports/payment-gateway.port";
import { CardStrategy } from "./card-strategy"
import { firstValueFrom, of } from "rxjs";
import { PaymentIntent } from "../../domain/models/payment.types";

describe('CardStrategy', () => {
    let strategy: CardStrategy;
    let gatewayMock: Pick<PaymentGateway, 'createIntent' | 'providerId'>;

    const validReq: CreatePaymentRequest = {
        orderId: 'order_1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
    };

    const intentResponse: PaymentIntent = {
        id: 'pi_1',
        provider: 'stripe',
        status: 'requires_payment_method',
        amount: 100,
        currency: 'MXN',
    };

    beforeEach(() => {
        gatewayMock = {
            providerId: 'stripe',
            createIntent: vi.fn(() => of(intentResponse))
        } as any;

        strategy = new CardStrategy(gatewayMock as any);
    });

    describe('validate()', () => {
        it('throws if token is missing', () => {
            const req = { ...validReq, method: { type: 'card' as const } };
            expect(() => strategy.validate(req)).toThrowError(/Card token is required/);
        });

        it('throws if token has invalid format', () => {
            const req = { ...validReq, method: { type: 'card' as const, token: 'invalid_token' } };
            expect(() => strategy.validate(req)).toThrowError(/Invalid card token format/);
        });

        it('accepts valid token formats (tok_, pm_, card_)', () => {
            expect(() => strategy.validate({ ...validReq, method: { type: 'card', token: 'tok_abc123' } })).not.toThrow();
            expect(() => strategy.validate({ ...validReq, method: { type: 'card', token: 'pm_abc123' } })).not.toThrow();
            expect(() => strategy.validate({ ...validReq, method: { type: 'card', token: 'card_abc123' } })).not.toThrow();
        });

        it('throws if amount is below minimum for MXN', () => {
            const req = { ...validReq, amount: 5, currency: 'MXN' as const };
            expect(() => strategy.validate(req)).toThrowError(/Minimum amount/);
        });

        it('throws if amount is below minimum for USD', () => {
            const req = { ...validReq, amount: 0.5, currency: 'USD' as const };
            expect(() => strategy.validate(req)).toThrowError(/Minimum amount/);
        });
    });

    describe('prepare()', () => {
        it('returns prepared request and metadata', () => {
            const result = strategy.prepare(validReq);

            expect(result.preparedRequest).toEqual(validReq);
            expect(result.metadata['payment_method_type']).toBe('card');
            expect(result.metadata['is_saved_card']).toBe(false);
            expect(result.metadata['timestamp']).toBeDefined();
        });

        it('detects saved cards (pm_ prefix)', () => {
            const req = { ...validReq, method: { type: 'card' as const, token: 'pm_saved123' } };
            const result = strategy.prepare(req);

            expect(result.metadata['is_saved_card']).toBe(true);
            expect(result.metadata['requires_sca']).toBe(true);
        });

        it('includes return_url from context', () => {
            const result = strategy.prepare(validReq, { returnUrl: 'https://example.com/return' });
            expect(result.metadata['return_url']).toBe('https://example.com/return');
        });

        it('includes device data when provided', () => {
            const result = strategy.prepare(validReq, {
                deviceData: {
                    ipAddress: '192.168.1.1',
                    userAgent: 'Mozilla/5.0',
                    screenWidth: 1920,
                    screenHeight: 1080,
                }
            });

            expect(result.metadata['device_ip']).toBe('192.168.1.1');
            expect(result.metadata['device_user_agent']).toBe('Mozilla/5.0');
            expect(result.metadata['device_screen']).toBe('1920x1080');
        });
    });

    describe('start()', () => {
        it('validates, prepares and calls gateway.createIntent', async () => {
            const result = await firstValueFrom(strategy.start(validReq));

            expect(gatewayMock.createIntent).toHaveBeenCalledTimes(1);
            expect(gatewayMock.createIntent).toHaveBeenCalledWith(validReq);
            expect(result.id).toBe('pi_1');
        });

        it('throws validation error before calling gateway', () => {
            const invalidReq = { ...validReq, method: { type: 'card' as const } };

            // Error is thrown synchronously in start() before returning Observable
            expect(() => strategy.start(invalidReq)).toThrowError(/Card token is required/);

            expect(gatewayMock.createIntent).not.toHaveBeenCalled();
        });

        it('enriches intent with 3DS info when requires_action', async () => {
            const intentWith3ds: PaymentIntent = {
                ...intentResponse,
                status: 'requires_action',
                clientSecret: 'pi_secret_123',
            };
            (gatewayMock.createIntent as any).mockReturnValueOnce(of(intentWith3ds));

            const result = await firstValueFrom(strategy.start(validReq, { returnUrl: 'https://return.com' }));

            expect(result.nextAction?.type).toBe('3ds');
            expect((result.nextAction as any)?.clientSecret).toBe('pi_secret_123');
            expect((result.nextAction as any)?.returnUrl).toBe('https://return.com');
        });
    });

    describe('requiresUserAction()', () => {
        it('returns true when status is requires_action with 3ds', () => {
            const intent: PaymentIntent = {
                ...intentResponse,
                status: 'requires_action',
                nextAction: { type: '3ds', clientSecret: 'secret', returnUrl: '' },
            };
            expect(strategy.requiresUserAction(intent)).toBe(true);
        });

        it('returns false for other statuses', () => {
            expect(strategy.requiresUserAction({ ...intentResponse, status: 'succeeded' })).toBe(false);
            expect(strategy.requiresUserAction({ ...intentResponse, status: 'processing' })).toBe(false);
        });
    });

    describe('getUserInstructions()', () => {
        it('returns instructions when 3DS is required', () => {
            const intent: PaymentIntent = {
                ...intentResponse,
                status: 'requires_action',
                nextAction: { type: '3ds', clientSecret: 'secret', returnUrl: '' },
            };
            const instructions = strategy.getUserInstructions(intent);
            expect(instructions).toContain('verificación adicional');
        });

        it('returns null when no action required', () => {
            expect(strategy.getUserInstructions(intentResponse)).toBeNull();
        });
    });
});
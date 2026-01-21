import { StripeErrorResponse } from "../dto/stripe.dto";

export function isStripeErrorResponse(err: unknown): err is { error: StripeErrorResponse['error'] } {
    return err !== null &&
        typeof err === 'object' &&
        'error' in err &&
        typeof (err as any).error === 'object' &&
        'type' in (err as any).error;
}
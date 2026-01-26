/**
 * Payment flow context.
 *
 * Contains additional information passed during the flow,
 * such as return URLs, device data, and metadata.
 */
export interface PaymentFlowContext {
  /** Return URL after 3DS or redirect */
  returnUrl?: string;

  /** Cancel URL (for PayPal) */
  cancelUrl?: string;

  /** Indicates if this is a test environment */
  isTest?: boolean;

  /** Device info for fraud prevention */
  deviceData?: {
    ipAddress?: string;
    userAgent?: string;
    screenWidth?: number;
    screenHeight?: number;
  };

  /** Additional custom metadata */
  metadata?: Record<string, unknown>;
}

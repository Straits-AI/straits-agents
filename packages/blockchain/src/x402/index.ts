export { PaymentHandler } from './PaymentHandler';
export type {
  PaymentHandlerConfig,
  CreatePaymentRequestInput,
  VerifyPaymentInput,
} from './PaymentHandler';

export { createX402Middleware, isPaymentRequired, extractPaymentRequest } from './middleware';
export type { X402MiddlewareConfig, X402Context } from './middleware';

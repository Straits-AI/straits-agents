import type { X402PaymentRequest } from '@straits/core';
import { PaymentHandler } from './PaymentHandler';

export interface X402MiddlewareConfig {
  chainId: number;
  facilitatorUrl?: string;
  /** Get the payee address for a request */
  getPayeeAddress: (request: Request) => Promise<string>;
  /** Get the amount to charge in cents */
  getAmount: (request: Request) => Promise<number>;
  /** Check if the request requires payment */
  requiresPayment: (request: Request) => Promise<boolean>;
}

export interface X402Context {
  paymentVerified: boolean;
  paymentId?: string;
  payerAddress?: string;
  transactionHash?: string;
}

/**
 * Create x402 middleware for Cloudflare Workers.
 */
export function createX402Middleware(config: X402MiddlewareConfig) {
  const paymentHandler = new PaymentHandler({
    chainId: config.chainId,
    facilitatorUrl: config.facilitatorUrl,
  });

  return async function x402Middleware(
    request: Request,
    next: (request: Request, context: X402Context) => Promise<Response>
  ): Promise<Response> {
    // Check if payment is required
    const needsPayment = await config.requiresPayment(request);

    if (!needsPayment) {
      return next(request, { paymentVerified: false });
    }

    // Check for payment receipt in headers
    const headers = Object.fromEntries(request.headers.entries());
    const paymentInput = paymentHandler.parsePaymentHeaders(headers);

    if (paymentInput) {
      // Verify the payment
      const receipt = await paymentHandler.verifyPayment(paymentInput);

      if (receipt) {
        // Payment verified, proceed with request
        return next(request, {
          paymentVerified: true,
          paymentId: paymentInput.paymentId,
          payerAddress: paymentInput.payerAddress,
          transactionHash: paymentInput.transactionHash,
        });
      }

      // Payment verification failed
      return new Response(
        JSON.stringify({
          error: 'Payment verification failed',
          message: 'The provided payment could not be verified on-chain',
        }),
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // No payment provided, return 402 with payment request
    const payeeAddress = await config.getPayeeAddress(request);
    const amount = await config.getAmount(request);

    const paymentRequest = paymentHandler.createPaymentRequest({
      payeeAddress,
      amount,
      description: `API request to ${new URL(request.url).pathname}`,
    });

    const paymentHeaders = paymentHandler.generate402Headers(paymentRequest);

    return new Response(
      JSON.stringify({
        error: 'Payment Required',
        message: 'This endpoint requires payment',
        payment: {
          id: paymentRequest.paymentId,
          amount: paymentHandler.formatAmount(paymentRequest.amount),
          currency: paymentRequest.currency,
          chainId: paymentRequest.chainId,
          payeeAddress: paymentRequest.payeeAddress,
          expiresAt: paymentRequest.expiresAt.toISOString(),
        },
      }),
      {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          ...paymentHeaders,
        },
      }
    );
  };
}

/**
 * Helper to check if a response is a 402 Payment Required.
 */
export function isPaymentRequired(response: Response): boolean {
  return response.status === 402;
}

/**
 * Extract payment request from 402 response.
 */
export async function extractPaymentRequest(
  response: Response
): Promise<X402PaymentRequest | null> {
  if (!isPaymentRequired(response)) {
    return null;
  }

  try {
    const body = await response.json() as { payment?: X402PaymentRequest };
    return body.payment || null;
  } catch {
    return null;
  }
}

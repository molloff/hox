import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * ePay Billing API integration.
 * Registration: easypay.bg → Партньори → 2-4 weeks approval.
 *
 * merchantID = unique provider number (ЧЕЗ=854238)
 * IDN = client subscription number
 *
 * POST /v3pay-web/api/check { merchantId, clientId } → check balance
 * POST /v3pay-web/api/pay { merchantId, clientId, amount } → pay
 */

const EPAY_BASE = env.EPAY_API_URL;

interface EpayCheckResult {
  merchantId: string;
  clientId: string;
  amount: number;
  status: string;
  provider: string;
}

interface EpayPayResult {
  transactionId: string;
  status: 'success' | 'failed';
  amount: number;
}

/**
 * Check bill balance for a provider via ePay.
 */
export async function checkBill(merchantId: string, clientId: string): Promise<EpayCheckResult | null> {
  try {
    const response = await fetch(`${EPAY_BASE}/v3pay-web/api/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.EPAY_SECRET}`,
      },
      body: JSON.stringify({ merchantId, clientId }),
    });

    if (!response.ok) {
      logger.warn({ merchantId, clientId, status: response.status }, 'ePay check failed');
      return null;
    }

    const data = await response.json() as any;

    return {
      merchantId,
      clientId,
      amount: parseFloat(data.amount),
      status: data.status,
      provider: data.providerName || merchantId,
    };
  } catch (err) {
    logger.error({ merchantId, clientId, err }, 'ePay check error');
    return null;
  }
}

/**
 * Pay a bill via ePay.
 * FaceID/TouchID must be confirmed on the mobile side BEFORE calling this.
 */
export async function payBill(
  merchantId: string,
  clientId: string,
  amount: number
): Promise<EpayPayResult> {
  try {
    const response = await fetch(`${EPAY_BASE}/v3pay-web/api/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.EPAY_SECRET}`,
      },
      body: JSON.stringify({ merchantId, clientId, amount }),
    });

    if (!response.ok) {
      throw new Error(`ePay payment failed: ${response.status}`);
    }

    const data = await response.json() as any;

    logger.info({ merchantId, clientId, amount, txId: data.transactionId }, 'ePay payment successful');

    return {
      transactionId: data.transactionId,
      status: 'success',
      amount,
    };
  } catch (err) {
    logger.error({ merchantId, clientId, amount, err }, 'ePay payment error');
    return { transactionId: '', status: 'failed', amount };
  }
}

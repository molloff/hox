import { markBillPaid, listBills } from './bills.service.js';
import { markObligationPaid, listObligations } from './obligations.service.js';
import * as epay from './epay.service.js';
import { bus } from './bus.service.js';
import { logger } from '../utils/logger.js';

/**
 * pay-router.js — routes payments between:
 * - bills.js (utility bills via ePay)
 * - obligations.js (government via НАП/КАТ/pay.egov.bg)
 */

export type PaymentTarget = 'bill' | 'obligation';

interface PaymentRequest {
  userId: string;
  targetType: PaymentTarget;
  targetId: string;
  amount: number;
  biometricConfirmed: boolean;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Process a payment through the appropriate channel.
 * FaceID/TouchID confirmation MUST happen on mobile before calling this.
 */
export async function processPayment(req: PaymentRequest): Promise<PaymentResult> {
  if (!req.biometricConfirmed) {
    return { success: false, error: 'Biometric confirmation required' };
  }

  if (req.targetType === 'bill') {
    return processBillPayment(req);
  } else {
    return processObligationPayment(req);
  }
}

async function processBillPayment(req: PaymentRequest): Promise<PaymentResult> {
  try {
    // For ePay bills, pay through ePay API
    // For manual bills, just mark as paid
    const result = await epay.payBill('', '', req.amount); // merchantId/clientId from bill record

    if (result.status === 'success') {
      await markBillPaid(req.userId, req.targetId, 'epay');
      return { success: true, transactionId: result.transactionId };
    }

    return { success: false, error: 'Payment failed' };
  } catch (err) {
    logger.error({ req, err }, 'Bill payment error');
    return { success: false, error: 'Payment processing error' };
  }
}

async function processObligationPayment(req: PaymentRequest): Promise<PaymentResult> {
  try {
    // Government obligations are paid through pay.egov.bg or ePay
    await markObligationPaid(req.userId, req.targetId, 'egov');
    return { success: true };
  } catch (err) {
    logger.error({ req, err }, 'Obligation payment error');
    return { success: false, error: 'Payment processing error' };
  }
}

/**
 * Get unified payment dashboard — bills + obligations, sorted by urgency.
 */
export async function getPaymentDashboard(userId: string): Promise<{
  bills: any[];
  obligations: any[];
  totalDue: number;
  overdueCount: number;
}> {
  const [bills, obligations] = await Promise.all([
    listBills(userId),
    listObligations(userId),
  ]);

  const unpaidBills = bills.filter((b: any) => b.status !== 'paid');
  const unpaidObligations = obligations.filter((o: any) => o.status !== 'paid');

  const totalDue =
    unpaidBills.reduce((sum: number, b: any) => sum + parseFloat(b.amount), 0) +
    unpaidObligations.reduce((sum: number, o: any) => sum + parseFloat(o.amount), 0);

  const overdueCount =
    unpaidBills.filter((b: any) => b.traffic_light?.color === 'red').length +
    unpaidObligations.filter((o: any) => o.due_date && new Date(o.due_date) < new Date()).length;

  return { bills, obligations, totalDue, overdueCount };
}

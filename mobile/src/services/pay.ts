import api from './api';

export interface Bill {
  id: string;
  provider: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  source: string;
  paid_at: string | null;
  traffic_light: { color: 'green' | 'yellow' | 'red' | 'grey'; daysLeft: number | null };
}

export interface Obligation {
  id: string;
  type: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  source: string;
  due_date: string | null;
  paid_at: string | null;
}

export interface PayDashboard {
  bills: Bill[];
  obligations: Obligation[];
  totalDue: number;
  overdueCount: number;
}

export async function getDashboard(): Promise<PayDashboard> {
  const { data } = await api.get('/pay/dashboard');
  return data;
}

export async function payBill(billId: string, biometricConfirmed: boolean) {
  const { data } = await api.post(`/pay/bills/${billId}/pay`, { biometricConfirmed });
  return data;
}

export async function payObligation(obligationId: string, biometricConfirmed: boolean) {
  const { data } = await api.post(`/pay/obligations/${obligationId}/pay`, { biometricConfirmed });
  return data;
}

export async function syncObligations(): Promise<number> {
  const { data } = await api.post('/pay/obligations/sync');
  return data.newObligations;
}

export async function getGmailAuthUrl(): Promise<string> {
  const { data } = await api.get('/pay/gmail/auth');
  return data.url;
}

export async function scanGmail(): Promise<number> {
  const { data } = await api.post('/pay/gmail/scan');
  return data.billsFound;
}

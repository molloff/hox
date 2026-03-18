import api from './api';

interface StartKycResponse {
  success: boolean;
  sdkToken: string;
  applicantId: string;
}

interface KycStatusResponse {
  kyc_status: string;
}

export async function startKyc(firstName: string, lastName: string): Promise<StartKycResponse> {
  const { data } = await api.post<StartKycResponse>('/kyc/start', { firstName, lastName });
  return data;
}

export async function getKycStatus(): Promise<string> {
  const { data } = await api.get<KycStatusResponse>('/kyc/status');
  return data.kyc_status;
}

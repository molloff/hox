import api from './api';
import { setTokens, clearTokens } from './secureStore';

interface VerifyOtpResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string;
    kyc_status: string;
    is_verified: boolean;
    profile_type: string | null;
  };
  isNewUser: boolean;
}

export async function sendOtp(phone: string): Promise<void> {
  await api.post('/auth/otp/send', { phone });
}

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResponse> {
  const { data } = await api.post<VerifyOtpResponse>('/auth/otp/verify', { phone, code });
  await setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function logout(): Promise<void> {
  await clearTokens();
}

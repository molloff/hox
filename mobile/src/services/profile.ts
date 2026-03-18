import api from './api';

export interface Profile {
  id: string;
  phone: string;
  kyc_status: string;
  is_verified: boolean;
  profile_type: string | null;
  display_name: string | null;
  skills: string[];
  description: string;
  company_name: string | null;
  eik: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileData {
  profile_type?: 'family' | 'freelancer' | 'small_business';
  display_name?: string;
  skills?: string[];
  description?: string;
  company_name?: string | null;
  eik?: string | null;
}

export async function getProfile(): Promise<Profile> {
  const { data } = await api.get<Profile>('/profile');
  return data;
}

export async function updateProfile(updates: UpdateProfileData): Promise<Profile> {
  const { data } = await api.patch<Profile>('/profile', updates);
  return data;
}

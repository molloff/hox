import { useState, useEffect, useCallback } from 'react';
import { getProfile, updateProfile, type Profile, type UpdateProfileData } from '../services/profile';

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getProfile();
      setProfile(data);
      setError(null);
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const update = async (data: UpdateProfileData) => {
    const updated = await updateProfile(data);
    setProfile((prev) => prev ? { ...prev, ...updated } : prev);
    return updated;
  };

  return { profile, loading, error, refresh: fetch, update };
}

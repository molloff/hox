import { useState, useEffect, useRef } from 'react';
import { getKycStatus } from '../services/kyc';

export function useKycStatus(pollInterval = 5000) {
  const [status, setStatus] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const check = async () => {
      try {
        const s = await getKycStatus();
        setStatus(s);
        if (s === 'verified' || s === 'rejected') {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // keep polling
      } finally {
        setLoading(false);
      }
    };

    check();
    intervalRef.current = setInterval(check, pollInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollInterval]);

  return { status, loading };
}

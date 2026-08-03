import { useState, useEffect } from 'react';
import { isQuotaExceeded, addQuotaListener } from '../lib/firebase';

export function useQuotaCheck() {
  const [quotaExceeded, setQuotaExceeded] = useState(isQuotaExceeded());

  useEffect(() => {
    const remove = addQuotaListener(() => {
      setQuotaExceeded(true);
    });
    return remove;
  }, []);

  return quotaExceeded;
}

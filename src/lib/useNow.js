import { useEffect, useState } from 'react';

/**
 * Returns a `now` epoch that ticks every `intervalMs` so duration displays
 * refresh while the user is looking at them.
 */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

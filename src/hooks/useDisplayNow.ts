import { useEffect, useState } from 'react';

/** 表示専用の現在時刻。親 state を更新せず、各 leaf component 内だけを再描画する。 */
export function useDisplayNow(tickMs = 250) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), Math.max(100, tickMs));
    return () => window.clearInterval(interval);
  }, [tickMs]);

  return now;
}

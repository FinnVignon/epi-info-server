import { useEffect, useState } from "react";

export function useTemporaryNotice(timeoutMilliseconds = 4500) {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(null), timeoutMilliseconds);

    return () => window.clearTimeout(timeout);
  }, [notice, timeoutMilliseconds]);

  return [notice, setNotice] as const;
}

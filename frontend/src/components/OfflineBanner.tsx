import { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-amber-500 text-white text-center text-xs font-medium py-1.5 px-4">
      <span className="inline-flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.464 15.536a5 5 0 010-7.072M15.536 8.464a5 5 0 010 7.072" />
        </svg>
        You&apos;re offline — showing cached data
      </span>
    </div>
  );
}

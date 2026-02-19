import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSubscription } from '../api/billing';
import { getOrgId } from '../utils/org';

export default function TrialBanner() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const orgId = getOrgId();
    if (!orgId) return;

    getSubscription()
      .then((sub) => {
        if (sub.status === 'trialing' && sub.trial_end) {
          const end = new Date(sub.trial_end);
          const now = new Date();
          const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          setDaysLeft(Math.max(0, diff));
        }
      })
      .catch(() => {});
  }, []);

  if (daysLeft === null) return null;

  let bgColor = 'bg-blue-600';
  if (daysLeft <= 3) bgColor = 'bg-red-600';
  else if (daysLeft <= 7) bgColor = 'bg-amber-500';

  return (
    <div className={`${bgColor} text-white text-center py-2 px-4 text-sm`}>
      <span className="font-medium">
        {daysLeft === 0
          ? 'Your free trial ends today'
          : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your free trial`}
      </span>
      <span className="mx-2">—</span>
      <Link to="/billing" className="underline underline-offset-2 font-semibold hover:opacity-90">
        Choose a Plan
      </Link>
    </div>
  );
}

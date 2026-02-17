import { useState, useEffect, useCallback } from 'react';
import { getSubscription, type Subscription } from '../api/billing';

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  loading: boolean;
  error: string;
  hasFeature: (feature: string) => boolean;
  isFreeTier: boolean;
  isPro: boolean;
  isEnterprise: boolean;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSubscription = useCallback(async () => {
    try {
      const data = await getSubscription();
      setSubscription(data);
      setError('');
    } catch {
      setSubscription(null);
      // 404 means no subscription, not an error
      setError('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const hasFeature = useCallback(
    (feature: string): boolean => {
      if (!subscription) return false;
      // Active subscription with the feature
      if (!subscription.is_active_subscription) return false;
      return subscription.plan_features?.[feature] === true;
    },
    [subscription]
  );

  const planSlug = subscription?.plan_slug || 'free';

  return {
    subscription,
    loading,
    error,
    hasFeature,
    isFreeTier: planSlug === 'free',
    isPro: planSlug === 'pro' || planSlug === 'enterprise',
    isEnterprise: planSlug === 'enterprise',
    refresh: fetchSubscription,
  };
}

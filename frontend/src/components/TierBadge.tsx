const TIER_STYLES: Record<string, string> = {
  starter: 'bg-gray-100 text-gray-600',
  pro: 'bg-primary-100 text-primary-700',
  enterprise: 'bg-violet-100 text-violet-700',
};

const TIER_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

interface TierBadgeProps {
  tier: 'starter' | 'pro' | 'enterprise';
  className?: string;
}

export default function TierBadge({ tier, className = '' }: TierBadgeProps) {
  if (tier === 'starter') return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${TIER_STYLES[tier] || TIER_STYLES.starter} ${className}`}>
      {TIER_LABELS[tier] || tier}
    </span>
  );
}

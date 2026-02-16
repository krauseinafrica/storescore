import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

interface RoleGuardProps {
  minRole: string;
  children: ReactNode;
  fallback?: ReactNode;
}

function DefaultAccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
        <svg
          className="w-8 h-8 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Access Denied</h2>
      <p className="text-sm text-gray-500 text-center max-w-sm">
        You don't have permission to access this page. Contact your organization
        administrator if you believe this is a mistake.
      </p>
    </div>
  );
}

export default function RoleGuard({ minRole, children, fallback }: RoleGuardProps) {
  const { hasRole } = useAuth();

  if (!hasRole(minRole)) {
    return fallback ? <>{fallback}</> : <DefaultAccessDenied />;
  }

  return <>{children}</>;
}

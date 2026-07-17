import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { PendingApprovalScreen } from './PendingApprovalScreen';
import { ForceChangePasswordScreen } from './ForceChangePasswordScreen';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback: ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading, profile, approvalStatus, isApprovedOperational } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{fallback}</>;
  }

  // Authenticated but not operationally approved
  if (profile && !isApprovedOperational) {
    return <PendingApprovalScreen status={approvalStatus} email={profile.email} />;
  }

  // Approved, but an admin set a temporary password that must be changed first
  if (profile?.must_change_password) {
    return <ForceChangePasswordScreen email={profile.email} />;
  }

  return <>{children}</>;
}

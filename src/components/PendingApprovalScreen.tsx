import { Clock, Ban, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { ApprovalStatus } from '../lib/rbac';

interface PendingApprovalScreenProps {
  status: ApprovalStatus;
  email?: string | null;
}

export function PendingApprovalScreen({ status, email }: PendingApprovalScreenProps) {
  const { signOut } = useAuth();

  const copy =
    status === 'rejected'
      ? {
          title: 'Access rejected',
          body: 'Your account request was rejected. Contact a system administrator if you believe this is an error.',
          icon: <Ban className="w-8 h-8 text-white" />,
          tone: 'bg-red-600',
        }
      : status === 'disabled'
        ? {
            title: 'Account disabled',
            body: 'Your account has been disabled. Contact a system administrator to restore access.',
            icon: <Ban className="w-8 h-8 text-white" />,
            tone: 'bg-gray-700',
          }
        : {
            title: 'Pending administrator approval',
            body: 'Your account was created successfully, but operational access is not available until a system administrator approves it.',
            icon: <Clock className="w-8 h-8 text-white" />,
            tone: 'bg-amber-600',
          };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 ${copy.tone} rounded-full mb-4`}>
          {copy.icon}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{copy.title}</h1>
        <p className="text-gray-600 mb-2">{copy.body}</p>
        {email ? <p className="text-sm text-gray-500 mb-6">{email}</p> : <div className="mb-6" />}
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </div>
  );
}

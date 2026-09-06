import React from 'react';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErrorPage } from './ErrorPage';
import { useAuth } from '../../context/AuthContext';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();
  const { displayRole, user } = useAuth();

  return (
    <ErrorPage
      statusCode={403}
      badgeText="Access Restricted"
      badgeType="danger"
      icon={<ShieldAlert size={36} />}
      title="Permission Denied"
      message="You do not have the required enterprise permissions to access this resource or perform this action."
      detail={`Current active role: ${displayRole}${user?.email ? ` (${user.email})` : ''}. If you believe you should have access, please request role escalation from your administrator.`}
      primaryAction={{
        label: 'Return to Dashboard',
        variant: 'primary',
        icon: <LayoutDashboard size={16} />,
        onClick: () => navigate('/dashboard'),
      }}
      secondaryAction={{
        label: 'Go Back',
        variant: 'secondary',
        icon: <ArrowLeft size={16} />,
        onClick: () => navigate(-1),
      }}
    />
  );
};

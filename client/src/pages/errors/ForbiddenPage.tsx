import React from 'react';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErrorPage } from './ErrorPage';
import { useAuth } from '../../context/AuthContext';
import { getDefaultWorkspacePath } from '../../utils/routes';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();
  const { displayRole, user, isAuthenticated } = useAuth();
  const workspacePath = getDefaultWorkspacePath(displayRole, isAuthenticated);

  return (
    <ErrorPage
      statusCode={403}
      badgeText="Access Restricted"
      badgeType="danger"
      icon={<ShieldAlert size={36} />}
      title="Access Restricted"
      message="You do not have the required enterprise permissions to access this module or resource."
      detail={`Active authenticated role: ${displayRole}${user?.email ? ` (${user.email})` : ''}. If you require access, please request role escalation from your PeoplePay360 administrator.`}
      primaryAction={{
        label: 'Return to Workspace',
        variant: 'primary',
        icon: <LayoutDashboard size={16} />,
        onClick: () => navigate(workspacePath),
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

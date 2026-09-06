import React from 'react';
import { Compass, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErrorPage } from './ErrorPage';
import { useAuth } from '../../context/AuthContext';
import { getDefaultWorkspacePath } from '../../utils/routes';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { displayRole, isAuthenticated } = useAuth();
  const workspacePath = getDefaultWorkspacePath(displayRole, isAuthenticated);

  return (
    <ErrorPage
      statusCode={404}
      badgeText="Page Not Found"
      badgeType="neutral"
      icon={<Compass size={36} />}
      title="Page Not Found"
      message="The page or resource you are attempting to reach does not exist, has been archived, or the URL is incorrect."
      detail="Please verify the URL or return to your active operational workspace."
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

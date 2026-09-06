import React from 'react';
import { LogIn, LockKeyhole } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ErrorPage } from './ErrorPage';
import { useAuth } from '../../context/AuthContext';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleSignIn = () => {
    // Clear any residual invalid tokens
    logout();
    navigate('/login', { state: { from: location } });
  };

  return (
    <ErrorPage
      statusCode={401}
      badgeText="Session Expired"
      badgeType="warning"
      icon={<LockKeyhole size={36} />}
      title="Authentication Required"
      message="Your session has expired or you are not currently signed in. Please sign in with your credentials to access this enterprise workspace."
      detail="For organizational data security, sessions automatically expire after periods of inactivity."
      primaryAction={{
        label: 'Sign In to Continue',
        variant: 'primary',
        icon: <LogIn size={16} />,
        onClick: handleSignIn,
      }}
    />
  );
};

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
      badgeText="Session Required"
      badgeType="warning"
      icon={<LockKeyhole size={36} />}
      title="Authentication Required"
      message="Authentication is needed to access this resource. Your session may have expired or you have not yet logged in."
      detail="For organizational data security, valid credentials must be authenticated before accessing PeoplePay360."
      primaryAction={{
        label: 'Sign In',
        variant: 'primary',
        icon: <LogIn size={16} />,
        onClick: handleSignIn,
      }}
    />
  );
};

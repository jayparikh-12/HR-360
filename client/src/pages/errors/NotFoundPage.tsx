import React from 'react';
import { Compass, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErrorPage } from './ErrorPage';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ErrorPage
      statusCode={404}
      badgeText="Page Not Found"
      badgeType="neutral"
      icon={<Compass size={36} />}
      title="Resource Not Found"
      message="The page or record you are attempting to reach does not exist, has been archived, or the URL is incorrect."
      detail="Please check the URL in the navigation bar or return to the main operational workspace."
      primaryAction={{
        label: 'Go to Dashboard',
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

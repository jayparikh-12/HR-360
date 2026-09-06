import React from 'react';
import { ServerCrash, RefreshCw, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErrorPage } from './ErrorPage';

export interface ServerErrorPageProps {
  onRetry?: () => void;
  messageOverride?: string;
}

export const ServerErrorPage: React.FC<ServerErrorPageProps> = ({ onRetry, messageOverride }) => {
  const navigate = useNavigate();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <ErrorPage
      statusCode={500}
      badgeText="System Error"
      badgeType="danger"
      icon={<ServerCrash size={36} />}
      title="Something Went Wrong"
      message={messageOverride || "The PeoplePay360 server encountered an unexpected situation while processing this request. Our systems have safely isolated the event."}
      detail="No data has been compromised. Please retry your request or return to the dashboard."
      primaryAction={{
        label: 'Try Again',
        variant: 'primary',
        icon: <RefreshCw size={16} />,
        onClick: handleRetry,
      }}
      secondaryAction={{
        label: 'Return to Dashboard',
        variant: 'secondary',
        icon: <LayoutDashboard size={16} />,
        onClick: () => navigate('/dashboard'),
      }}
    />
  );
};

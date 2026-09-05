import React from 'react';

export interface StepItem {
  id?: string | number;
  label: string;
  description?: string;
  status?: 'complete' | 'current' | 'upcoming' | 'error';
}

export interface StepperProps {
  steps: StepItem[];
  currentStep?: number;
  onStepClick?: (idx: number) => void;
  orientation?: 'horizontal' | 'vertical';
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep = 0,
  onStepClick,
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '24px' }}>
      {steps.map((step, idx) => {
        const isComplete = step.status === 'complete' || idx < currentStep;
        const isCurrent = step.status === 'current' || idx === currentStep;

        const circleBg = isComplete ? '#10b981' : isCurrent ? '#6366f1' : '#e2e8f0';
        const circleText = isComplete || isCurrent ? '#ffffff' : '#64748b';

        return (
          <React.Fragment key={idx}>
            <div
              onClick={() => onStepClick?.(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: onStepClick ? 'pointer' : 'default',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: circleBg,
                  color: circleText,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {isComplete ? '✓' : idx + 1}
              </div>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: isCurrent ? 600 : 500,
                  color: isCurrent ? '#0f172a' : '#64748b',
                }}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: isComplete ? '#10b981' : '#e2e8f0',
                  margin: '0 12px',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Stepper;

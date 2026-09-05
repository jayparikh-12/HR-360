import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rect' | 'circle';
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  variant = 'rect',
  borderRadius,
  className,
  style,
}) => {
  const getRadius = () => {
    if (borderRadius !== undefined) return borderRadius;
    if (variant === 'circle') return '50%';
    if (variant === 'text') return '4px';
    return '6px';
  };

  return (
    <div
      className={className}
      style={{
        width,
        height,
        backgroundColor: '#e2e8f0',
        borderRadius: getRadius(),
        animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        ...style,
      }}
    />
  );
};

export default Skeleton;

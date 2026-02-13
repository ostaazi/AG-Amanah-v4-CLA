import React from 'react';

interface SkeletonProps {
  className?: string; // Additional classes (e.g., width, height, colors)
  variant?: 'rect' | 'circle' | 'text';
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
  const baseClasses = "animate-pulse bg-slate-200"; // Default light color
  const variantClasses = {
    rect: "rounded-[1.5rem]",
    circle: "rounded-full",
    text: "rounded-md"
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  );
};

export default Skeleton;

import React from 'react';

export default function LoadingSpinner({ fullScreen = false, size = 'md', label = '' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${sizes[size]} animate-spin rounded-full border-[3px] border-primary-200 border-t-primary-700`}
      />
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        {spinner}
      </div>
    );
  }

  return spinner;
}

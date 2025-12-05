// Reusable UI Components with Glass Morphism, Skeleton Loaders, and Empty States

import React from 'react';

// Glass Morphism Card Component
export const GlassCard = ({ 
  children, 
  className = '',
  hover = false 
}: { 
  children: React.ReactNode; 
  className?: string;
  hover?: boolean;
}) => (
  <div 
    className={`
      bg-slate-800/40 
      backdrop-blur-lg 
      border border-slate-700/50 
      rounded-lg 
      shadow-xl
      ${hover ? 'hover:border-cyan-500/50 hover:shadow-cyan-500/20 transition-all duration-300' : ''}
      ${className}
    `}
  >
    {children}
  </div>
);

// Glass Modal Component
export const GlassModal = ({ 
  isOpen, 
  onClose, 
  children, 
  title,
  size = 'md'
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      <div className={`relative bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-auto`}>
        {title && (
          <div className="sticky top-0 bg-slate-800/95 backdrop-blur-xl border-b border-slate-700/50 px-6 py-4 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Skeleton Loader Components
export const SkeletonLoader = ({ 
  className = '', 
  variant = 'default' 
}: { 
  className?: string;
  variant?: 'default' | 'text' | 'circular' | 'rectangular';
}) => {
  const variantClasses = {
    default: 'rounded',
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  };

  return (
    <div 
      className={`animate-pulse bg-gradient-to-r from-slate-700/50 via-slate-600/50 to-slate-700/50 bg-[length:200%_100%] ${variantClasses[variant]} ${className}`}
      style={{
        animation: 'shimmer 2s infinite'
      }}
    />
  );
};

export const SkeletonCard = () => (
  <GlassCard className="p-6">
    <SkeletonLoader className="h-6 w-32 mb-4" variant="text" />
    <SkeletonLoader className="h-8 w-24 mb-2" variant="rectangular" />
    <SkeletonLoader className="h-4 w-full mb-2" variant="text" />
    <SkeletonLoader className="h-4 w-3/4" variant="text" />
  </GlassCard>
);

export const SkeletonTable = ({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) => (
  <GlassCard className="p-6">
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="text-left py-3 px-4">
                <SkeletonLoader className="h-4 w-24" variant="text" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-slate-700/50">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="py-3 px-4">
                  <SkeletonLoader className="h-4 w-full" variant="text" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </GlassCard>
);

// Empty State Component
export const EmptyState = ({ 
  icon, 
  title, 
  description,
  action,
  actionLabel = 'Get Started',
  variant = 'default'
}: { 
  icon: string | React.ReactNode;
  title: string; 
  description: string;
  action?: () => void;
  actionLabel?: string;
  variant?: 'default' | 'compact';
}) => {
  const iconSize = variant === 'compact' ? 'text-4xl' : 'text-6xl';
  const padding = variant === 'compact' ? 'py-8' : 'py-12';

  return (
    <div className={`flex flex-col items-center justify-center ${padding} px-4`}>
      <div className={`${iconSize} mb-4 opacity-80`}>
        {typeof icon === 'string' ? icon : icon}
      </div>
      <h3 className={`${variant === 'compact' ? 'text-lg' : 'text-xl'} font-bold text-white mb-2`}>
        {title}
      </h3>
      <p className="text-slate-400 text-center max-w-md mb-4">
        {description}
      </p>
      {action && (
        <button 
          onClick={action} 
          className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg hover:shadow-cyan-500/50"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// Empty state variations
export const EmptyStateNoData = ({ entity = 'items', onCreate }: { entity?: string; onCreate?: () => void }) => (
  <EmptyState
    icon="📭"
    title={`No ${entity} found`}
    description={`You haven't created any ${entity} yet. ${onCreate ? `Click the button below to get started.` : ''}`}
    action={onCreate}
    actionLabel={`Create ${entity}`}
  />
);

export const EmptyStateSearch = ({ searchTerm, onClear }: { searchTerm: string; onClear?: () => void }) => (
  <EmptyState
    icon="🔍"
    title="No results found"
    description={`We couldn't find anything matching "${searchTerm}". Try adjusting your search.`}
    action={onClear}
    actionLabel="Clear Search"
    variant="compact"
  />
);

export const EmptyStateError = ({ message, onRetry }: { message?: string; onRetry?: () => void }) => (
  <EmptyState
    icon="⚠️"
    title="Something went wrong"
    description={message || "We encountered an error while loading the data. Please try again."}
    action={onRetry}
    actionLabel="Retry"
  />
);

export const EmptyStateComingSoon = ({ feature }: { feature: string }) => (
  <EmptyState
    icon="🚧"
    title="Coming Soon"
    description={`${feature} is currently under development. Stay tuned for updates!`}
  />
);

// Loading Spinner with Glass Effect
export const LoadingSpinner = ({ 
  size = 'md',
  label 
}: { 
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) => {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-12 h-12 border-4',
    lg: 'w-16 h-16 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div 
        className={`${sizes[size]} border-cyan-500 border-t-transparent rounded-full animate-spin`}
      />
      {label && (
        <div className="text-slate-400 font-medium">{label}</div>
      )}
    </div>
  );
};

// Glass Button Component
export const GlassButton = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = ''
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg hover:shadow-cyan-500/50',
    secondary: 'bg-slate-700/50 backdrop-blur-lg border border-slate-600 hover:border-cyan-500 text-white',
    danger: 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-lg hover:shadow-red-500/50',
    success: 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg hover:shadow-emerald-500/50'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-6 py-2 text-base',
    lg: 'px-8 py-3 text-lg'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variants[variant]}
        ${sizes[size]}
        rounded-lg
        font-medium
        transition-all
        duration-300
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </button>
  );
};

// Glass Badge Component
export const GlassBadge = ({
  children,
  variant = 'default'
}: {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}) => {
  const variants = {
    default: 'bg-slate-700/50 text-slate-300 border-slate-600',
    primary: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
    warning: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
    danger: 'bg-red-500/20 text-red-300 border-red-500/50'
  };

  return (
    <span className={`
      inline-flex items-center
      px-2.5 py-0.5
      rounded-full
      text-xs font-medium
      backdrop-blur-lg
      border
      ${variants[variant]}
    `}>
      {children}
    </span>
  );
};

// Add shimmer animation styles
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(style);
}

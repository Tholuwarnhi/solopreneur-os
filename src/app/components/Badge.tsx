interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'info' | 'error';
  className?: string;
}

export default function Badge({ children, variant = 'info', className = '' }: BadgeProps) {
  const variants = {
    success: 'bg-[#10B981]/10 text-[#10B981]',
    warning: 'bg-[#F59E0B]/10 text-[#F59E0B]',
    info: 'bg-blue-50 text-blue-600',
    error: 'bg-red-50 text-red-600',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${variants[variant]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

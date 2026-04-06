import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function Button({ variant = 'primary', size = 'md', children, className = '', ...props }: ButtonProps) {
  const baseStyles = 'font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';

  const sizes = {
    sm: 'px-3 py-1 text-sm rounded-full',
    md: 'px-4 py-2 rounded-xl',
    lg: 'px-6 py-3 rounded-xl text-lg'
  };

  const variants = {
    primary: 'bg-[#10B981] text-white hover:bg-[#059669] focus:ring-[#10B981]',
    secondary: 'bg-[#0F1B2D] text-white hover:bg-[#1a2942] focus:ring-[#0F1B2D]',
    ghost: 'bg-transparent border border-gray-300 text-[#0F1B2D] hover:bg-gray-50 focus:ring-gray-300',
  };

  return (
    <button className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

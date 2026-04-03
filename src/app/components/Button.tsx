import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

export default function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variants = {
    primary: 'bg-[#10B981] text-white hover:bg-[#059669] focus:ring-[#10B981]',
    secondary: 'bg-[#0F1B2D] text-white hover:bg-[#1a2942] focus:ring-[#0F1B2D]',
    ghost: 'bg-transparent border border-gray-300 text-[#0F1B2D] hover:bg-gray-50 focus:ring-gray-300',
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

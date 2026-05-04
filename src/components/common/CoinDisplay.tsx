import { CoinIcon } from './CoinIcon';
import { cn } from '@/lib/utils';

interface CoinDisplayProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showSign?: boolean;
  className?: string;
}

const iconSizeMap = {
  sm: 'sm' as const,
  md: 'md' as const,
  lg: 'lg' as const,
};

export function CoinDisplay({ 
  amount, 
  size = 'md', 
  showIcon = true,
  showSign = false,
  className 
}: CoinDisplayProps) {
  const sign = showSign && amount > 0 ? '+' : '';
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 font-semibold',
      showSign ? (amount >= 0 ? 'text-success' : 'text-destructive') : 'text-accent',
      size === 'sm' && 'text-sm',
      size === 'md' && 'text-base',
      size === 'lg' && 'text-xl',
      className
    )}>
      {showIcon && <CoinIcon size={iconSizeMap[size]} />}
      <span>{sign}{amount.toFixed(2)}</span>
    </span>
  );
}

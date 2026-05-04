import coinIcon from '@/assets/coin-icon.png';
import { cn } from '@/lib/utils';

const sizeMap = {
  xs: 'w-5 h-5',      // 20px
  sm: 'w-6 h-6',      // 24px
  md: 'w-7 h-7',      // 28px
  lg: 'w-10 h-10',    // 40px
  xl: 'w-12 h-12',    // 48px
  hero: 'w-20 h-20 lg:w-28 lg:h-28', // 80px / 112px
} as const;

interface CoinIconProps {
  size?: keyof typeof sizeMap;
  className?: string;
}

export function CoinIcon({ size = 'md', className }: CoinIconProps) {
  return (
    <img
      src={coinIcon}
      alt="Coin"
      className={cn(
        sizeMap[size],
        'object-contain flex-shrink-0',
        className
      )}
      draggable={false}
    />
  );
}

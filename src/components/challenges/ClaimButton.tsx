import { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClaimButtonProps {
  onClick: () => Promise<void>;
  isLoading: boolean;
}

export const ClaimButton = memo(function ClaimButton({
  onClick,
  isLoading,
}: ClaimButtonProps) {
  const [isClicking, setIsClicking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleClick = async () => {
    if (isLoading || isClicking) return;
    
    setIsClicking(true);
    try {
      await onClick();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } finally {
      setIsClicking(false);
    }
  };

  const loading = isLoading || isClicking;

  return (
    <Button
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'btn-premium h-8 px-4 text-xs font-semibold',
        showSuccess && 'bg-green-500'
      )}
    >
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          <span>Claiming...</span>
        </>
      ) : showSuccess ? (
        <span>Claimed!</span>
      ) : (
        <>
          <Gift className="w-3.5 h-3.5 mr-1.5" />
          <span>Claim</span>
        </>
      )}
    </Button>
  );
});

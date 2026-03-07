import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  onDeleted: () => void;
}

export function DeleteUserDialog({ 
  open, 
  onOpenChange, 
  userId, 
  username, 
  onDeleted 
}: DeleteUserDialogProps) {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmText === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete) return;

    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc('admin_prepare_delete_user', {
        p_user_id: userId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete user');
      }

      toast({
        title: 'User Deleted',
        description: `${username}'s data has been permanently removed.`,
      });

      onDeleted();
      onOpenChange(false);
      setConfirmText('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass-overlay rounded-xl border-white/[0.08]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive font-display">
            <div className="w-10 h-10 rounded-lg bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            Delete User Permanently
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              You are about to permanently delete <strong className="text-foreground">{username}</strong> and all their data including:
            </p>
            <ul className="list-none space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-destructive/50" />Match history and participation</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-destructive/50" />Wallet and transactions</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-destructive/50" />VIP subscription</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-destructive/50" />Tips sent and received</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-destructive/50" />Team memberships</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-destructive/50" />Highlights and proofs</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-destructive/50" />Notifications</li>
            </ul>
            <p className="text-destructive font-medium">
              This action cannot be undone!
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="confirm" className="text-sm text-muted-foreground">Type DELETE to confirm</Label>
          <Input
            id="confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className={`bg-white/[0.03] border-white/[0.08] focus:border-primary/50 ${confirmText && !canDelete ? 'border-destructive' : ''}`}
          />
        </div>

        <AlertDialogFooter>
          <Button 
            variant="outline" 
            onClick={() => { onOpenChange(false); setConfirmText(''); }}
            className="border-white/[0.1] hover:bg-white/[0.05]"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || deleting}
          >
            {deleting ? (
              'Deleting...'
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Permanently
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

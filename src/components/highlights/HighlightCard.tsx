import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Play, MoreVertical, Pencil, Trash2, Star, ArrowRightLeft, X, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { VoteState } from '@/hooks/useHighlightVotes';

interface HighlightCardProps {
  id: string;
  youtubeVideoId: string;
  title: string;
  createdAt: string;
  author: {
    userId: string;
    username: string;
    avatarUrl: string | null;
  };
  currentUserId: string | null;
  isAdmin: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  voteCount: number;
  voteState: VoteState;
  onCastVote: () => void;
  onRemoveVote: () => void;
  onSwitchVote: () => void;
  isVoting: boolean;
}

export function HighlightCard({
  youtubeVideoId,
  title,
  createdAt,
  author,
  currentUserId,
  isAdmin,
  onPlay,
  onEdit,
  onDelete,
  voteCount,
  voteState,
  onCastVote,
  onRemoveVote,
  onSwitchVote,
  isVoting,
}: HighlightCardProps) {
  const [imageError, setImageError] = useState(false);
  const thumbnailUrl = imageError
    ? `https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg`
    : `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;

  const canManage = currentUserId === author.userId;
  const canDelete = canManage || isAdmin;
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  const isVotedHere = voteState === 'VOTED_THIS';

  return (
    <div
      className={cn(
        "premium-card group relative overflow-hidden transition-all duration-300",
        isVotedHere && "ring-1 ring-[hsl(var(--gold))]/30"
      )}
    >
      <div
        className="relative aspect-video cursor-pointer overflow-hidden rounded-t-[1rem]"
        onClick={onPlay}
      >
        <img
          src={thumbnailUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImageError(true)}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(255, 200, 5, 0.9)' }}>
            <Play className="w-7 h-7 text-black fill-current ml-0.5" />
          </div>
        </div>

        {isVotedHere && (
          <div className="absolute top-3 right-3 badge-gold text-[11px] flex items-center gap-1.5 shadow-lg">
            <Star className="w-3 h-3 fill-current" />
            Your Vote
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-semibold text-sm leading-snug line-clamp-2 cursor-pointer hover:text-[hsl(var(--gold))] transition-colors flex-1"
            onClick={onPlay}
          >
            {title}
          </h3>

          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="premium-surface">
                {canManage && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Avatar className="w-5 h-5">
            <AvatarImage src={author.avatarUrl || undefined} />
            <AvatarFallback className="text-[10px]">
              {author.username?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{author.username}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>

        <div className={cn(
          "rounded-xl border p-3 transition-all duration-300",
          isVotedHere
            ? "border-[hsl(var(--gold))]/20 bg-[hsl(var(--gold))]/5"
            : "border-[hsl(var(--border-soft))] bg-[hsl(var(--bg-2))]/50"
        )}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Star className={cn(
                "w-4 h-4 transition-colors",
                isVotedHere ? "text-[hsl(var(--gold))] fill-[hsl(var(--gold))]" : "text-muted-foreground"
              )} />
              <span className={cn(
                "font-mono font-bold text-lg tabular-nums transition-colors",
                isVotedHere ? "text-[hsl(var(--gold))]" : "text-foreground"
              )}>
                {voteCount}
              </span>
              <span className="text-xs text-muted-foreground">
                {voteCount === 1 ? 'vote' : 'votes'}
              </span>
            </div>

            {voteState === 'NOT_VOTED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onCastVote(); }}
                disabled={isVoting || !currentUserId}
                className="gap-1.5 font-semibold rounded-lg text-xs hover:border-[hsl(var(--gold))]/50 hover:bg-[hsl(var(--gold))]/10 hover:text-[hsl(var(--gold))] transition-all"
              >
                {isVoting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Star className="w-3.5 h-3.5" />
                )}
                {!currentUserId ? 'Login to vote' : 'Vote'}
              </Button>
            )}

            {voteState === 'VOTED_THIS' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onRemoveVote(); }}
                disabled={isVoting}
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded-lg"
              >
                {isVoting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                Remove
              </Button>
            )}

            {voteState === 'VOTED_OTHER' && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onSwitchVote(); }}
                disabled={isVoting}
                className="gap-1.5 font-semibold rounded-lg text-xs hover:border-[hsl(var(--teal))]/50 hover:bg-[hsl(var(--teal))]/10 hover:text-[hsl(var(--teal))] transition-all"
              >
                {isVoting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                )}
                Switch
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

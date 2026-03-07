import { Link } from 'react-router-dom';
import { Loader2, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Match } from '@/types';
import { cn } from '@/lib/utils';
import coinIcon from '@/assets/oleboy-coin.png';

interface MatchCardProps {
  match: Match;
  onJoin?: (matchId: string) => void;
  isJoining?: boolean;
}

export function MatchCard({ match, onJoin, isJoining }: MatchCardProps) {
  const participantCount = match.participants?.length ?? 0;
  const maxParticipants = match.team_size * 2;
  const isFull = participantCount >= maxParticipants;
  const canJoin = match.status === 'open' && !isFull;
  const isLive = match.status === 'full' || match.status === 'started' || match.status === 'in_progress';

  const statusLabel = isLive ? 'LIVE' : match.status === 'open' ? 'OPEN' : 'CLOSED';
  const statusBgColor = isLive
    ? 'bg-red-600'
    : match.status === 'open'
      ? 'bg-[#FFC805] text-black'
      : 'bg-[#1e1e1e] text-gray-400';

  const modeText = `${match.team_size}V${match.team_size}`;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="relative bg-[#121212] border border-[#1f2937] rounded-[16px] overflow-hidden"
    >
      {/* Status Badge - Top Right */}
      <div className={cn(
        'absolute top-4 right-4 px-3 py-1 rounded-lg text-xs font-bold uppercase z-10',
        statusBgColor
      )}>
        {statusLabel}
      </div>

      <div className="p-5 space-y-4">
        {/* Mode Badge and Match Name */}
        <div className="flex items-start gap-4">
          {/* Mode Badge */}
          <div className="w-12 h-12 flex items-center justify-center bg-[#1e1e1e] rounded-[12px] flex-shrink-0">
            <span className="font-bold text-[#6b7280]" style={{ fontFamily: 'Teko, sans-serif', fontSize: '20px' }}>
              {modeText}
            </span>
          </div>

          {/* Match Name */}
          <div className="flex-1 pt-1">
            <h3 className="font-bold text-white uppercase" style={{ fontFamily: 'Teko, sans-serif', fontSize: '18px' }}>
              {match.mode}
            </h3>
          </div>
        </div>

        {/* Entry Fee */}
        <div className="flex items-center gap-2">
          <img src={coinIcon} alt="coin" className="w-4 h-4" />
          <span className="text-[#FFC805] font-bold text-sm">{match.entry_fee}</span>
        </div>

        {/* Region */}
        <div className="flex items-center gap-2 text-[#6b7280]" style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '500' }}>
          <Globe className="w-3.5 h-3.5" />
          <span>{match.region}</span>
        </div>

        {/* Join/View Button */}
        <div className="pt-2">
          {canJoin && onJoin ? (
            <button
              className={cn(
                "w-full py-2 text-sm font-bold rounded-lg inline-flex items-center justify-center gap-2 bg-[#FFC805] text-black transition-colors",
                isJoining && "opacity-60 cursor-not-allowed"
              )}
              style={{ fontFamily: 'Teko, sans-serif' }}
              onClick={() => onJoin(match.id)}
              disabled={isJoining}
            >
              {isJoining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {isJoining ? 'Joining...' : 'JOIN'}
            </button>
          ) : (
            <Link
              to={`/matches/${match.id}`}
              className="w-full py-2 text-sm font-bold rounded-lg inline-flex items-center justify-center bg-[#1e1e1e] text-gray-400 transition-colors hover:bg-[#2a2a2a]"
              style={{ fontFamily: 'Teko, sans-serif' }}
            >
              VIEW
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

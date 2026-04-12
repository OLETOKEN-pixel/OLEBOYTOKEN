import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Swords, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import type { Match } from '@/types';
import coinIcon from '@/assets/oleboy-coin.png';

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function getModeBadge(teamSize: number): string {
  if (teamSize === 1) return '1V1';
  if (teamSize === 2) return '2V2';
  if (teamSize === 3) return '3V3';
  return '4V4';
}

function getStatusBadge(match: Match, isFeatured: boolean) {
  if (isFeatured) {
    return { label: 'PRIZE POOL', bg: '#FFC805', text: 'black' };
  }
  if (match.status === 'in_progress') {
    return { label: 'LIVE', bg: '#dc2626', text: 'white' };
  }
  if (match.status === 'ready_check') {
    return { label: 'STARTING', bg: '#2563eb', text: 'white' };
  }
  if (match.status === 'open') {
    return { label: 'LIVE', bg: '#dc2626', text: 'white' };
  }
  return null;
}

function MatchCard({ match, isFeatured }: { match: Match; isFeatured: boolean }) {
  const modeBadge = getModeBadge(match.team_size);
  const statusBadge = getStatusBadge(match, isFeatured);
  const isJoinable = match.status === 'open';

  return (
    <Link
      to={`/matches/${match.id}`}
      className="relative bg-[#121212] rounded-[16px] overflow-clip no-underline block h-[228px] flex-1 min-w-[200px] transition-all duration-200 hover:brightness-110"
      style={{
        border: isFeatured ? '2px solid #FFC805' : '1px solid #1f2937',
        boxShadow: isFeatured ? '0px 0px 20px 0px rgba(255,200,5,0.1)' : 'none',
      }}
    >
      {statusBadge && (
        <div
          className="absolute top-0 right-0 rounded-bl-[8px] px-2 py-1"
          style={{ backgroundColor: statusBadge.bg }}
        >
          <span
            className="font-bold text-[10px] uppercase tracking-[0.5px]"
            style={{ color: statusBadge.text }}
          >
            {statusBadge.label}
          </span>
        </div>
      )}

      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        <div
          className="w-[56px] h-[56px] rounded-[12px] flex items-center justify-center"
          style={{
            backgroundColor: isFeatured ? 'rgba(255,200,5,0.2)' : '#1e1e1e',
          }}
        >
          <span
            className="font-teko font-bold text-[24px]"
            style={{ color: isFeatured ? '#FFC805' : '#6b7280' }}
          >
            {modeBadge}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="font-semibold text-[10px] text-[#6b7280] uppercase">ENTRY FEE</span>
          <div className="flex items-center gap-1 mt-0.5">
            <img src={coinIcon} alt="coin" className="w-4 h-4" />
            <span
              className="font-bold text-[18px]"
              style={{ color: isFeatured ? 'white' : '#FFC805' }}
            >
              {match.entry_fee}
            </span>
          </div>
        </div>
      </div>

      <div className="absolute top-[104px] left-4 right-4">
        <span className="font-teko font-bold text-[20px] text-white uppercase block leading-tight">
          {match.mode}
        </span>
        <div className="flex items-center gap-1 mt-1">
          <GlobeIcon className="w-3 h-3 text-[#6b7280]" />
          <span className="font-medium text-[12px] text-[#6b7280]">{match.region}</span>
        </div>
      </div>

      <div className="absolute top-[180px] left-4 right-4">
        {isJoinable ? (
          <div
            className="rounded-[8px] py-3 text-center"
            style={{
              backgroundColor: '#FFC805',
              boxShadow: '0px 4px 12px 0px rgba(255,200,5,0.2)',
            }}
          >
            <span className="font-teko font-bold text-[14px] text-black uppercase tracking-[0.7px]">
              JOIN LOBBY
            </span>
          </div>
        ) : (
          <div className="bg-[#1e1e1e] rounded-[8px] py-3 text-center">
            <span className="font-teko font-bold text-[14px] text-[#d1d5db] uppercase tracking-[0.7px]">
              SPECTATE
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function LiveMatchesPanel() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          creator:profiles_public!matches_creator_id_fkey(username, discord_avatar_url, epic_username),
          participants:match_participants(*)
        `)
        .in('status', ['open', 'in_progress', 'ready_check'])
        .order('created_at', { ascending: false })
        .limit(4);

      if (!error && data) {
        setMatches(data as unknown as Match[]);
      }
      setLoading(false);
    };

    fetchMatches();

    const channel = supabase
      .channel('matches_home_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const featuredIndex = useMemo(() => {
    if (matches.length === 0) return -1;
    let maxFee = -1;
    let idx = 0;
    matches.forEach((m, i) => {
      if (m.entry_fee > maxFee) {
        maxFee = m.entry_fee;
        idx = i;
      }
    });
    return idx;
  }, [matches]);

  return (
    <section className="w-full max-w-[1140px] mx-auto px-6 md:px-16 py-10 md:py-16">
      <div className="flex items-center justify-between pb-4 border-b border-[#1f2937]">
        <h2
          className="font-teko font-bold text-[36px] text-white uppercase leading-none"
          style={{ letterSpacing: '0.9px' }}
        >
          LIVE MATCHES
        </h2>
        <Link
          to="/matches"
          className="flex items-center gap-1 font-semibold text-[14px] text-[#FFC805] uppercase no-underline hover:brightness-110 transition-all"
          style={{ letterSpacing: '0.7px' }}
        >
          VIEW ALL
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[228px] w-full rounded-[16px] bg-[#121212]" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-[#1e1e1e] flex items-center justify-center mb-4">
              <Swords className="w-7 h-7 text-[#6b7280]" />
            </div>
            <p className="font-teko font-bold text-[24px] text-white uppercase mb-1">No Active Matches</p>
            <p className="text-[14px] text-[#6b7280] mb-6">Be the first to create one and start competing</p>
            <Link
              to="/matches/create"
              className="flex items-center gap-2 px-6 py-3 rounded-[12px] font-teko font-bold text-[18px] text-black uppercase no-underline transition-all hover:brightness-110"
              style={{ backgroundColor: '#FFC805' }}
            >
              <Plus className="w-5 h-5" />
              Create Match
            </Link>
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-2 scrollbar-hide lg:grid lg:grid-cols-4 lg:overflow-visible">
            {matches.map((match, index) => (
              <MatchCard
                key={match.id}
                match={match}
                isFeatured={index === featuredIndex}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

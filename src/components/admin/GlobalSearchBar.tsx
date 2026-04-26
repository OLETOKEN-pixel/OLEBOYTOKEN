import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, Receipt, Search, Swords, User } from 'lucide-react';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_INSET_PANEL_CLASS,
} from '@/components/admin/AdminShell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { PremiumBadge } from '@/components/ui/premium-badge';
import { supabase } from '@/integrations/supabase/client';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { cn } from '@/lib/utils';

interface SearchResults {
  users: Array<{
    id: string;
    user_id: string;
    username: string;
    email: string;
    discord_avatar_url: string | null;
    is_banned: boolean;
  }>;
  matches: Array<{
    id: string;
    mode: string;
    region: string;
    status: string;
    entry_fee: number;
    team_size: number;
    creator_username: string;
    created_at: string;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    match_id: string | null;
    user_id: string;
    created_at: string;
  }>;
}

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }

      if (event.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('admin_global_search', { p_query: query });

      if (!error && data) {
        setResults(data as SearchResults);
      }

      setLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleResultClick = (type: 'user' | 'match' | 'transaction', id: string) => {
    setIsOpen(false);
    setQuery('');

    if (type === 'user') {
      navigate(`/admin/users/${id}`);
    } else if (type === 'match') {
      navigate(`/admin/matches/${id}`);
    }
  };

  const totalResults = results
    ? results.users.length + results.matches.length + results.transactions.length
    : 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f8488]" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search users, matches, transactions..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          className={cn('h-12 pl-10 pr-20', ADMIN_FIELD_CLASS)}
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs text-[#8f8488]">
          <kbd className="rounded border border-[#39242b] bg-[#1c1c1c] px-1.5 py-0.5 font-mono">
            <Command className="inline h-3 w-3" />
          </kbd>
          <kbd className="rounded border border-[#39242b] bg-[#1c1c1c] px-1.5 py-0.5 font-mono">K</kbd>
        </div>
      </div>

      {isOpen && query.length >= 2 ? (
        <div
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-2 max-h-[420px] overflow-y-auto rounded-[22px] border border-[#39242b] bg-[#13090b] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.5)]',
            ADMIN_INSET_PANEL_CLASS,
          )}
        >
          {loading ? (
            <div className="p-4 text-center text-[#8f8488]">
              <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : totalResults === 0 ? (
            <div className="p-4 text-center text-[#8f8488]">No results for "{query}"</div>
          ) : (
            <div className="divide-y divide-[#2b1a1f]">
              {results?.users?.length ? (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[#8f8488]">
                    Users
                  </div>
                  {results.users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleResultClick('user', user.user_id)}
                      className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition-colors hover:bg-[#1c1c1c]"
                    >
                      <Avatar className="h-9 w-9 ring-1 ring-[#302025]">
                        <AvatarImage src={getDiscordAvatarUrl(user) ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {user.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-white">{user.username}</span>
                          {user.is_banned ? <PremiumBadge variant="completed">Banned</PremiumBadge> : null}
                        </div>
                        <span className="block truncate text-xs text-[#8f8488]">{user.email}</span>
                      </div>
                      <User className="h-4 w-4 text-[#8f8488]" />
                    </button>
                  ))}
                </div>
              ) : null}

              {results?.matches?.length ? (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[#8f8488]">
                    Matches
                  </div>
                  {results.matches.map((match) => (
                    <button
                      key={match.id}
                      onClick={() => handleResultClick('match', match.id)}
                      className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition-colors hover:bg-[#1c1c1c]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#302025] bg-[#1c1c1c]">
                        <Swords className="h-4 w-4 text-[#ff8ead]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {match.team_size}v{match.team_size} {match.mode}
                          </span>
                          <PremiumBadge
                            variant={
                              match.status === 'disputed'
                                ? 'completed'
                                : match.status === 'open'
                                  ? 'open'
                                  : 'live'
                            }
                          >
                            {match.status}
                          </PremiumBadge>
                        </div>
                        <span className="text-xs text-[#8f8488]">
                          {match.region} · {match.entry_fee} Coins · by {match.creator_username}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {results?.transactions?.length ? (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[#8f8488]">
                    Transactions
                  </div>
                  {results.transactions.map((transaction) => (
                    <button
                      key={transaction.id}
                      onClick={() => transaction.match_id && handleResultClick('match', transaction.match_id)}
                      className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition-colors hover:bg-[#1c1c1c]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#302025] bg-[#1c1c1c]">
                        <Receipt className="h-4 w-4 text-[#72f1b8]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize text-white">{transaction.type}</span>
                          <span className={transaction.amount > 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}>
                            {transaction.amount > 0 ? '+' : ''}
                            {transaction.amount.toFixed(2)}
                          </span>
                        </div>
                        <span className="block truncate text-xs text-[#8f8488]">
                          {transaction.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

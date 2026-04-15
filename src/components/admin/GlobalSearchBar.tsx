import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Swords, Receipt, X, Command } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PremiumBadge } from '@/components/ui/premium-badge';
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
        setResults(data as unknown as SearchResults);
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Cerca utenti, match, transazioni..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-20 bg-white/[0.03] border-white/[0.08] focus:border-primary/50 backdrop-blur-sm"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-white/[0.05] rounded border border-white/[0.1] font-mono">
            <Command className="w-3 h-3 inline" />
          </kbd>
          <kbd className="px-1.5 py-0.5 bg-white/[0.05] rounded border border-white/[0.1] font-mono">K</kbd>
        </div>
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 glass-overlay rounded-xl border border-white/[0.08] shadow-2xl z-50 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            </div>
          ) : totalResults === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Nessun risultato per "{query}"
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {results?.users && results.users.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Utenti
                  </div>
                  {results.users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleResultClick('user', user.user_id)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.05] transition-colors text-left"
                    >
                      <Avatar className="w-8 h-8 ring-1 ring-white/[0.1]">
                        <AvatarImage src={getDiscordAvatarUrl(user) ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{user.username}</span>
                          {user.is_banned && <PremiumBadge variant="completed">Banned</PremiumBadge>}
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">{user.email}</span>
                      </div>
                      <User className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              {results?.matches && results.matches.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Match
                  </div>
                  {results.matches.map((match) => (
                    <button
                      key={match.id}
                      onClick={() => handleResultClick('match', match.id)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.05] transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Swords className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{match.team_size}v{match.team_size} {match.mode}</span>
                          <PremiumBadge variant={match.status === 'disputed' ? 'completed' : match.status === 'open' ? 'open' : 'live'}>
                            {match.status}
                          </PremiumBadge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {match.region} • {match.entry_fee} Coins • by {match.creator_username}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results?.transactions && results.transactions.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Transazioni
                  </div>
                  {results.transactions.map((tx) => (
                    <button
                      key={tx.id}
                      onClick={() => tx.match_id && handleResultClick('match', tx.match_id)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.05] transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--success))]/10 flex items-center justify-center">
                        <Receipt className="w-4 h-4 text-[hsl(var(--success))]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{tx.type}</span>
                          <span className={tx.amount > 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">{tx.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

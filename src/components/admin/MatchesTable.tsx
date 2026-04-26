import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, ChevronUp, ChevronDown, Filter, Download, AlertTriangle, ExternalLink } from 'lucide-react';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_OUTLINE_BUTTON_CLASS,
  ADMIN_TABLE_SHELL_CLASS,
} from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PremiumBadge } from '@/components/ui/premium-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Match } from '@/types';
import { REGIONS, PLATFORMS, GAME_MODES } from '@/types';
import { cn } from '@/lib/utils';

interface MatchesTableProps {
  matches: Match[];
  loading: boolean;
  fullHeight?: boolean;
  initialStatusFilter?: string;
}

type SortField = 'created_at' | 'status' | 'entry_fee' | 'region' | 'mode';
type SortDirection = 'asc' | 'desc';

const STATUS_FILTERS = ['all', 'open', 'joined', 'ready_check', 'in_progress', 'finished', 'expired', 'disputed'] as const;

const STATUS_BADGE_VARIANT: Record<string, 'live' | 'open' | 'completed' | 'vip'> = {
  open: 'open',
  joined: 'open',
  ready_check: 'vip',
  in_progress: 'live',
  finished: 'live',
  expired: 'completed',
  disputed: 'completed',
};

export function MatchesTable({ matches, loading, fullHeight = false, initialStatusFilter }: MatchesTableProps) {
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (initialStatusFilter && (STATUS_FILTERS as readonly string[]).includes(initialStatusFilter)) {
      return initialStatusFilter;
    }
    return 'all';
  });
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyProblematic, setOnlyProblematic] = useState(false);
  
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredMatches = useMemo(() => {
    let result = [...matches];

    if (statusFilter !== 'all') {
      result = result.filter(m => m.status === statusFilter);
    }

    if (regionFilter !== 'all') {
      result = result.filter(m => m.region === regionFilter);
    }

    if (platformFilter !== 'all') {
      result = result.filter(m => m.platform === platformFilter);
    }

    if (modeFilter !== 'all') {
      result = result.filter(m => m.mode === modeFilter);
    }

    if (sizeFilter !== 'all') {
      result = result.filter(m => m.team_size === parseInt(sizeFilter));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.id.toLowerCase().includes(q) ||
        m.creator?.username?.toLowerCase().includes(q)
      );
    }

    if (onlyProblematic) {
      result = result.filter(m => 
        m.status === 'disputed' || 
        m.status === 'expired' ||
        (m.status === 'ready_check' && new Date(m.created_at).getTime() < Date.now() - 10 * 60 * 1000)
      );
    }

    result.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'created_at':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'entry_fee':
          aVal = a.entry_fee;
          bVal = b.entry_fee;
          break;
        case 'region':
          aVal = a.region;
          bVal = b.region;
          break;
        case 'mode':
          aVal = a.mode;
          bVal = b.mode;
          break;
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return result;
  }, [matches, statusFilter, regionFilter, platformFilter, modeFilter, sizeFilter, searchQuery, onlyProblematic, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredMatches.length / pageSize);
  const paginatedMatches = filteredMatches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const exportCSV = () => {
    const headers = ['ID', 'Mode', 'Size', 'Region', 'Platform', 'Host', 'Entry', 'Status', 'Created'];
    const rows = filteredMatches.map(m => [
      m.id,
      m.mode,
      `${m.team_size}v${m.team_size}`,
      m.region,
      m.platform,
      m.creator?.username || '',
      m.entry_fee,
      m.status,
      new Date(m.created_at).toISOString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matches-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className={cn('flex min-h-0 flex-col gap-4', fullHeight && 'h-full')}>
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter(status);
              setCurrentPage(1);
            }}
            className={cn(
              statusFilter === status
                ? 'border-[#ff1654] bg-[#221014] text-white'
                : 'border-[#39242b] bg-[#1c1c1c] text-[#b6adb0] hover:border-[#ff1654]/40 hover:bg-[#26161b] hover:text-white'
            )}
          >
            {status === 'all' ? 'Tutti' : status.replace('_', ' ').toUpperCase()}
            {status !== 'all' && (
              <span className="ml-1 text-xs opacity-70">
                ({matches.filter(m => m.status === status).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Cerca per ID o host..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className={cn('h-11 w-full max-w-[320px]', ADMIN_FIELD_CLASS)}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('h-11', ADMIN_OUTLINE_BUTTON_CLASS)}>
              <Filter className="w-4 h-4 mr-2" />
              Filtri Avanzati
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 border-[#39242b] bg-[#13090b] text-white" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Region</Label>
                <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className={ADMIN_FIELD_CLASS}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le regioni</SelectItem>
                    {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Platform</Label>
                <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className={ADMIN_FIELD_CLASS}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le piattaforme</SelectItem>
                    {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Mode</Label>
                <Select value={modeFilter} onValueChange={(v) => { setModeFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className={ADMIN_FIELD_CLASS}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le modalità</SelectItem>
                    {GAME_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Team Size</Label>
                <Select value={sizeFilter} onValueChange={(v) => { setSizeFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className={ADMIN_FIELD_CLASS}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le size</SelectItem>
                    <SelectItem value="1">1v1</SelectItem>
                    <SelectItem value="2">2v2</SelectItem>
                    <SelectItem value="3">3v3</SelectItem>
                    <SelectItem value="4">4v4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  id="problematic" 
                  checked={onlyProblematic}
                  onCheckedChange={(checked) => { setOnlyProblematic(!!checked); setCurrentPage(1); }}
                />
                <Label htmlFor="problematic" className="text-sm flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-destructive" />
                  Solo problematici
                </Label>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex gap-2">
          <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
            <SelectTrigger className={cn('h-11 w-24', ADMIN_FIELD_CLASS)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className={cn('h-11', ADMIN_OUTLINE_BUTTON_CLASS)} onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      <p className="shrink-0 text-sm text-muted-foreground">
        {filteredMatches.length} match trovati
      </p>

      <div className={ADMIN_TABLE_SHELL_CLASS}>
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-[#171012]">
            <TableRow className="border-b border-[#2b1a1f] bg-[#171012] hover:bg-[#171012]">
              <TableHead className="w-[100px] text-muted-foreground font-semibold">ID</TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-muted-foreground font-semibold"
                onClick={() => handleSort('mode')}
              >
                <span className="flex items-center gap-1">Mode <SortIcon field="mode" /></span>
              </TableHead>
              <TableHead className="text-muted-foreground font-semibold">Size</TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-muted-foreground font-semibold"
                onClick={() => handleSort('region')}
              >
                <span className="flex items-center gap-1">Region <SortIcon field="region" /></span>
              </TableHead>
              <TableHead className="text-muted-foreground font-semibold">Host</TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-muted-foreground font-semibold"
                onClick={() => handleSort('entry_fee')}
              >
                <span className="flex items-center gap-1">Entry <SortIcon field="entry_fee" /></span>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-muted-foreground font-semibold"
                onClick={() => handleSort('status')}
              >
                <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-muted-foreground font-semibold"
                onClick={() => handleSort('created_at')}
              >
                <span className="flex items-center gap-1">Created <SortIcon field="created_at" /></span>
              </TableHead>
              <TableHead className="w-[80px] text-muted-foreground font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </TableCell>
              </TableRow>
            ) : paginatedMatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Nessun match trovato
                </TableCell>
              </TableRow>
            ) : (
              paginatedMatches.map((match) => (
                <TableRow 
                  key={match.id} 
                  className="cursor-pointer border-b border-[#24161b] transition-colors hover:bg-[#1c1c1c]"
                  onClick={() => navigate(`/admin/matches/${match.id}`)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {match.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{match.mode}</TableCell>
                  <TableCell>{match.team_size}v{match.team_size}</TableCell>
                  <TableCell>{match.region}</TableCell>
                  <TableCell>{match.creator?.username || '-'}</TableCell>
                  <TableCell className="text-accent font-medium">{match.entry_fee} C</TableCell>
                  <TableCell>
                    <PremiumBadge variant={STATUS_BADGE_VARIANT[match.status] || 'completed'}>
                      {match.status}
                    </PremiumBadge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(match.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="hover:bg-[#26161b]"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/matches/${match.id}`);
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5) {
                if (currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                }
                if (currentPage > totalPages - 3) {
                  pageNum = totalPages - 4 + i;
                }
              }
              if (pageNum > totalPages || pageNum < 1) return null;
              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    onClick={() => setCurrentPage(pageNum)}
                    isActive={currentPage === pageNum}
                    className="cursor-pointer"
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronDown, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PremiumBadge } from '@/components/ui/premium-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import type { Transaction } from '@/types';
import { cn } from '@/lib/utils';

interface TransactionsTableProps {
  transactions: Transaction[];
  loading: boolean;
}

type SortField = 'created_at' | 'type' | 'amount';
type SortDirection = 'asc' | 'desc';

export function TransactionsTable({ transactions, loading }: TransactionsTableProps) {
  const navigate = useNavigate();
  
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (typeFilter !== 'all') {
      result = result.filter(t => t.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.id?.toLowerCase().includes(q) ||
        t.match_id?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
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
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return result;
  }, [transactions, typeFilter, searchQuery, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
    const headers = ['ID', 'Type', 'Amount', 'Description', 'Match ID', 'User ID', 'Status', 'Created'];
    const rows = filteredTransactions.map(t => [
      t.id,
      t.type,
      t.amount,
      t.description || '',
      t.match_id || '',
      t.user_id,
      t.status || 'completed',
      new Date(t.created_at).toISOString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const types = ['all', 'deposit', 'lock', 'unlock', 'payout', 'refund', 'fee'];

  const TX_BADGE_VARIANT: Record<string, 'live' | 'open' | 'completed' | 'vip'> = {
    deposit: 'live',
    payout: 'live',
    refund: 'open',
    unlock: 'open',
    lock: 'vip',
    fee: 'completed',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {types.map((type) => (
          <Button
            key={type}
            variant={typeFilter === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setTypeFilter(type);
              setCurrentPage(1);
            }}
            className={cn(
              typeFilter === type
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'border-white/[0.08] hover:bg-white/[0.05] hover:border-white/[0.15]'
            )}
          >
            {type === 'all' ? 'Tutti' : type.charAt(0).toUpperCase() + type.slice(1)}
            {type !== 'all' && (
              <span className="ml-1 text-xs opacity-70">
                ({transactions.filter(t => t.type === type).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Cerca per ID, match ID, descrizione..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="w-64 bg-white/[0.03] border-white/[0.08] focus:border-primary/50"
        />

        <div className="ml-auto flex gap-2">
          <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-20 bg-white/[0.03] border-white/[0.08]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={exportCSV} className="border-white/[0.08] hover:bg-white/[0.05]">
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filteredTransactions.length} transazioni trovate
      </p>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="glass-header border-b border-white/[0.06] hover:bg-transparent">
              <TableHead className="w-[100px] text-muted-foreground font-semibold">ID</TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-muted-foreground font-semibold"
                onClick={() => handleSort('type')}
              >
                <span className="flex items-center gap-1">Type <SortIcon field="type" /></span>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-muted-foreground font-semibold"
                onClick={() => handleSort('amount')}
              >
                <span className="flex items-center gap-1">Amount <SortIcon field="amount" /></span>
              </TableHead>
              <TableHead className="text-muted-foreground font-semibold">Description</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Match</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-muted-foreground font-semibold"
                onClick={() => handleSort('created_at')}
              >
                <span className="flex items-center gap-1">Created <SortIcon field="created_at" /></span>
              </TableHead>
              <TableHead className="w-[60px] text-muted-foreground font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </TableCell>
              </TableRow>
            ) : paginatedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nessuna transazione trovata
                </TableCell>
              </TableRow>
            ) : (
              paginatedTransactions.map((tx) => (
                <TableRow key={tx.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {tx.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <PremiumBadge variant={TX_BADGE_VARIANT[tx.type] || 'completed'}>
                      {tx.type}
                    </PremiumBadge>
                  </TableCell>
                  <TableCell className={cn(
                    "font-medium",
                    tx.type === 'payout' || tx.type === 'deposit' || tx.type === 'refund' ? 'text-[hsl(var(--success))]' : 'text-destructive'
                  )}>
                    {tx.type === 'payout' || tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'unlock' ? '+' : '-'}
                    {Math.abs(tx.amount).toFixed(2)} C
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {tx.description || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {tx.match_id ? `${tx.match_id.slice(0, 8)}...` : '-'}
                  </TableCell>
                  <TableCell>
                    <PremiumBadge variant={tx.status === 'completed' ? 'live' : 'vip'}>
                      {tx.status || 'completed'}
                    </PremiumBadge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {tx.match_id && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="hover:bg-white/[0.05]"
                        onClick={() => navigate(`/admin/matches/${tx.match_id}`)}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
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
              if (totalPages > 5 && currentPage > 3) {
                pageNum = currentPage - 2 + i;
              }
              if (pageNum > totalPages) return null;
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

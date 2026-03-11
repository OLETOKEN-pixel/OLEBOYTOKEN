import { useQuery } from '@tanstack/react-query';
import { fetchFortniteMap } from '@/services/fortniteMapService';

const THIRTY_MINUTES = 30 * 60 * 1000;

export function useFortniteMap() {
  return useQuery({
    queryKey: ['fortnite', 'map'],
    queryFn: fetchFortniteMap,
    staleTime: THIRTY_MINUTES,
    retry: 2,
  });
}

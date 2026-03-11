import { supabase } from '@/integrations/supabase/client';
import type { MapVersion, PointOfInterest } from '@/types/strategy';

export async function fetchMapVersions(): Promise<MapVersion[]> {
  const { data, error } = await supabase
    .from('map_versions')
    .select('*')
    .order('chapter', { ascending: false })
    .order('season', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as MapVersion[];
}

export async function fetchCurrentMap(): Promise<MapVersion | null> {
  const { data, error } = await supabase
    .from('map_versions')
    .select('*')
    .eq('is_current', true)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as MapVersion) ?? null;
}

export async function fetchPOIs(mapVersionId: string): Promise<PointOfInterest[]> {
  if (!mapVersionId) return [];

  const { data, error } = await supabase
    .from('points_of_interest')
    .select('*')
    .eq('map_version_id', mapVersionId)
    .order('name');

  if (error) throw error;
  return (data ?? []) as unknown as PointOfInterest[];
}

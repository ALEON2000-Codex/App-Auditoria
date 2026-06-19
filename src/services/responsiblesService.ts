import { supabase } from '../supabaseClient';

export type ProfileRole = 'auditor' | 'admin' | 'super_admin';

export type ResponsibleRow = {
  id: string;
  responsible_code: string;
  responsible_name: string;
  position: string | null;
  region: string | null;
};

function applyRegionFilter<T>(
  query: T,
  profileRole: ProfileRole,
  profileRegion: string | null | undefined,
) {
  if (profileRole !== 'super_admin' && profileRegion && profileRegion !== 'Global') {
    return (query as { or: (filters: string) => T }).or(`region.eq.${profileRegion},region.is.null`);
  }

  return query;
}

export async function listActiveResponsibles(profileRole: ProfileRole, profileRegion?: string | null) {
  let query = supabase
    .from('responsibles')
    .select('id, responsible_code, responsible_name, position, region')
    .eq('is_active', true)
    .order('responsible_name', { ascending: true })
    .limit(100);

  query = applyRegionFilter(query, profileRole, profileRegion);

  return query.returns<ResponsibleRow[]>();
}

export async function searchResponsibles(queryText: string, profileRole: ProfileRole, profileRegion?: string | null) {
  const cleanQuery = queryText.trim();

  let query = supabase
    .from('responsibles')
    .select('id, responsible_code, responsible_name, position, region')
    .eq('is_active', true)
    .order('responsible_name', { ascending: true })
    .limit(50);

  query = applyRegionFilter(query, profileRole, profileRegion);

  if (cleanQuery) {
    query = query.or(`responsible_code.ilike.%${cleanQuery}%,responsible_name.ilike.%${cleanQuery}%`);
  }

  return query.returns<ResponsibleRow[]>();
}

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/supabaseClient';

type ProfileRow = {
  full_name: string;
  role: 'auditor' | 'admin' | 'super_admin';
  region: string;
};

type VisitRow = {
  id: string;
  region: string;
  visit_type_id: string;
  responsible_name: string;
  auditor_team: string;
  local_codigo: string | null;
  status: 'draft' | 'finalized';
  final_grade: number;
  final_percentage: number;
  created_at: string;
  updated_at: string;
  locales?: { nombre_local: string | null } | { nombre_local: string | null }[] | null;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
};

type AnswerRow = {
  report_id: string;
  value: 'cumple' | 'no_cumple';
};

type SummaryRow = {
  key: string;
  label: string;
  reports: number;
  average: number;
  incidents: number;
};

const visitTypes = ['TODOS', 'Sabatina', 'Nocturna'];
const statusOptions = ['TODOS', 'draft', 'finalized'];
const regions = ['TODAS', 'Costa', 'Sierra'];

const round = (value: number) => Math.round(value * 100) / 100;

export default function AdminDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [regionFilter, setRegionFilter] = useState('TODAS');
  const [visitTypeFilter, setVisitTypeFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setError('No se pudo validar la sesion.');
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, role, region')
      .eq('id', user.id)
      .single<ProfileRow>();

    if (profileError || !profileData) {
      setError('No se encontro el perfil del usuario.');
      setLoading(false);
      return;
    }

    setProfile(profileData);
    if (profileData.role !== 'super_admin' && profileData.region !== 'Global') {
      setRegionFilter(profileData.region);
    }

    const { data: visitRows, error: visitsError } = await supabase
      .from('audit_reports')
      .select('id, region, visit_type_id, responsible_name, auditor_team, local_codigo, status, final_grade, final_percentage, created_at, updated_at, locales(nombre_local), profiles(full_name)')
      .order('created_at', { ascending: false });

    if (visitsError) {
      setError(visitsError.message);
      setLoading(false);
      return;
    }

    const ids = (visitRows || []).map((visit) => visit.id);
    let answerRows: AnswerRow[] = [];

    if (ids.length > 0) {
      const { data: answerData, error: answersError } = await supabase
        .from('audit_answers_final')
        .select('report_id, value')
        .in('report_id', ids);

      if (answersError) {
        setError(answersError.message);
        setLoading(false);
        return;
      }

      answerRows = answerData || [];
    }

    setVisits((visitRows || []) as VisitRow[]);
    setAnswers(answerRows);
    setLoading(false);
  };

  const visibleVisits = useMemo(() => {
    return visits.filter((visit) => {
      const permittedRegion =
        profile?.role === 'super_admin' || profile?.region === 'Global'
          ? regionFilter
          : profile?.region || regionFilter;

      const matchesRegion = permittedRegion === 'TODAS' || visit.region === permittedRegion;
      const matchesType = visitTypeFilter === 'TODOS' || visit.visit_type_id === visitTypeFilter;
      const matchesStatus = statusFilter === 'TODOS' || visit.status === statusFilter;

      return matchesRegion && matchesType && matchesStatus;
    });
  }, [profile, regionFilter, statusFilter, visitTypeFilter, visits]);

  const incidentCountByReport = useMemo(() => {
    return answers.reduce<Record<string, number>>((acc, answer) => {
      if (answer.value === 'no_cumple') {
        acc[answer.report_id] = (acc[answer.report_id] || 0) + 1;
      }
      return acc;
    }, {});
  }, [answers]);

  const finalizedVisits = visibleVisits.filter((visit) => visit.status === 'finalized');
  const average = finalizedVisits.length > 0
    ? round(finalizedVisits.reduce((total, visit) => total + Number(visit.final_percentage || 0), 0) / finalizedVisits.length)
    : 0;
  const totalIncidents = visibleVisits.reduce((total, visit) => total + (incidentCountByReport[visit.id] || 0), 0);

  const byVisitType = useMemo(
    () => buildSummary(visibleVisits, incidentCountByReport, (visit) => visit.visit_type_id),
    [incidentCountByReport, visibleVisits],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Cargando visitas...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={loadDashboard}>
          <Text style={styles.primaryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canChooseRegion = profile?.role === 'super_admin' || profile?.region === 'Global';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.welcome}>Bienvenido, {profile?.full_name || 'Usuario'}</Text>
          <Text style={styles.scope}>{formatRole(profile?.role)} · {getRegionScope(profile)}</Text>
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/nueva-auditoria')}>
          <Text style={styles.primaryButtonText}>Nueva visita</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Visitas visibles" value={String(visibleVisits.length)} />
        <SummaryCard label="Finalizadas" value={String(finalizedVisits.length)} />
        <SummaryCard label="Promedio" value={`${average.toFixed(2)}%`} />
        <SummaryCard label="Incidencias" value={String(totalIncidents)} />
      </View>

      <View style={styles.filterBand}>
        <FilterSelect label="Tipo de visita" value={visitTypeFilter} onChange={setVisitTypeFilter} options={visitTypes} />
        <FilterSelect label="Estado" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
        {canChooseRegion && (
          <FilterSelect label="Region" value={regionFilter} onChange={setRegionFilter} options={regions} />
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Visitas recientes</Text>
        <TouchableOpacity onPress={loadDashboard}>
          <Text style={styles.linkText}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      {visibleVisits.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No hay visitas para estos filtros</Text>
          <Text style={styles.emptyText}>Crea una nueva visita o ajusta los filtros para ver resultados.</Text>
        </View>
      ) : (
        visibleVisits.map((visit) => (
          <VisitCard
            key={visit.id}
            visit={visit}
            incidents={incidentCountByReport[visit.id] || 0}
            onPress={() => {
              if (visit.status === 'draft') {
                router.push({
                  pathname: `/checklist/${visit.id}`,
                  params: {
                    region: visit.region,
                    local_id: visit.local_codigo || '',
                    visit_type_id: visit.visit_type_id,
                  },
                });
              }
            }}
          />
        ))
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Resumen por tipo</Text>
      </View>
      <View style={styles.summaryList}>
        {byVisitType.map((row) => (
          <View key={row.key} style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>{row.label}</Text>
              <Text style={styles.summaryMeta}>{row.reports} visitas</Text>
            </View>
            <View style={styles.summaryNumbers}>
              <Text style={styles.summaryAverage}>{row.average.toFixed(2)}%</Text>
              <Text style={styles.summaryIncident}>{row.incidents} inc.</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryCardLabel}>{label}</Text>
      <Text style={styles.summaryCardValue}>{value}</Text>
    </View>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <View style={styles.filterItem}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickerShell}>
        <Picker selectedValue={value} onValueChange={onChange}>
          {options.map((option) => (
            <Picker.Item key={option} label={formatFilterLabel(option)} value={option} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

function VisitCard({ visit, incidents, onPress }: { visit: VisitRow; incidents: number; onPress: () => void }) {
  const local = getRelationName(visit.locales, 'nombre_local') || 'Local sin nombre';
  const auditor = getRelationName(visit.profiles, 'full_name') || visit.auditor_team || 'Auditor no asignado';
  const start = new Date(visit.created_at);

  return (
    <TouchableOpacity
      style={[styles.visitCard, visit.status === 'finalized' && styles.visitCardFinalized]}
      onPress={onPress}
      disabled={visit.status !== 'draft'}
      activeOpacity={0.82}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTitleGroup}>
          <Text style={styles.visitTitle}>{local}</Text>
          <Text style={styles.visitSubtitle}>{visit.local_codigo || 'Sin codigo'} · {visit.region}</Text>
        </View>
        <StatusBadge status={visit.status} />
      </View>

      <View style={styles.detailGrid}>
        <Detail label="Tipo" value={visit.visit_type_id} />
        <Detail label="Inicio" value={`${formatDate(start)} · ${formatTime(start)}`} />
        <Detail label="Auditor" value={auditor} />
        <Detail label="Responsable" value={visit.responsible_name || 'Sin responsable'} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerMetric}>
          {visit.status === 'finalized'
            ? `Nota ${Number(visit.final_grade || 0).toFixed(2)} / 10 (${Number(visit.final_percentage || 0).toFixed(2)}%)`
            : 'Checklist pendiente'}
        </Text>
        <Text style={styles.footerIncident}>{incidents} incidencias</Text>
      </View>
    </TouchableOpacity>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: VisitRow['status'] }) {
  const finalized = status === 'finalized';
  return (
    <View style={[styles.badge, finalized ? styles.badgeFinalized : styles.badgeDraft]}>
      <Text style={[styles.badgeText, finalized ? styles.badgeTextFinalized : styles.badgeTextDraft]}>
        {finalized ? 'Finalizada' : 'Borrador'}
      </Text>
    </View>
  );
}

function buildSummary(
  visits: VisitRow[],
  incidents: Record<string, number>,
  getLabel: (visit: VisitRow) => string,
): SummaryRow[] {
  const groups = new Map<string, { total: number; reports: number; incidents: number; finalized: number }>();

  for (const visit of visits) {
    const label = getLabel(visit);
    const current = groups.get(label) || { total: 0, reports: 0, incidents: 0, finalized: 0 };
    current.reports += 1;
    current.incidents += incidents[visit.id] || 0;
    if (visit.status === 'finalized') {
      current.total += Number(visit.final_percentage || 0);
      current.finalized += 1;
    }
    groups.set(label, current);
  }

  return Array.from(groups.entries()).map(([label, item]) => ({
    key: label,
    label,
    reports: item.reports,
    average: item.finalized > 0 ? round(item.total / item.finalized) : 0,
    incidents: item.incidents,
  }));
}

function getRelationName<T extends string>(value: Record<T, string | null> | Record<T, string | null>[] | null | undefined, key: T) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.[key] || null;
}

function getRegionScope(profile: ProfileRow | null) {
  if (!profile) return 'Sin region';
  if (profile.role === 'super_admin') return 'Todas las regiones';
  return profile.region;
}

function formatRole(role?: string) {
  if (role === 'super_admin') return 'Super admin';
  if (role === 'admin') return 'Admin';
  return 'Auditor';
}

function formatFilterLabel(value: string) {
  if (value === 'TODOS') return 'Todos';
  if (value === 'TODAS') return 'Todas';
  if (value === 'draft') return 'Borrador';
  if (value === 'finalized') return 'Finalizada';
  return value;
}

function formatDate(date: Date) {
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatTime(date: Date) {
  if (Number.isNaN(date.getTime())) return 'Sin hora';
  return date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 36, backgroundColor: '#f3f6f8', width: '100%', maxWidth: 980, alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 8, color: '#64748b' },
  errorText: { color: '#b91c1c', fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  hero: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dde5eb', borderRadius: 8, padding: 18, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  heroText: { flex: 1 },
  welcome: { fontSize: 24, fontWeight: '800', color: '#111827' },
  scope: { marginTop: 4, fontSize: 13, color: '#64748b', fontWeight: '600' },
  primaryButton: { backgroundColor: '#0f766e', borderRadius: 7, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  summaryCard: { flexGrow: 1, flexBasis: 150, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dde5eb', borderRadius: 8, padding: 14 },
  summaryCardLabel: { fontSize: 12, color: '#64748b', fontWeight: '700' },
  summaryCardValue: { fontSize: 22, color: '#111827', fontWeight: '900', marginTop: 6 },
  filterBand: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dde5eb', borderRadius: 8, padding: 12, marginBottom: 14, gap: 10 },
  filterItem: { minWidth: 180, flex: 1 },
  label: { fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 6 },
  pickerShell: { minHeight: 48, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, overflow: 'hidden', backgroundColor: '#fff' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 10 },
  sectionTitle: { fontSize: 17, color: '#111827', fontWeight: '900' },
  linkText: { color: '#0f766e', fontWeight: '800' },
  emptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dde5eb', borderRadius: 8, padding: 18, marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  emptyText: { marginTop: 4, color: '#64748b' },
  visitCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d7e1e7', borderRadius: 8, padding: 16, marginBottom: 12 },
  visitCardFinalized: { borderColor: '#bbf7d0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  cardTitleGroup: { flex: 1 },
  visitTitle: { fontSize: 17, fontWeight: '900', color: '#111827' },
  visitSubtitle: { marginTop: 3, fontSize: 12, color: '#64748b', fontWeight: '700' },
  badge: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  badgeDraft: { backgroundColor: '#fef3c7' },
  badgeFinalized: { backgroundColor: '#dcfce7' },
  badgeText: { fontSize: 11, fontWeight: '900' },
  badgeTextDraft: { color: '#92400e' },
  badgeTextFinalized: { color: '#166534' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailItem: { flexBasis: '47%', flexGrow: 1, minHeight: 54, backgroundColor: '#f8fafc', borderRadius: 7, padding: 10 },
  detailLabel: { fontSize: 11, color: '#64748b', fontWeight: '800' },
  detailValue: { marginTop: 4, fontSize: 13, color: '#111827', fontWeight: '700' },
  cardFooter: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#edf2f7', flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  footerMetric: { color: '#0f172a', fontWeight: '800' },
  footerIncident: { color: '#b91c1c', fontWeight: '800' },
  summaryList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dde5eb', borderRadius: 8, paddingHorizontal: 14, marginBottom: 18 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#edf2f7', paddingVertical: 12 },
  summaryLabel: { color: '#111827', fontWeight: '800' },
  summaryMeta: { color: '#64748b', fontSize: 12, marginTop: 2 },
  summaryNumbers: { alignItems: 'flex-end' },
  summaryAverage: { color: '#0f172a', fontWeight: '900' },
  summaryIncident: { color: '#b91c1c', fontWeight: '800', fontSize: 12, marginTop: 2 },
});

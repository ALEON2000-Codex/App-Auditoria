import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../../../src/supabaseClient';
import SignaturePad from '../../../../src/features/audits/components/signature-pad';

export default function ConclusionesRoutePage() {
  const router = useRouter();
  const { id: reportId } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [porcentaje, setPorcentaje] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Estados de firmas en formato Base64
  const [firmaAuditor, setFirmaAuditor] = useState<string | null>(null);
  const [firmaResponsable, setFirmaResponsable] = useState<string | null>(null);

  useEffect(() => {
    async function calcularResultados() {
      setLoading(true);
      const { data: answers } = await supabase.from('audit_answers').select('value').eq('report_id', reportId);

      if (answers && answers.length > 0) {
        const totalCumple = answers.filter((a) => a.value === 'cumple').length;
        setPorcentaje(Math.round((totalCumple / answers.length) * 100));
      }
      setLoading(false);
    }
    if (reportId) calcularResultados();
  }, [reportId]);

  const handleFinalizarAuditoria = async () => {
    if (!firmaAuditor || !firmaResponsable) {
      alert('Error: Ambas firmas son obligatorias para cerrar la auditoría.');
      return;
    }

    setIsSaving(true);
    try {
      // Guardar firmas estructuradas en la tabla de auditorías de Supabase
      const { error } = await supabase
        .from('audit_reports')
        .update({
          signature_auditor: firmaAuditor,
          signature_responsible: firmaResponsable,
          status: 'finalizado',
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;

      alert('¡Auditoría cerrada y firmada con éxito!');
      router.replace('/nueva-auditoria');
    } catch (err: any) {
      alert('Error al guardar reporte final: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const ambosFirmados = firmaAuditor !== null && firmaResponsable !== null;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Cierre y Firmas</Text>
      <Text style={styles.subtitle}>Resultado de Cumplimiento: {porcentaje}%</Text>

      {/* 1. Firma del Auditor Evaluador */}
      <SignaturePad
        title="Firma del Auditor Evaluador"
        onOK={(img) => { setFirmaAuditor(img); alert('✓ Firma de auditor registrada.'); }}
        onClear={() => setFirmaAuditor(null)}
      />

      {/* 2. Firma del Responsable del Establecimiento */}
      <SignaturePad
        title="Firma del Responsable del Local"
        onOK={(img) => { setFirmaResponsable(img); alert('✓ Firma de responsable registrada.'); }}
        onClear={() => setFirmaResponsable(null)}
      />

      {/* Botón de envío bloqueado hasta recolectar ambas firmas */}
      <TouchableOpacity 
        style={[styles.submitButton, !ambosFirmados && styles.disabledButton]} 
        onPress={handleFinalizarAuditoria}
        disabled={!ambosFirmados || isSaving}
      >
        <Text style={styles.submitButtonText}>
          {isSaving ? 'Guardando Reporte...' : 'Finalizar y Sellar Auditoría 🔐'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, maxWidth: 500, alignSelf: 'center', width: '100%', backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1a202c' },
  subtitle: { fontSize: 14, color: '#4a5568', marginBottom: 20 },
  submitButton: { backgroundColor: '#10b981', padding: 15, borderRadius: 6, alignItems: 'center', marginTop: 15, marginBottom: 50 },
  disabledButton: { backgroundColor: '#a7f3d0', opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
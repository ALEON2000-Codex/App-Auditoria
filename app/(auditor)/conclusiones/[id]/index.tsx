import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../../../src/supabaseClient';
import SignaturePad from '../../../../src/features/audits/components/signature-pad';

interface AnswerRecord {
  question_id: string;
  value: 'cumple' | 'no_cumple';
  observation: string;
  evidence_url: string;
  checklist_questions?: {
    score_points: number;
  } | null;
}

export default function FinalizarReportePage() {
  const router = useRouter();
  const { id: reportId, region } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [rawAnswers, setRawAnswers] = useState<AnswerRecord[]>([]);
  const [weightedScore, setWeightedScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Almacenamiento Base64 temporal de firmas antes de subida binaria
  const [firmaAuditorBase64, setFirmaAuditorBase64] = useState<string | null>(null);
  const [firmaResponsableBase64, setFirmaResponsableBase64] = useState<string | null>(null);

  // 1. Carga previa de las respuestas del checklist para cómputo de métricas
  useEffect(() => {
    async function loadAnswersForEvaluation() {
      setLoading(true);
      const { data, error } = await supabase
        .from('audit_answers_draft')
        .select('*, checklist_questions(score_points)')
        .eq('report_id', reportId);

      if (data && data.length > 0) {
        const answers = data as AnswerRecord[];
        const obtained = answers.reduce((total, answer) => {
          const points = Number(answer.checklist_questions?.score_points || 0);
          return answer.value === 'cumple' ? total + points : total;
        }, 0);
        const possible = answers.reduce(
          (total, answer) => total + Number(answer.checklist_questions?.score_points || 0),
          0,
        );

        setRawAnswers(answers);
        setTotalQuestions(data.length);
        const cumpleCount = answers.filter((a) => a.value === 'cumple').length;
        setCorrectAnswers(cumpleCount);
        setWeightedScore(roundToTwo(obtained));
        setMaxScore(roundToTwo(possible));
      }
      setLoading(false);
    }
    if (reportId) loadAnswersForEvaluation();
  }, [reportId]);

  const base64ToBlob = async (base64Data: string) => {
    const response = await fetch(base64Data);
    const blob = await response.blob();
    return blob;
  };

  // 2. Ejecución integral del Paso 21
  const handleFinalizarReporte = async () => {
    if (!firmaAuditorBase64 || !firmaResponsableBase64) {
      alert('Error: Se requieren las firmas de ambas partes.');
      return;
    }

    setIsSaving(true);
    try {
      const folderRegion = String(region || 'general').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const folderDate = "2026-06-01";
      const storageBasePath = `${folderRegion}/${folderDate}/${reportId}/firmas`;

      // A. Procesar y transformar firmas a binario
      const blobAuditor = await base64ToBlob(firmaAuditorBase64);
      const blobResponsable = await base64ToBlob(firmaResponsableBase64);

      // B. Almacenar Firma Auditor en Storage
      const pathAuditor = `${storageBasePath}/firma_auditor.png`;
      const { error: errAuditor } = await supabase.storage.from('evidencias').upload(pathAuditor, blobAuditor, { contentType: 'image/png', upsert: true });
      if (errAuditor) throw new Error(`Firma Auditor Storage: ${errAuditor.message}`);

      // C. Almacenar Firma Responsable en Storage
      const pathResponsable = `${storageBasePath}/firma_responsable.png`;
      const { error: errResponsable } = await supabase.storage.from('evidencias').upload(pathResponsable, blobResponsable, { contentType: 'image/png', upsert: true });
      if (errResponsable) throw new Error(`Firma Responsable Storage: ${errResponsable.message}`);

      const { data: { publicUrl: urlAuditor } } = supabase.storage.from('evidencias').getPublicUrl(pathAuditor);
      const { data: { publicUrl: urlResponsable } } = supabase.storage.from('evidencias').getPublicUrl(pathResponsable);

      // D. CÁLCULO PONDERADO SOBRE 10 SEGÚN score_points
      const finalScorePercentage = maxScore > 0 ? roundToTwo((weightedScore / maxScore) * 100) : 0;
      const finalGradeBaseTen = maxScore > 0 ? roundToTwo((weightedScore / maxScore) * 10) : 0;

      // E. Migrar respuestas temporales a historial definitivo consolidado
      const answersPayload = rawAnswers.map((ra) => ({
        report_id: reportId,
        question_id: ra.question_id,
        value: ra.value,
        observation: ra.observation,
        evidence_url: ra.evidence_url,
        created_at: new Date().toISOString()
      }));

      const { error: errInsertAnswers } = await supabase.from('audit_answers_final').insert(answersPayload);
      if (errInsertAnswers) throw errInsertAnswers;

      // F. MARCAR REPORTE COMO FINALIZED Y ALMACENAR FIRMAS Y NOTAS
      const { error: errFinalizeReport } = await supabase
        .from('audit_reports')
        .update({
          signature_auditor_url: urlAuditor,
          signature_responsible_url: urlResponsable,
          final_percentage: finalScorePercentage,
          final_grade: finalGradeBaseTen,
          status: 'finalized', // Marcado estricto solicitado
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (errFinalizeReport) throw errFinalizeReport;
await supabase.functions.invoke('finalize-report', {
  body: { reportId: reportId, region: region }
});

      // G. Limpieza de tabla borrador intermedia
      await supabase.from('audit_answers_draft').delete().eq('report_id', reportId);

      alert(`Reporte consolidado con éxito.\nNota: ${finalGradeBaseTen.toFixed(2)}/10 (${finalScorePercentage.toFixed(2)}%)`);
      router.replace('/nueva-auditoria');
    } catch (err: any) {
      alert('Error en consolidación del reporte: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const ambosFirmados = firmaAuditorBase64 !== null && firmaResponsableBase64 !== null;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /><Text style={styles.textStyle}>Evaluando respuestas...</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Cierre Técnico de Auditoría</Text>
      <Text style={styles.subtitle}>Resumen analítico previo al sellado digital</Text>

      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>Preguntas Evaluadas: <Text style={styles.metricValue}>{totalQuestions}</Text></Text>
        <Text style={styles.metricLabel}>Cumplimientos: <Text style={styles.metricValue}>{correctAnswers}</Text></Text>
        <Text style={styles.metricLabel}>Puntaje ponderado: <Text style={styles.metricValue}>{weightedScore.toFixed(2)} / {maxScore.toFixed(2)}</Text></Text>
      </View>

      <SignaturePad
        title="Firma del Auditor Evaluador"
        onOK={(img) => setFirmaAuditorBase64(img)}
        onClear={() => setFirmaAuditorBase64(null)}
      />

      <SignaturePad
        title="Firma del Responsable del Local"
        onOK={(img) => setFirmaResponsableBase64(img)}
        onClear={() => setFirmaResponsableBase64(null)}
      />

      <TouchableOpacity 
        style={[styles.submitButton, !ambosFirmados && styles.disabledButton]} 
        onPress={handleFinalizarReporte}
        disabled={!ambosFirmados || isSaving}
      >
        <Text style={styles.submitButtonText}>
          {isSaving ? 'Consolidando Bloques...' : 'Cerrar y Finalizar Reporte 🔐'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, maxWidth: 500, alignSelf: 'center', width: '100%', backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  textStyle: { marginTop: 8, color: '#4a5568' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1a202c' },
  subtitle: { fontSize: 13, color: '#718096', marginBottom: 15 },
  metricCard: { backgroundColor: '#f7fafc', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  metricLabel: { fontSize: 14, fontWeight: '600', color: '#4a5568', marginBottom: 4 },
  metricValue: { fontWeight: 'bold', color: '#2d3748' },
  submitButton: { backgroundColor: '#10b981', padding: 15, borderRadius: 6, alignItems: 'center', marginTop: 15, marginBottom: 60 },
  disabledButton: { backgroundColor: '#a7f3d0', opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

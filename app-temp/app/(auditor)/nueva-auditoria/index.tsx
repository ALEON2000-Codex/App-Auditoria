import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../../../src/supabaseClient';

interface Region {
  id: string;
  nombre: string;
}

interface LocalComercial {
  codigo_interno: string;
  nombre_local: string;
  region: string;
}

export default function NuevaAuditoriaPage() {
  const router = useRouter();

  // Estados de control
  const [loading, setLoading] = useState(true);
  const [regiones, setRegiones] = useState<Region[]>([]);
  const [localesFiltrados, setLocalesFiltrados] = useState<LocalComercial[]>([]);

  // Estados del Formulario
  const [regionSeleccionada, setRegionSeleccionada] = useState('');
  const [localSeleccionado, setLocalSeleccionado] = useState('');
  const [responsableTexto, setResponsableTexto] = useState('');
  const [auditorEquipo, setAuditorEquipo] = useState('');
  const [tipoVisita, setTipoVisita] = useState('');

  // 1. CARGA INICIAL: Regiones corporativas
  useEffect(() => {
    setRegiones([
      { id: 'Costa', nombre: 'Región Costa' },
      { id: 'Sierra', nombre: 'Región Sierra' },
    ]);
    setLoading(false);
  }, []);

  // 2. CONSULTA DIRECTA A SUPABASE: Filtra locales por región en tiempo real
  useEffect(() => {
    async function fetchLocales() {
      if (!regionSeleccionada) {
        setLocalesFiltrados([]);
        return;
      }

      setLoading(true);
      
      const { data, error } = await supabase
        .from('locales')
        .select('codigo_interno, nombre_local, region')
        .eq('region', regionSeleccionada);

      if (error) {
        console.error('Error al consultar locales:', error.message);
      } else {
        setLocalesFiltrados(data || []);
      }
      
      setLocalSeleccionado('');
      setLoading(false);
    }

    fetchLocales();
  }, [regionSeleccionada]);

  const handleComenzar = async () => {
    if (!regionSeleccionada || !localSeleccionado || !responsableTexto || !auditorEquipo || !tipoVisita) {
      alert('Por favor complete todos los campos obligatorios.');
      return;
    }

    setLoading(true);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setLoading(false);
      alert('No se pudo validar la sesión del auditor.');
      return;
    }

    const { data: report, error: reportError } = await supabase
      .from('audit_reports')
      .insert([{
        user_id: user.id,
        local_codigo: localSeleccionado,
        region: regionSeleccionada,
        visit_type_id: tipoVisita,
        responsible_name: responsableTexto.trim(),
        auditor_team: auditorEquipo.trim(),
        status: 'draft',
      }])
      .select('id')
      .single();

    setLoading(false);
    if (reportError || !report) {
      alert('No se pudo crear el reporte en Supabase: ' + (reportError?.message || 'sin detalle'));
      return;
    }

    // Avanzar al flujo del checklist inyectando los parámetros reales
    router.push({
      pathname: `/checklist/${report.id}`,
      params: {
        region: regionSeleccionada,
        local_id: localSeleccionado,
        visit_type_id: tipoVisita
      }
    });
  };

  const isFormValid = regionSeleccionada && localSeleccionado && responsableTexto.trim().length > 2 && auditorEquipo.trim().length > 2 && tipoVisita;

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.card}>
        <Text style={styles.title}>Nueva Auditoría</Text>
        
        {loading && <ActivityIndicator size="small" color="#0070f3" style={{ marginBottom: 10 }} />}

        {/* Desplegable: Región */}
        <Text style={styles.label}>Región Geográfica *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={regionSeleccionada}
            onValueChange={(itemValue) => setRegionSeleccionada(itemValue)}
          >
            <Picker.Item label="-- Selecciona una Región --" value="" />
            {regiones.map(r => (
              <Picker.Item key={r.id} label={r.nombre} value={r.id} />
            ))}
          </Picker>
        </View>

        {/* Desplegable: Local Comercial */}
        <Text style={styles.label}>Local Comercial *</Text>
        <View style={[styles.pickerContainer, !regionSeleccionada && styles.disabledPicker]}>
          <Picker
            selectedValue={localSeleccionado}
            onValueChange={(itemValue) => setLocalSeleccionado(itemValue)}
            enabled={!!regionSeleccionada}
          >
            <Picker.Item label={regionSeleccionada ? "-- Selecciona un Local --" : "▲ Selecciona primero una región"} value="" />
            {localesFiltrados.map(l => (
              <Picker.Item key={l.codigo_interno} label={l.nombre_local} value={l.codigo_interno} />
            ))}
          </Picker>
        </View>

        {/* Entrada: Responsable */}
        <Text style={styles.label}>Responsable del Local *</Text>
        <TextInput
          style={styles.input}
          placeholder="Escriba el nombre completo del responsable..."
          value={responsableTexto}
          onChangeText={setResponsableTexto}
        />

        {/* Entrada: Auditor / Equipo */}
        <Text style={styles.label}>Auditor / Equipo Evaluador *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Juan Pérez / Equipo Control"
          value={auditorEquipo}
          onChangeText={setAuditorEquipo}
        />

        {/* Desplegable: Tipo de Visita */}
        <Text style={styles.label}>Tipo de Visita *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={tipoVisita}
            onValueChange={(itemValue) => setTipoVisita(itemValue)}
          >
            <Picker.Item label="-- Selecciona el Tipo --" value="" />
            <Picker.Item label="Sabatina" value="Sabatina" />
            <Picker.Item label="Nocturna" value="Nocturna" />
          </Picker>
        </View>

        {/* Botón de Envío */}
        <TouchableOpacity 
          style={[styles.button, !isFormValid && styles.disabledButton]} 
          onPress={handleComenzar}
        disabled={!isFormValid}
      >
          <Text style={styles.buttonText}>Comenzar Auditoría 📝</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', minHeight: '100%' },
  card: { backgroundColor: '#fff', padding: 25, borderRadius: 10, width: '100%', maxWidth: 450, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 5, marginTop: 10 },
  pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, backgroundColor: '#fff', marginBottom: 10, overflow: 'hidden' },
  disabledPicker: { backgroundColor: '#eaeaea', borderColor: '#ddd' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, fontSize: 15, backgroundColor: '#fff', marginBottom: 10 },
  button: { backgroundColor: '#10b981', padding: 14, borderRadius: 6, alignItems: 'center', marginTop: 15 },
  disabledButton: { backgroundColor: '#a7f3d0', opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

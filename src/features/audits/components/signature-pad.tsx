import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';

interface SignaturePadProps {
  title: string;
  onOK: (signature: string) => void;
  onClear: () => void;
}

export default function SignaturePad({ title, onOK, onClear }: SignaturePadProps) {
  const ref = useRef<SignatureViewRef>(null);

  const handleClear = () => {
    ref.current?.clearSignature();
    onClear();
  };

  const handleConfirm = () => {
    ref.current?.readSignature();
  };

  // Estilos CSS inyectados para personalizar el contenedor interno del lienzo webview
  const style = `.m-signature-pad--footer { display: none; margin: 0px; } body,html { width: 100%; height: 100%; }`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title} *</Text>
      
      <View style={styles.canvasContainer}>
        <SignatureScreen
          ref={ref}
          onOK={onOK}
          webStyle={style}
          autoClear={false}
          descriptionText=""
        />
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Limpiar Lienzo 🔄</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>Confirmar Firma ✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 25 },
  title: { fontSize: 14, fontWeight: '700', color: '#2d3748', marginBottom: 8 },
  canvasContainer: { width: '100%', height: 180, borderWidth: 1, borderColor: '#cbd5e0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff' },
  buttonGroup: { flexDirection: 'row', gap: 12, marginTop: 8 },
  clearButton: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, alignItems: 'center', backgroundColor: '#f9fafb' },
  clearButtonText: { color: '#4b5563', fontSize: 13, fontWeight: '600' },
  confirmButton: { flex: 1, padding: 10, backgroundColor: '#0070f3', borderRadius: 6, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' }
});
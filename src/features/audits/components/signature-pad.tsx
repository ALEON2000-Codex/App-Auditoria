import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';

interface SignaturePadProps {
  title: string;
  onOK: (signature: string) => void;
  onClear: () => void;
}

export default function SignaturePad({ title, onOK, onClear }: SignaturePadProps) {
  const ref = useRef<SignatureViewRef>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClear = () => {
    ref.current?.clearSignature();
    onClear();
  };

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);
      
      // Validar que hay contenido en el lienzo antes de procesar
      // La firma debe tener una longitud mínima para considerarse válida
      ref.current?.readSignature();
    } catch (error) {
      console.error('Error al confirmar firma:', error);
      Alert.alert(
        'Error',
        'Hubo un problema al procesar tu firma. Por favor, intenta de nuevo.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Validar firma después de que se procesa
  const handleSignatureCapture = (signature: string) => {
    // Validar que la firma no esté vacía
    if (!signature || signature.trim().length === 0) {
      Alert.alert(
        'Firma vacía',
        'Por favor, dibuja tu firma antes de confirmar.'
      );
      return;
    }

    // Validar longitud mínima de la firma (para evitar un simple punto)
    const base64Data = signature.split(',')[1] || signature;
    if (base64Data.length < 100) {
      Alert.alert(
        'Firma muy corta',
        'Por favor, dibuja una firma más clara y completa.'
      );
      return;
    }

    // Si pasa todas las validaciones, confirmar
    onOK(signature);
  };

  // Estilos CSS inyectados para personalizar el contenedor interno del lienzo webview
  const style = `.m-signature-pad--footer { display: none; margin: 0px; } body,html { width: 100%; height: 100%; }`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title} *</Text>
      
      <View style={styles.canvasContainer}>
        <SignatureScreen
          ref={ref}
          onOK={handleSignatureCapture}
          webStyle={style}
          autoClear={false}
          descriptionText=""
        />
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity 
          style={styles.clearButton} 
          onPress={handleClear}
          disabled={isProcessing}
        >
          <Text style={styles.clearButtonText}>Limpiar Lienzo 🔄</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.confirmButton,
            isProcessing && styles.confirmButtonDisabled
          ]} 
          onPress={handleConfirm}
          disabled={isProcessing}
        >
          <Text style={styles.confirmButtonText}>
            {isProcessing ? 'Procesando...' : 'Confirmar Firma ✓'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.helpText}>
        Dibuja tu firma completa en el área gris arriba
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    width: '100%', 
    marginBottom: 25 
  },
  title: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#2d3748', 
    marginBottom: 8 
  },
  canvasContainer: { 
    width: '100%', 
    height: 180, 
    borderWidth: 1, 
    borderColor: '#cbd5e0', 
    borderRadius: 8, 
    overflow: 'hidden', 
    backgroundColor: '#f5f5f5' 
  },
  buttonGroup: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 8 
  },
  clearButton: { 
    flex: 1, 
    padding: 10, 
    borderWidth: 1, 
    borderColor: '#e5e7eb', 
    borderRadius: 6, 
    alignItems: 'center', 
    backgroundColor: '#f9fafb' 
  },
  clearButtonText: { 
    color: '#4b5563', 
    fontSize: 13, 
    fontWeight: '600' 
  },
  confirmButton: { 
    flex: 1, 
    padding: 10, 
    backgroundColor: '#0070f3', 
    borderRadius: 6, 
    alignItems: 'center' 
  },
  confirmButtonDisabled: {
    backgroundColor: '#AEB8C6',
    opacity: 0.7,
  },
  confirmButtonText: { 
    color: '#fff', 
    fontSize: 13, 
    fontWeight: '600' 
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

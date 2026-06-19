import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';

interface SignaturePadProps {
  title: string;
  onOK: (signature: string) => void;
  onClear: () => void;
}

export default function SignaturePad({ title, onOK, onClear }: SignaturePadProps) {
  const ref = useRef<SignatureViewRef>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [hasWebSignature, setHasWebSignature] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = 2.5;
      context.strokeStyle = '#111827';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handleWebPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    isDrawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
    setHasWebSignature(true);
  };

  const handleWebPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    const context = canvasRef.current?.getContext('2d');
    if (!context) return;

    event.preventDefault();
    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopWebDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    event.preventDefault();
    isDrawingRef.current = false;
  };

  const handleClear = () => {
    if (Platform.OS === 'web') {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas && context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      setHasWebSignature(false);
      onClear();
      return;
    }

    ref.current?.clearSignature();
    onClear();
  };

  const handleConfirm = () => {
    if (Platform.OS === 'web') {
      const canvas = canvasRef.current;
      if (!canvas || !hasWebSignature) {
        onClear();
        return;
      }

      onOK(canvas.toDataURL('image/png'));
      return;
    }

    ref.current?.readSignature();
  };

  // Estilos CSS inyectados para personalizar el contenedor interno del lienzo webview
  const style = `.m-signature-pad--footer { display: none; margin: 0px; } body,html { width: 100%; height: 100%; }`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title} *</Text>
      
      <View style={styles.canvasContainer}>
        {Platform.OS === 'web' ? (
          React.createElement('canvas', {
            ref: canvasRef,
            onPointerDown: handleWebPointerDown,
            onPointerMove: handleWebPointerMove,
            onPointerUp: stopWebDrawing,
            onPointerLeave: stopWebDrawing,
            style: {
              width: '100%',
              height: '100%',
              backgroundColor: '#fff',
              cursor: 'crosshair',
              touchAction: 'none',
            },
          })
        ) : (
          <SignatureScreen
            ref={ref}
            onOK={onOK}
            webStyle={style}
            autoClear={false}
            descriptionText=""
          />
        )}
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

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '../src/supabaseClient'; // Ajusta la ruta a tu archivo si es necesario

export default function RootLayout() {
  useEffect(() => {
    // Aquí escucharemos la sesión de Supabase y validaremos si el correo es corporativo
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(auditor)" options={{ title: 'Auditorías Costa/Sierra' }} />
      <Stack.Screen name="(admin)" options={{ title: 'Panel de Control General' }} />
    </Stack>
  );
}

// src/offlineStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// Clave única para identificar los borradores en la memoria del teléfono
const CACHE_KEY_PREFIX = '@checklist_draft_';

export type StorageErrorType = 'QUOTA_EXCEEDED' | 'SERIALIZATION' | 'UNKNOWN';

export type StorageCallback = {
  onError?: (error: StorageErrorType, message: string) => void;
  onSuccess?: (message: string) => void;
};

/**
 * Detecta el tipo de error y retorna un tipo específico
 */
const classifyError = (error: any): StorageErrorType => {
  if (error?.name === 'QuotaExceededError') {
    return 'QUOTA_EXCEEDED';
  }
  if (error instanceof SyntaxError || error?.name === 'SyntaxError') {
    return 'SERIALIZATION';
  }
  return 'UNKNOWN';
};

export const offlineStorage = {
  /**
   * Guarda las respuestas de una auditoría en la memoria local
   * @param reportId - ID del reporte
   * @param answers - Respuestas a guardar
   * @param callbacks - Callbacks para manejo de errores y éxito
   */
  saveDraft: async (
    reportId: string,
    answers: any,
    callbacks?: StorageCallback
  ) => {
    try {
      const jsonValue = JSON.stringify(answers);
      await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${reportId}`, jsonValue);
      const message = `Borrador ${reportId} guardado localmente.`;
      console.log(message);
      callbacks?.onSuccess?.(message);
    } catch (e) {
      const errorType = classifyError(e);
      let userMessage = 'Error al guardar el borrador local';

      if (errorType === 'QUOTA_EXCEEDED') {
        userMessage = 'Almacenamiento del dispositivo lleno. Por favor, elimina borradores antiguos.';
      } else if (errorType === 'SERIALIZATION') {
        userMessage = 'No se pudo procesar los datos. Intenta de nuevo.';
      }

      console.error(`[${errorType}] ${userMessage}:`, e);
      callbacks?.onError?.(errorType, userMessage);
    }
  },

  /**
   * Recupera las respuestas guardadas de la memoria local
   * @param reportId - ID del reporte
   * @param callbacks - Callbacks para manejo de errores
   */
  getDraft: async (reportId: string, callbacks?: StorageCallback) => {
    try {
      const jsonValue = await AsyncStorage.getItem(
        `${CACHE_KEY_PREFIX}${reportId}`
      );
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
      const errorType = classifyError(e);
      const userMessage = 'Error al obtener el borrador local';
      
      console.error(`[${errorType}] ${userMessage}:`, e);
      callbacks?.onError?.(errorType, userMessage);
      return null;
    }
  },

  /**
   * Borra el borrador de la memoria una vez sincronizado con éxito
   * @param reportId - ID del reporte
   * @param callbacks - Callbacks para manejo de errores y éxito
   */
  clearDraft: async (reportId: string, callbacks?: StorageCallback) => {
    try {
      await AsyncStorage.removeItem(`${CACHE_KEY_PREFIX}${reportId}`);
      const message = `Borrador ${reportId} limpiado de la memoria local.`;
      console.log(message);
      callbacks?.onSuccess?.(message);
    } catch (e) {
      const errorType = classifyError(e);
      const userMessage = 'Error al eliminar el borrador local';
      
      console.error(`[${errorType}] ${userMessage}:`, e);
      callbacks?.onError?.(errorType, userMessage);
    }
  },

  /**
   * Limpia todos los borradores (útil cuando el almacenamiento está lleno)
   * @param callbacks - Callbacks para manejo de errores y éxito
   */
  clearAllDrafts: async (callbacks?: StorageCallback) => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const draftKeys = allKeys.filter((key) =>
        key.startsWith(CACHE_KEY_PREFIX)
      );

      if (draftKeys.length === 0) {
        const message = 'No hay borradores para limpiar.';
        callbacks?.onSuccess?.(message);
        return;
      }

      await AsyncStorage.multiRemove(draftKeys);
      const message = `Se eliminaron ${draftKeys.length} borradores.`;
      console.log(message);
      callbacks?.onSuccess?.(message);
    } catch (e) {
      const errorType = classifyError(e);
      const userMessage = 'Error al limpiar los borradores';
      
      console.error(`[${errorType}] ${userMessage}:`, e);
      callbacks?.onError?.(errorType, userMessage);
    }
  },
};

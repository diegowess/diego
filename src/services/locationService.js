import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { LOCATION_TRACKING_TASK } from '../constants/api';

/**
 * Inicia o rastreamento de localização em background
 */
export const startBackgroundLocationTracking = async () => {
  try {
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
    
    if (!isTaskRegistered) {
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 50,
        timeInterval: 10000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Localização ativa',
          notificationBody: 'O aplicativo está rastreando sua localização',
          notificationColor: '#000000',
        },
      });
      
      console.log('✅ Background tracking iniciado');
    }
  } catch (error) {
    console.error('❌ Erro ao iniciar background tracking:', error);
    throw error;
  }
};

/**
 * Para o rastreamento de localização em background
 */
export const stopBackgroundLocationTracking = async () => {
  try {
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
    
    if (isTaskRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      console.log('✅ Background tracking parado');
    }
  } catch (error) {
    console.error('❌ Erro ao parar background tracking:', error);
    throw error;
  }
};

/**
 * Obtém a localização atual do dispositivo
 * @returns {Promise<Object>} { latitude, longitude }
 */
export const getCurrentLocation = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permissão de localização negada');
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Erro ao obter localização:', error);
    throw error;
  }
};

/**
 * Obtém o endereço a partir de coordenadas (geocoding reverso)
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<string>} Nome da cidade
 */
export const getCityFromCoordinates = async (latitude, longitude) => {
  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (addresses && addresses.length > 0) {
      return addresses[0].city || addresses[0].subAdministrativeArea || 'Localização';
    }

    return 'Localização';
  } catch (error) {
    console.error('Erro ao obter cidade:', error);
    return 'Localização';
  }
};

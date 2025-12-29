import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook para rastreamento de localização otimizado
 * @param {string|number} motoristaId - ID do motorista
 * @param {boolean} online - Se o motorista está online
 * @param {Function} sendLocalizacao - Função para enviar localização via WebSocket
 * @returns {Object} { location, heading }
 */
export const useLocationTracker = (motoristaId, online, sendLocalizacao) => {
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const locationSubscriptionRef = useRef(null);
  const headingSubscriptionRef = useRef(null);
  const lastLocationUpdateRef = useRef(0);
  const lastSignificantLocationRef = useRef(null);

  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const atualizarLocalizacaoNoServidor = useCallback((latitude, longitude, rotacao = 0) => {
    if (!sendLocalizacao || !motoristaId || !online) {
      console.log('⚠️ Não pode atualizar localização:', { motoristaId, online });
      return false;
    }
    
    const now = Date.now();
    
    // Rate limiting: máximo uma atualização a cada 3 segundos
    if (now - lastLocationUpdateRef.current < 3000) {
      return true;
    }
    
    // Verificar se a mudança é significativa (mais de 20 metros)
    if (lastSignificantLocationRef.current) {
      const distance = calcularDistancia(
        lastSignificantLocationRef.current.latitude,
        lastSignificantLocationRef.current.longitude,
        latitude,
        longitude
      );
      
      if (distance < 20) {
        // Atualização não significativa, apenas atualizar timestamp
        lastSignificantLocationRef.current.timestamp = now;
        return true;
      }
    }
    
    // Atualizar localização no servidor (APENAS localização)
    const sent = sendLocalizacao({
      type: 'atualizar_localizacao',
      motorista_id: motoristaId,
      latitude: latitude,
      longitude: longitude,
      rotacao: rotacao,
      timestamp: now
    });
    
    if (sent) {
      lastLocationUpdateRef.current = now;
      lastSignificantLocationRef.current = {
        latitude,
        longitude,
        timestamp: now
      };
      
      // DEBUG
      console.log('📍 Localização atualizada no servidor:', { 
        latitude: latitude.toFixed(6), 
        longitude: longitude.toFixed(6),
        motoristaId 
      });
    } else {
      console.warn('⚠️ Falha ao enviar localização para servidor');
    }
    
    return sent;
  }, [sendLocalizacao, motoristaId, online]);

  useEffect(() => {
    let isMounted = true;

    const startLocationTracking = async () => {
      if (!online || !motoristaId) {
        console.log('⚠️ Location tracking não iniciado:', { online, motoristaId });
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Permissão de localização negada');
          return;
        }

        // Parar subscriptions existentes
        if (locationSubscriptionRef.current) {
          locationSubscriptionRef.current.remove();
        }
        if (headingSubscriptionRef.current) {
          headingSubscriptionRef.current.remove();
        }

        console.log('📍 Iniciando rastreamento de localização');

        // Configurar atualização de localização otimizada
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 30,
            timeInterval: 5000,
          },
          (newLocation) => {
            if (isMounted && newLocation?.coords) {
              const { latitude, longitude } = newLocation.coords;
              
              setLocation({ latitude, longitude });
              atualizarLocalizacaoNoServidor(latitude, longitude, heading);
            }
          }
        );

        // Configurar bússola
        headingSubscriptionRef.current = await Location.watchHeadingAsync(
          (newHeading) => {
            if (isMounted && newHeading) {
              const trueHeading = newHeading.trueHeading ?? 
                                newHeading.magHeading ?? 0;
              
              setHeading(trueHeading);
            }
          }
        );

      } catch (error) {
        console.error('Erro ao iniciar rastreamento:', error);
      }
    };

    const stopLocationTracking = () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      if (headingSubscriptionRef.current) {
        headingSubscriptionRef.current.remove();
        headingSubscriptionRef.current = null;
      }
      setLocation(null);
      setHeading(0);
      lastLocationUpdateRef.current = 0;
      lastSignificantLocationRef.current = null;
    };

    if (online && motoristaId) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }

    return () => {
      isMounted = false;
      stopLocationTracking();
    };
  }, [online, motoristaId, heading, atualizarLocalizacaoNoServidor]);

  return { location, heading };
};

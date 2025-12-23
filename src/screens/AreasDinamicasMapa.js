// AreasDinamicasMapa.js
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Circle, Marker } from 'react-native-maps';

// Componente para Áreas Dinâmicas no Mapa
const AreasDinamicasMapa = ({ 
  localizacaoMotorista, 
  motoristaId,
  online,
  wsManager // Receber o gerenciador WebSocket como prop
}) => {
  const [areasDinamicas, setAreasDinamicas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [lastWebSocketUpdate, setLastWebSocketUpdate] = useState(null);
  
  const lastLocationRef = useRef(null);
  const requestTimeoutRef = useRef(null);
  const connectionListenerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Configuração para evitar muitas requisições
  const REQUEST_THROTTLE_MS = 30000; // 30 segundos entre requisições regulares
  const MIN_DISTANCE_CHANGE = 100; // 100 metros para considerar mudança significativa
  const DEBOUNCE_MS = 2000; // 2 segundos de debounce para movimento
  const CONNECTION_CHECK_INTERVAL = 5000; // 5 segundos para verificar conexão

  // Função para calcular distância entre duas coordenadas (Haversine)
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Raio da Terra em metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Verificar se a localização mudou significativamente
  const hasSignificantLocationChange = useCallback((newLocation) => {
    if (!lastLocationRef.current) {
      lastLocationRef.current = newLocation;
      return true;
    }

    const distance = calculateDistance(
      lastLocationRef.current.latitude,
      lastLocationRef.current.longitude,
      newLocation.latitude,
      newLocation.longitude
    );

    if (distance >= MIN_DISTANCE_CHANGE) {
      lastLocationRef.current = newLocation;
      return true;
    }

    return false;
  }, [calculateDistance]);

  // Fallback para buscar via HTTP (método original)
  const buscarAreasDinamicasHTTP = useCallback(async () => {
    if (!online || !motoristaId) {
      
      return;
    }

    if (!localizacaoMotorista || 
        typeof localizacaoMotorista.latitude !== 'number' || 
        typeof localizacaoMotorista.longitude !== 'number') {
     
      return;
    }

    try {
      setLoading(true);
      
      
      const response = await fetch('https://beepapps.cloud/appmotorista/api_areas_dinamicas.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: localizacaoMotorista.latitude,
          longitude: localizacaoMotorista.longitude,
          motorista_id: motoristaId
        }),
      });
      
      const data = await response.json();
      
      
      if (data.success && Array.isArray(data.areas)) {
        const validas = data.areas.filter(a => {
          const lat = parseFloat(a.latitude_centro);
          const lng = parseFloat(a.longitude_centro);
          const raio = parseFloat(a.raio_metros);
          return Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(raio) && raio > 0;
        });
        setAreasDinamicas(validas);
        
      } else {
        setAreasDinamicas([]);
        
      }
    } catch (error) {
      
      setAreasDinamicas([]);
    } finally {
      setLoading(false);
    }
  }, [online, motoristaId, localizacaoMotorista]);

  // Buscar áreas dinâmicas via WebSocket
  const buscarAreasDinamicasWebSocket = useCallback(async () => {
    if (!online || !motoristaId) {
      
      return false;
    }

    if (!localizacaoMotorista || 
        typeof localizacaoMotorista.latitude !== 'number' || 
        typeof localizacaoMotorista.longitude !== 'number') {
      
      return false;
    }

    // Verificar se temos WebSocket disponível
    if (!wsManager) {
      
      buscarAreasDinamicasHTTP();
      return false;
    }

    // Verificar se está conectado ao WebSocket
    const isWsConnected = wsManager.isConnected ? wsManager.isConnected() : false;
    if (!isWsConnected) {
      
      buscarAreasDinamicasHTTP();
      return false;
    }

    // Verificar mudança significativa na localização
    if (!hasSignificantLocationChange(localizacaoMotorista)) {
      
      return false;
    }

    try {
      setLoading(true);
     
      
      let success = false;
      
      // Tentar usar método específico se disponível
      if (wsManager.solicitarAreasDinamicas) {
        success = wsManager.solicitarAreasDinamicas(
          motoristaId,
          localizacaoMotorista.latitude,
          localizacaoMotorista.longitude
        );
      } else {
        // Fallback para método send genérico
        success = wsManager.send({
          type: 'solicitar_areas_dinamicas',
          motorista_id: motoristaId,
          latitude: localizacaoMotorista.latitude,
          longitude: localizacaoMotorista.longitude,
          timestamp: Date.now()
        });
      }

      if (success) {
        
        setLastWebSocketUpdate(Date.now());
      } else {
       
        // Fallback para HTTP
        buscarAreasDinamicasHTTP();
      }

      return success;
    } catch (error) {
      
      // Fallback para HTTP
      buscarAreasDinamicasHTTP();
      return false;
    } finally {
      setLoading(false);
    }
  }, [online, motoristaId, wsManager, localizacaoMotorista, hasSignificantLocationChange, buscarAreasDinamicasHTTP]);

  // Buscar áreas (escolhe o método apropriado)
  const buscarAreasDinamicas = useCallback(() => {
    if (!online || !motoristaId) {
      
      setAreasDinamicas([]);
      return;
    }

    if (websocketConnected && wsManager) {
      buscarAreasDinamicasWebSocket();
    } else {
      buscarAreasDinamicasHTTP();
    }
  }, [online, motoristaId, websocketConnected, wsManager, buscarAreasDinamicasWebSocket, buscarAreasDinamicasHTTP]);

  // Configurar handler para resposta de áreas dinâmicas via WebSocket
  useEffect(() => {
    if (!wsManager?.addMessageHandler) {
      
      return;
    }

    const handlerAreasResponse = (data) => {
      
      
      if (data.success && Array.isArray(data.areas)) {
        const validas = data.areas.filter(a => {
          const lat = parseFloat(a.latitude_centro);
          const lng = parseFloat(a.longitude_centro);
          const raio = parseFloat(a.raio_metros);
          const isValid = Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(raio) && raio > 0;
          if (!isValid) {
           
          }
          return isValid;
        });
        setAreasDinamicas(validas);
        setLastWebSocketUpdate(Date.now());
        
      } else {
        setAreasDinamicas([]);
        
      }
    };

    const handlerAtualizacaoAutomatica = (data) => {
      
      handlerAreasResponse(data);
    };

    // Registrar handlers
    wsManager.addMessageHandler('areas_dinamicas_response', handlerAreasResponse);
    wsManager.addMessageHandler('atualizar_areas_dinamicas', handlerAtualizacaoAutomatica);
    wsManager.addMessageHandler('areas_dinamicas', handlerAreasResponse); // Handler alternativo

    return () => {
      if (wsManager?.removeMessageHandler) {
        wsManager.removeMessageHandler('areas_dinamicas_response');
        wsManager.removeMessageHandler('atualizar_areas_dinamicas');
        wsManager.removeMessageHandler('areas_dinamicas');
      }
    };
  }, [wsManager]);

  // Configurar listener para mudanças de conexão WebSocket
  useEffect(() => {
    if (!wsManager?.addConnectionListener) {
      
      return;
    }

    // Criar listener para mudanças de conexão
    connectionListenerRef.current = (isConnected) => {
      
      setWebsocketConnected(isConnected);
      
      // Se reconectou e estamos online, buscar áreas novamente
      if (isConnected && online && motoristaId && localizacaoMotorista) {
        // Pequeno delay para garantir que a conexão está estável
        setTimeout(() => {
          buscarAreasDinamicasWebSocket();
        }, 1000);
      } else if (!isConnected && online) {
        // Se desconectou mas estamos online, usar HTTP
        
        buscarAreasDinamicasHTTP();
      }
    };

    // Registrar o listener
    wsManager.addConnectionListener(connectionListenerRef.current);

    // Verificar estado inicial da conexão
    if (wsManager.isConnected) {
      const initialConnected = wsManager.isConnected();
      setWebsocketConnected(initialConnected);
      
    }

    return () => {
      if (wsManager?.removeConnectionListener && connectionListenerRef.current) {
        wsManager.removeConnectionListener(connectionListenerRef.current);
      }
    };
  }, [wsManager, online, motoristaId, localizacaoMotorista, buscarAreasDinamicasWebSocket, buscarAreasDinamicasHTTP]);

  // Polling regular para atualizar áreas (com throttle)
  useEffect(() => {
    if (!online) {
     
      setAreasDinamicas([]);
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      return;
    }

    if (!motoristaId || !localizacaoMotorista) {
      
      return;
    }

    

    // Função para fazer a requisição com controle de throttle
    const fazerRequisicao = () => {
      
      buscarAreasDinamicas();
      
      // Agendar próxima requisição
      requestTimeoutRef.current = setTimeout(fazerRequisicao, REQUEST_THROTTLE_MS);
    };

    // Iniciar primeira requisição
    fazerRequisicao();

    // Cleanup
    return () => {
      
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [online, motoristaId, localizacaoMotorista, buscarAreasDinamicas]);

  // Buscar áreas quando a localização mudar (com debounce)
  useEffect(() => {
    if (!online || !motoristaId || !localizacaoMotorista) {
      return;
    }

    // Limpar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Configurar novo timer com debounce
    debounceTimerRef.current = setTimeout(() => {
      
      buscarAreasDinamicas();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [online, motoristaId, localizacaoMotorista?.latitude, localizacaoMotorista?.longitude, buscarAreasDinamicas]);

  // Buscar áreas quando ficar online
  useEffect(() => {
    if (online && motoristaId && localizacaoMotorista) {
      
      // Pequeno delay para garantir que tudo está inicializado
      const timer = setTimeout(() => {
        buscarAreasDinamicas();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [online, motoristaId, localizacaoMotorista, buscarAreasDinamicas]);

  // Função para determinar a cor baseada no multiplicador
  const getCorPorMultiplicador = useCallback((multiplicador) => {
    const mult = parseFloat(multiplicador);
    if (mult >= 2.0) return 'rgba(255, 0, 0, 0.3)';    // Vermelho
    if (mult >= 1.5) return 'rgba(255, 107, 0, 0.3)'; // Laranja
    if (mult >= 1.2) return 'rgba(255, 215, 0, 0.3)'; // Amarelo
    if (mult >= 1.0) return 'rgba(0, 255, 0, 0.3)';   // Verde
    return 'rgba(128, 128, 128, 0.3)'; // Cinza
  }, []);

  // Função para determinar a cor da borda
  const getCorBordaPorMultiplicador = useCallback((multiplicador) => {
    const mult = parseFloat(multiplicador);
    if (mult >= 2.0) return 'rgba(255, 0, 0, 0.8)';
    if (mult >= 1.5) return 'rgba(255, 107, 0, 0.8)';
    if (mult >= 1.2) return 'rgba(255, 215, 0, 0.8)';
    if (mult >= 1.0) return 'rgba(0, 255, 0, 0.8)';
    return 'rgba(128, 128, 128, 0.8)';
  }, []);

  // Formatar timestamp da última atualização
  const formatLastUpdate = () => {
    if (!lastWebSocketUpdate) return 'Nunca';
    
    const diff = Date.now() - lastWebSocketUpdate;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Agora mesmo';
    if (minutes === 1) return '1 minuto atrás';
    return `${minutes} minutos atrás`;
  };

  return (
    <>
      {areasDinamicas.map((area, index) => (
        <Fragment key={area.id || `area-${index}-${area.latitude_centro}-${area.longitude_centro}`}>
          <Circle
            center={{
              latitude: parseFloat(area.latitude_centro),
              longitude: parseFloat(area.longitude_centro)
            }}
            radius={parseFloat(area.raio_metros)}
            fillColor={getCorPorMultiplicador(parseFloat(area.multiplicador))}
            strokeColor={getCorBordaPorMultiplicador(parseFloat(area.multiplicador))}
            strokeWidth={2}
            zIndex={1}
          />
          <Marker
            coordinate={{
              latitude: parseFloat(area.latitude_centro),
              longitude: parseFloat(area.longitude_centro)
            }}
            title={area.nome_area || `Área ${parseFloat(area.multiplicador).toFixed(1)}x`}
            description={`${area.multiplicador}x - ${area.descricao || 'Área dinâmica'}`}
            tracksViewChanges={false}
            zIndex={2}
          >
            <CustomMarkerArea multiplicador={area.multiplicador} />
          </Marker>
        </Fragment>
      ))}
    </>
  );
};

// Componente personalizado para o marcador da área
const CustomMarkerArea = ({ multiplicador }) => {
  const getMarkerStyle = useCallback((mult) => {
    const m = parseFloat(mult);
    if (m >= 2.0) return styles.markerVeryHigh;
    if (m >= 1.5) return styles.markerHigh;
    if (m >= 1.2) return styles.markerMedium;
    if (m >= 1.0) return styles.markerNormal;
    return styles.markerLow;
  }, []);

  const getTextStyle = useCallback((mult) => {
    const m = parseFloat(mult);
    if (m >= 1.5) return styles.textLight;
    return styles.textDark;
  }, []);

  return (
    <View style={[styles.markerBase, getMarkerStyle(multiplicador)]}>
      <Text style={[styles.markerText, getTextStyle(multiplicador)]}>
        {parseFloat(multiplicador).toFixed(1)}x
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  markerBase: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerVeryHigh: {
    backgroundColor: '#FF0000',
  },
  markerHigh: {
    backgroundColor: '#FF6B00',
  },
  markerMedium: {
    backgroundColor: '#FFD700',
  },
  markerNormal: {
    backgroundColor: '#00FF00',
  },
  markerLow: {
    backgroundColor: '#808080',
  },
  markerText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  textLight: {
    color: '#FFF',
  },
  textDark: {
    color: '#000',
  },
  loadingIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  connectionIndicator: {
    position: 'absolute',
    top: 50,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connected: {
    backgroundColor: '#10B981',
  },
  disconnected: {
    backgroundColor: '#EF4444',
  },
  connectionTextContainer: {
    flexDirection: 'column',
  },
  connectionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  lastUpdateText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  areasCounter: {
    position: 'absolute',
    top: 90,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
  },
  areasCounterText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default AreasDinamicasMapa;

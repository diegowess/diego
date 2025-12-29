import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Dimensions,
  Easing,
  Modal,
  NativeModules,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Hooks
import { useLocationTracker } from '../hooks/useLocationTracker';
import { useWebSocket } from '../hooks/useWebSocket';

// Serviços
import { aceitarCorrida, carregarGanhos, recusarCorrida } from '../services/apiService';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from '../services/locationService';

// Constantes
import { API_ACAO_CORRIDA, WS_CORRIDAS_URL, WS_LOCALIZACAO_URL } from '../constants/api';
import { uberMapStyle } from '../constants/mapStyles';

// Utils
import { formatDistanciaCorrida, formatTempoCorrida, formatValorCorrida, getPassengerName, getPassengerRating } from '../utils/rideFormatters';

// Stores
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';

import AreasDinamicasMapa from './AreasDinamicasMapa';
import CarteiraScreen from './CarteiraScreen';
import GanhosScreen from './GanhosScreen';

// Constante de mensagens de busca
const SEARCHING_MESSAGES = [
  'Buscando Corrida que encaixa no seu perfil...',
  'Sincronizando localização...',
  'Aguardando novas chamadas próximas...'
];

const { width, height } = Dimensions.get('window');
const { DriverForegroundService } = NativeModules || {};


// Componente principal
export default function MainScreen({ route }) {
  const navigation = useNavigation();
  
  // Stores
  const { motoristaId, tipoVeiculo, loadUser } = useAuthStore();
  const {
    online,
    setOnline,
    saldoDia,
    setSaldoDia,
    corridaAtual,
    setCorridaAtual,
    temCorridaAtiva,
    setTemCorridaAtiva,
    localizacaoMotorista,
    setLocalizacaoMotorista,
    cidadeAtual,
    setCidadeAtual,
    wsLocalizacaoStatus,
    setWsLocalizacaoStatus,
    wsCorridasStatus,
    setWsCorridasStatus,
  } = useAppStore();
  
  // Estados locais
  const [saldoOculto, setSaldoOculto] = useState(false);
  const [ganhosModalVisivel, setGanhosModalVisivel] = useState(false);
  const [carteiraModalVisivel, setCarteiraModalVisivel] = useState(false);
  const [ganhosScreenModalVisivel, setGanhosScreenModalVisivel] = useState(false);
  const [modalCorrida, setModalCorrida] = useState(false);
  const [buscandoLocalizacao, setBuscandoLocalizacao] = useState(false);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [currentHeading, setCurrentHeading] = useState(0);
  const lastGeocodeKeyRef = useRef(null);
  const [debugInfo, setDebugInfo] = useState('');
  
  // Referências
  const mapRef = useRef(null);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const timerIntervalRef = useRef(null);
  const dismissedRideIdRef = useRef(null);
  const rideSoundRef = useRef(null);
  const lastRideSoundAtRef = useRef(0);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const messageAnim = useRef(new Animated.Value(0)).current;
  const [progressContainerWidth, setProgressContainerWidth] = useState(0);
  const rideSolicitIntervalRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  
  // PanResponder corrigido
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Verificar se temos corrida atual antes de iniciar arrasto
        if (!corridaAtual || !motoristaId) {
          Alert.alert('Atenção', 'Nenhuma corrida disponível para interação');
          return false;
        }
        return true;
      },
      onPanResponderMove: (_, gestureState) => {
        const dx = gestureState.dx || 0;
        // Limitar arrasto máximo a 120px
        const limitedDx = Math.max(-120, Math.min(120, dx));
        dragX.setValue(limitedDx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const dx = gestureState.dx || 0;
        const vx = gestureState.vx || 0;
        
        console.log('🔄 Gestos de arrasto detectado:', { dx, vx, corridaId: corridaAtual?.id });
        
        // Aceitar se arrastou para direita (+60px) com velocidade positiva
        if (dx > 60 || (dx > 30 && vx > 0.5)) {
          console.log('✅ Aceitar corrida via arrasto');
          Animated.spring(dragX, { 
            toValue: 0, 
            useNativeDriver: true,
            friction: 8,
            tension: 40
          }).start();
          
          // Pequeno delay para animação antes da ação
          setTimeout(() => {
            handleAceitarCorrida();
          }, 150);
          return;
        }
        
        // Recusar se arrastou para esquerda (-60px) com velocidade negativa
        if (dx < -60 || (dx < -30 && vx < -0.5)) {
          console.log('❌ Recusar corrida via arrasto');
          Animated.spring(dragX, { 
            toValue: 0, 
            useNativeDriver: true,
            friction: 8,
            tension: 40
          }).start();
          
          setTimeout(() => {
            handleRecusarCorrida();
          }, 150);
          return;
        }
        
        // Retornar à posição original
        Animated.spring(dragX, { 
          toValue: 0, 
          useNativeDriver: true,
          friction: 8,
          tension: 40
        }).start();
      },
    })
  ).current;
  
  const lastCorridasLoginAtRef = useRef(0);
  const lastLocalizacaoLoginAtRef = useRef(0);
  const lastCorridasStatusAtRef = useRef(0);
  const lastLocalizacaoStatusAtRef = useRef(0);
  
  const [searchingIndex, setSearchingIndex] = useState(0);

  const [snackbarState, setSnackbarState] = useState({ visible: false, message: '', kind: 'info' });
  const snackbarTimeoutRef = useRef(null);

  const showUiMessage = useCallback((message, kind = 'info') => {
    try {
      console.log('[BOLHA]', kind, message);
    } catch (e) {}

    if (Platform.OS === 'android') {
      try {
        ToastAndroid.show(String(message), ToastAndroid.SHORT);
      } catch (e) {}
    }

    try {
      setSnackbarState({ visible: true, message: String(message), kind });
      if (snackbarTimeoutRef.current) {
        clearTimeout(snackbarTimeoutRef.current);
      }
      snackbarTimeoutRef.current = setTimeout(() => {
        setSnackbarState((prev) => ({ ...prev, visible: false }));
      }, 2800);
    } catch (e) {}
  }, []);

  const ensureOverlayPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    if (!DriverForegroundService) {
      showUiMessage('Erro: módulo DriverForegroundService não encontrado', 'error');
      return false;
    }
    if (!DriverForegroundService?.hasOverlayPermission) {
      showUiMessage('Aviso: método hasOverlayPermission não disponível', 'error');
      return false;
    }
    try {
      const hasPermission = await DriverForegroundService.hasOverlayPermission();
      if (hasPermission) return true;

      if (DriverForegroundService?.requestOverlayPermission) {
        Alert.alert(
          'Permissão necessária',
          'Para exibir a bolha flutuante quando o app estiver minimizado (como Uber/99), você precisa permitir "Exibir sobre outros apps".\n\nApós conceder a permissão, volte ao app e tente novamente.',
          [
            { text: 'Agora não', style: 'cancel' },
            {
              text: 'Abrir Configurações',
              onPress: () => {
                // Usar setTimeout para evitar problemas de sincronização
                setTimeout(async () => {
                  try {
                    if (DriverForegroundService?.requestOverlayPermission) {
                      await DriverForegroundService.requestOverlayPermission();
                      console.log('✅ Tela de permissão aberta');
                    } else {
                      // Fallback direto se método não disponível
                      await Linking.openSettings();
                    }
                  } catch (err) {
                    console.error('❌ Erro ao abrir configurações:', err);
                    // Fallback: tentar abrir manualmente
                    try {
                      await Linking.openSettings();
                    } catch (_linkErr) {
                      console.error('❌ Erro ao abrir configurações via Linking:', _linkErr);
                      showUiMessage('Não foi possível abrir as configurações automaticamente. Vá manualmente em: Configurações > Apps > BeepCarMotorista > Exibir sobre outros apps', 'error');
                    }
                  }
                }, 100);
              },
            },
          ]
        );
      } else {
        // Fallback se o método não estiver disponível
        Alert.alert(
          'Permissão necessária',
          'Para exibir a bolha flutuante, você precisa permitir "Exibir sobre outros apps".\n\nVá em: Configurações > Apps > BeepCarMotorista > Exibir sobre outros apps',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Abrir Configurações',
              onPress: async () => {
                try {
                  await Linking.openSettings();
                } catch (_err) {
                  showUiMessage('Não foi possível abrir as configurações automaticamente.', 'error');
                }
              },
            },
          ]
        );
      }

      return false;
    } catch (e) {
      showUiMessage(`Erro ao checar permissão de overlay: ${e?.message || e}`, 'error');
      return false;
    }
  }, [showUiMessage]);

  const hideBubbleManually = async () => {
    if (Platform.OS !== 'android') {
      showUiMessage('Funcionalidade disponível apenas no Android', 'error');
      return;
    }
    
    try {
      if (!DriverForegroundService?.hideBubble) {
        showUiMessage('Erro: método hideBubble não disponível', 'error');
        return;
      }

      console.log('🔴 Escondendo bolha...');
      await DriverForegroundService.hideBubble();
      showUiMessage('Bolha removida da tela', 'info');
      console.log('✅ Bolha escondida com sucesso');
    } catch (err) {
      console.error('❌ Erro ao esconder bolha:', err);
      showUiMessage(`Erro ao esconder bolha: ${err?.message || err}`, 'error');
    }
  };

  const forceShowBubbleAndMinimize = async () => {
    if (Platform.OS !== 'android') {
      showUiMessage('Funcionalidade disponível apenas no Android', 'error');
      return;
    }
    
    try {
      if (!DriverForegroundService) {
        showUiMessage('Erro: módulo DriverForegroundService não encontrado. Recompile o app.', 'error');
        console.error('DriverForegroundService não disponível');
        return;
      }

      console.log('🔵 Iniciando processo de forçar bolha...');

      // 1. Verificar e solicitar permissão de overlay
      showUiMessage('Verificando permissões...', 'info');
      const ok = await ensureOverlayPermission();
      if (!ok) {
        
        return;
      }
      console.log('✅ Permissão de overlay concedida');

      // 2. Iniciar o serviço primeiro
      if (!DriverForegroundService?.startService) {
        showUiMessage('Erro: método startService não disponível', 'error');
        return;
      }

      try {
        showUiMessage('Iniciando serviço em background...', 'info');
        console.log('🔵 Iniciando serviço com URL:', WS_CORRIDAS_URL);
        await DriverForegroundService.startService(WS_CORRIDAS_URL);
        console.log('✅ Serviço iniciado');
        
        // Aguardar um pouco para o serviço inicializar
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.error('❌ Erro ao iniciar serviço:', e);
        showUiMessage(`Falha ao iniciar serviço: ${e?.message || e}`, 'error');
        return;
      }

      // 3. Mostrar a bolha
      if (!DriverForegroundService?.showBubble) {
        showUiMessage('Erro: método showBubble não disponível', 'error');
        return;
      }

      try {
        await DriverForegroundService.showBubble();
        console.log('✅ showBubble chamado com sucesso');
        
        // Aguardar um pouco para a bolha aparecer
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        console.error('❌ Erro ao exibir bolha:', e);
        showUiMessage(`Falha ao exibir bolha: ${e?.message || e}. Verifique se a permissão foi concedida.`, 'error');
        return;
      }

      // 4. Minimizar o app
      if (!DriverForegroundService?.moveTaskToBack) {
        showUiMessage('Erro: método moveTaskToBack não disponível', 'error');
        return;
      }

      try {
        showUiMessage('Minimizando app...', 'info');
        console.log('🔵 Minimizando app...');
        await DriverForegroundService.moveTaskToBack();
        console.log('✅ App minimizado');
      } catch (e) {
        console.error('❌ Erro ao minimizar app:', e);
        showUiMessage(`Falha ao minimizar app: ${e?.message || e}`, 'error');
        return;
      }

    
    } catch (e) {
      console.error('❌ Erro geral ao forçar bolha:', e);
      showUiMessage(`Erro ao forçar bolha: ${e?.message || e}`, 'error');
    }
  };

  const carregarSaldoDia = useCallback(async () => {
    if (!motoristaId) return;
    try {
      const saldo = await carregarGanhos(motoristaId, 'diario');
      setSaldoDia(saldo);
    } catch (e) {
      console.log('Erro ao carregar saldo do dia:', e);
      setSaldoDia(0);
    }
  }, [motoristaId]);

  useFocusEffect(
    useCallback(() => {
      carregarSaldoDia();
    }, [carregarSaldoDia])
  );

  useEffect(() => {
    const corridaPendente = route?.params?.corridaPendente;
    if (!corridaPendente) return;

    const corridaFromPayload = corridaPendente?.corrida || corridaPendente;
    const corridaId =
      corridaPendente?.id ||
      corridaPendente?.corrida_id ||
      corridaPendente?.corridaId ||
      corridaPendente?.ref ||
      corridaPendente?.ref_corrida;

    if (corridaFromPayload && typeof corridaFromPayload === 'object') {
      setCorridaAtual(corridaFromPayload);
    } else if (corridaId) {
      setCorridaAtual({ id: corridaId, ref: corridaId });
    }

    if (!modalCorrida && !temCorridaAtiva) {
      setTimeout(() => {
        abrirModalCorrida();
      }, 250);
    }

    if (navigation?.setParams) {
      navigation.setParams({ corridaPendente: null });
    }
  }, [route?.params?.corridaPendente, modalCorrida, temCorridaAtiva, navigation]);

  // Função para resetar corridas recusadas
  const resetDismissedRides = useCallback(() => {
    console.log('🔄 Resetando lista de corridas recusadas');
    dismissedRideIdRef.current = null;
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // WebSockets SEPARADOS
  // WebSocket para LOCALIZAÇÃO (8080)
  const { 
    connect: connectLocalizacao, 
    disconnect: disconnectLocalizacao, 
    send: sendLocalizacao, 
    getConnectionState: getLocalizacaoConnectionState,
    addMessageHandler: addLocalizacaoHandler, 
    removeMessageHandler: removeLocalizacaoHandler,
    wsRef: wsLocalizacaoRef
  } = useWebSocket(WS_LOCALIZACAO_URL);

  // WebSocket para CORRIDAS (8081)
  const { 
    connect: connectCorridas, 
    disconnect: disconnectCorridas, 
    send: sendCorridas, 
    getConnectionState: getCorridasConnectionState,
    addMessageHandler: addCorridasHandler, 
    removeMessageHandler: removeCorridasHandler,
    wsRef: wsCorridasRef
  } = useWebSocket(WS_CORRIDAS_URL);

  // Rastreador de localização (usa WebSocket de localização)
  const { location: currentLocation, heading } = useLocationTracker(
    motoristaId, 
    online, 
    sendLocalizacao
  );

  // Atualizar status dos WebSockets
  useEffect(() => {
    const interval = setInterval(() => {
      setWsLocalizacaoStatus(getLocalizacaoConnectionState());
      setWsCorridasStatus(getCorridasConnectionState());
    }, 5000);
    
    return () => clearInterval(interval);
  }, [getLocalizacaoConnectionState, getCorridasConnectionState]);

  // Monitorar estados (para debug)
  useEffect(() => {
    const info = `
📊 ESTADO ATUAL:
• Online: ${online}
• Modal Corrida: ${modalCorrida}
• Corrida Atual ID: ${corridaAtual?.id || 'Nenhuma'}
• Motorista ID: ${motoristaId}
• Tipo Veículo: ${tipoVeiculo}
• WS Localização: ${wsLocalizacaoStatus}
• WS Corridas: ${wsCorridasStatus}
• Corrida Ativa: ${temCorridaAtiva}
`;
    setDebugInfo(info);
    
    console.log('📊 Estado atual:', {
      online,
      modalCorrida,
      temCorridaAtiva,
      corridaAtualId: corridaAtual?.id,
      dismissedRideId: dismissedRideIdRef.current,
      wsLocalizacaoStatus,
      wsCorridasStatus
    });
  }, [online, modalCorrida, temCorridaAtiva, corridaAtual, wsLocalizacaoStatus, wsCorridasStatus, motoristaId, tipoVeiculo]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let mounted = true;
    let wasActive = AppState.currentState === 'active'; // Rastreia se o app já estava ativo

    const sub = AppState.addEventListener('change', async (state) => {
      if (!mounted) return;

      if (state === 'active') {
        wasActive = true; // Marca que o app já esteve ativo
        if (DriverForegroundService?.hideBubble) {
          try {
            await DriverForegroundService.hideBubble();
          } catch (e) {
            showUiMessage(`Falha ao esconder bolha (ACTIVE): ${e?.message || e}`, 'error');
          }
        }
        return;
      }

      // Só mostra a bolha se o app já esteve ativo antes (não no primeiro carregamento)
      if (!wasActive) {
        wasActive = true; // Marca para próxima vez
        return;
      }

      if (!online) return;

      const ok = await ensureOverlayPermission();
      if (!ok) return;

      if (DriverForegroundService?.showBubble) {
        try {
          await DriverForegroundService.showBubble();
        } catch (e) {
          showUiMessage(`Falha ao exibir bolha (BACKGROUND): ${e?.message || e}`, 'error');
        }
      }
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [online, ensureOverlayPermission, showUiMessage]);

  // Conectar WebSockets
  useEffect(() => {
    console.log('🔌 Iniciando conexões WebSocket...');
    connectLocalizacao();
    connectCorridas();
    
    return () => {
      console.log('🔌 Desconectando WebSockets...');
      disconnectLocalizacao();
      disconnectCorridas();
    };
  }, [connectLocalizacao, connectCorridas, disconnectLocalizacao, disconnectCorridas]);

  // Configurar handlers para WebSocket de LOCALIZAÇÃO (8080)
  useEffect(() => {
    // Handlers para localização
    addLocalizacaoHandler('welcome', (data) => {
      console.log('📍 Servidor de LOCALIZAÇÃO diz:', data.message);
      
      if (motoristaId) {
        setTimeout(() => {
          // Login no servidor de localização
          sendLocalizacao({
            type: 'motorista_login',
            motorista_id: motoristaId,
            timestamp: Date.now()
          });
        }, 1000);
      }
    });

    addCorridasHandler('status_updated', (data) => {
      try {
        console.log('🚗 Status atualizado (corridas):', data);

        const motoristaNum = Number(motoristaId);
        const corridaPayload = data?.corrida;
        const corridaId = data?.corrida_id || data?.corridaId || corridaPayload?.id || corridaPayload?.ref;
        const corridaMotoristaId = Number(corridaPayload?.motorista_id || data?.motorista_id);

        const motoristaOk = !Number.isFinite(motoristaNum) || !Number.isFinite(corridaMotoristaId)
          ? true
          : corridaMotoristaId === motoristaNum;

        const statusStr = String(data?.status || data?.novo_status || data?.estado || '').toLowerCase();
        const looksLikeConfirmation =
          statusStr.includes('confirm') ||
          statusStr.includes('aceit') ||
          statusStr.includes('em_andamento') ||
          statusStr.includes('atribu') ||
          statusStr.includes('assigned');

        if (motoristaId && motoristaOk && looksLikeConfirmation) {
          const corridaToUse =
            corridaPayload && typeof corridaPayload === 'object'
              ? corridaPayload
              : { id: corridaId, ref: corridaId, motorista_id: motoristaId };

          console.log('✅ Tratando status_updated como confirmação de corrida:', {
            corrida_id: corridaToUse?.id || corridaToUse?.ref,
            status: data?.status,
          });

          setTemCorridaAtiva(true);

          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }

          fecharModalCorrida();
          navigation.navigate('Corrida', {
            corrida: corridaToUse,
            motoristaId: motoristaId,
          });
          return;
        }

        if (motoristaId && motoristaOk && corridaPayload && !modalCorrida && !temCorridaAtiva) {
          if (dismissedRideIdRef.current !== corridaPayload?.id) {
            console.log('✅ Exibindo modal via status_updated:', corridaPayload?.id);
            setCorridaAtual(corridaPayload);
            setTimeout(() => {
              abrirModalCorrida();
            }, 100);
          }
        }
      } catch (e) {
        console.warn('⚠️ Erro no handler status_updated (corridas):', e);
      }
    });

    addLocalizacaoHandler('motorista_info', (data) => {
      console.log('📍 Informações do motorista recebidas (localização):', data.nome);
    });

    addLocalizacaoHandler('status_updated', (data) => {
      console.log('📍 Status atualizado (localização):', data.status);
    });

    addLocalizacaoHandler('error', (data) => {
      console.error('📍 Erro do servidor de localização:', data.message);
    });

    return () => {
      removeLocalizacaoHandler('welcome');
      removeLocalizacaoHandler('motorista_info');
      removeLocalizacaoHandler('status_updated');
      removeLocalizacaoHandler('error');
    };
  }, [motoristaId, addLocalizacaoHandler, removeLocalizacaoHandler, sendLocalizacao]);

  // Configurar handlers para WebSocket de CORRIDAS (8081)
  useEffect(() => {
    // Handlers para corridas
    addCorridasHandler('welcome', (data) => {
      console.log('🚗 Servidor de CORRIDAS diz:', data.message);
      
      if (motoristaId && online) {
        setTimeout(() => {
          // Login no servidor de corridas
          sendCorridas({
            type: 'motorista_login',
            motorista_id: motoristaId,
            timestamp: Date.now()
          });
          
          // Solicitar corridas por proximidade
          setTimeout(() => {
            sendCorridas({
              type: 'solicitar_corridas',
              motorista_id: motoristaId,
              timestamp: Date.now()
            });
          }, 500);
        }, 1000);
      }
    });

    addCorridasHandler('motorista_info', (data) => {
      console.log('🚗 Informações do motorista recebidas (corridas):', data.nome);
    });

    addCorridasHandler('response', (data) => {
      console.log('📨 Response do servidor (corridas):', data);

      try {
        const motoristaNum = Number(motoristaId);
        const corridaFromResponse = data?.corrida;
        const corrIdFromResponse = data?.corrida_id || data?.corridaId || data?.id || data?.ref || data?.ref_corrida;
        const isCorridaConfirmed =
          data?.success &&
          (corridaFromResponse || corrIdFromResponse) &&
          (!modalCorrida && !temCorridaAtiva);

        if (isCorridaConfirmed && motoristaId) {
          const corridaToUse =
            corridaFromResponse && typeof corridaFromResponse === 'object'
              ? corridaFromResponse
              : { id: corrIdFromResponse, ref: corrIdFromResponse, motorista_id: motoristaId };

          const corridaMotoristaId = Number(corridaToUse?.motorista_id);
          const motoristaOk = !Number.isFinite(motoristaNum) || !Number.isFinite(corridaMotoristaId)
            ? true
            : corridaMotoristaId === motoristaNum;

          if (motoristaOk) {
            console.log('✅ Confirmação de corrida recebida via response:', {
              corrida_id: corridaToUse?.id || corridaToUse?.ref,
              motorista_id: corridaToUse?.motorista_id,
            });
            setTemCorridaAtiva(true);

            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }

            fecharModalCorrida();
            navigation.navigate('Corrida', {
              corrida: corridaToUse,
              motoristaId: motoristaId,
            });
            return;
          }
        }
      } catch (e) {
        console.warn('⚠️ Falha ao interpretar response como confirmação de corrida:', e);
      }

      if (Array.isArray(data?.corridas) || data?.total_corridas !== undefined || data?.corridas_pendentes !== undefined) {
        const handler = (d) => {
          try {
            const corridas = Array.isArray(d?.corridas) ? d.corridas : [];
            const pendentes = corridas.filter((c) => c?.status === 'pendente');

            console.log('📋 Lista de corridas recebida (via response):', {
              total_corridas: d?.total_corridas,
              corridas_pendentes: d?.corridas_pendentes,
              total_array: corridas.length,
              pendentes: pendentes.length,
              tipoVeiculo
            });

            if (!online) {
              console.log('⛔ Ignorando corridas (via response) porque motorista está offline');
              return;
            }
            if (modalCorrida || temCorridaAtiva) {
              console.log('⛔ Ignorando corridas (via response) porque modal/corrida ativa:', {
                modalCorrida,
                temCorridaAtiva,
                corridaAtualId: corridaAtual?.id
              });
              return;
            }

            const tipoNum = Number(tipoVeiculo);
            const motoristaNum = Number(motoristaId);
            const corridaParaMostrar = pendentes.find((c) => {
              const corridaTipo = Number(c?.tipo_veiculo);
              const corridaMotoristaNum = Number(c?.motorista_id);
              const motoristaLivre = c?.motorista_id === null || c?.motorista_id === undefined || c?.motorista_id === '';
              const atribuidaAoMotorista =
                Number.isFinite(motoristaNum) &&
                Number.isFinite(corridaMotoristaNum) &&
                corridaMotoristaNum === motoristaNum;
              const motoristaElegivel = motoristaLivre || atribuidaAoMotorista;
              const tipoOk = !Number.isFinite(tipoNum) || tipoNum <= 0 ? true : corridaTipo === tipoNum;
              const naoRecusada = dismissedRideIdRef.current !== c?.id;
              return motoristaElegivel && tipoOk && naoRecusada;
            });

            if (!corridaParaMostrar) {
              console.log('ℹ️ Nenhuma corrida elegível (via response):', {
                pendentes_ids: pendentes.map((c) => c?.id),
                dismissedRideId: dismissedRideIdRef.current,
                tipoVeiculo,
              });
              return;
            }

            console.log('✅ Exibindo modal (via response):', corridaParaMostrar?.id);
            setCorridaAtual(corridaParaMostrar);
            setTimeout(() => {
              abrirModalCorrida();
            }, 100);
          } catch (e) {
            console.error('❌ Erro ao processar response de corridas:', e);
          }
        };

        handler(data);
      }
    });

    addCorridasHandler('corridas_list', (data) => {
      try {
        const corridas = Array.isArray(data?.corridas) ? data.corridas : [];
        const pendentes = corridas.filter((c) => c?.status === 'pendente');

        console.log('📋 Lista de corridas recebida:', {
          total_corridas: data?.total_corridas,
          total_array: corridas.length,
          pendentes: pendentes.length,
          tipoVeiculo
        });

        if (!online) {
          console.log('⛔ Ignorando corridas (lista) porque motorista está offline');
          return;
        }
        if (modalCorrida || temCorridaAtiva) {
          console.log('⛔ Ignorando corridas (lista) porque modal/corrida ativa:', {
            modalCorrida,
            temCorridaAtiva,
            corridaAtualId: corridaAtual?.id
          });
          return;
        }

        const tipoNum = Number(tipoVeiculo);
        const motoristaNum = Number(motoristaId);
        const corridaParaMostrar = pendentes.find((c) => {
          const corridaTipo = Number(c?.tipo_veiculo);
          const corridaMotoristaNum = Number(c?.motorista_id);
          const motoristaLivre = c?.motorista_id === null || c?.motorista_id === undefined || c?.motorista_id === '';
          const atribuidaAoMotorista =
            Number.isFinite(motoristaNum) &&
            Number.isFinite(corridaMotoristaNum) &&
            corridaMotoristaNum === motoristaNum;
          const motoristaElegivel = motoristaLivre || atribuidaAoMotorista;
          const tipoOk = !Number.isFinite(tipoNum) || tipoNum <= 0 ? true : corridaTipo === tipoNum;
          const naoRecusada = dismissedRideIdRef.current !== c?.id;
          return motoristaElegivel && tipoOk && naoRecusada;
        });

        if (!corridaParaMostrar) {
          console.log('ℹ️ Nenhuma corrida elegível (lista):', {
            pendentes_ids: pendentes.map((c) => c?.id),
            dismissedRideId: dismissedRideIdRef.current,
            tipoVeiculo,
          });
          return;
        }

        console.log('✅ Exibindo modal a partir da lista de corridas:', corridaParaMostrar?.id);
        setCorridaAtual(corridaParaMostrar);
        setTimeout(() => {
          abrirModalCorrida();
        }, 100);
      } catch (e) {
        console.error('❌ Erro ao processar lista de corridas:', e);
      }
    });

    addCorridasHandler('nova_corrida', async (data) => {
      console.log('🚗 NOVA CORRIDA RECEBIDA! Detalhes:', {
        id: data.corrida?.id,
        ref: data.corrida?.ref,
        valor: data.corrida?.valor,
        passageiro: data.corrida?.passageiro?.nome,
        tipo_veiculo: data.corrida?.tipo_veiculo,
        api_endpoint: data.api_endpoint
      });
      
      // DEBUG: Mostrar estrutura completa da corrida
      console.log('📋 Estrutura completa da corrida:', JSON.stringify(data.corrida, null, 2));
      
      // Guardas: só reagir a nova corrida se motorista estiver online e sem corrida ativa
      if (!online) {
        console.log('⛔ Ignorando nova corrida: motorista está offline');
        return;
      }
      if (temCorridaAtiva) {
        console.log('⛔ Ignorando nova corrida: motorista já está em corrida ativa');
        return;
      }

      // Tocar som da notificação
      playRideNotification();

      if (AppState.currentState !== 'active' && online && !temCorridaAtiva) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Nova corrida disponível',
              body: `${getPassengerName(data.corrida)} • ${formatDistanciaCorrida(data.corrida)} • ${formatValorCorrida(data.corrida)}`,
              data: {
                tipo: 'corrida',
                corrida_id: data.corrida?.id || data.corrida?.ref,
                motorista_id: motoristaId,
                corrida: data.corrida,
              },
              sound: 'default',
            },
            trigger: {
              channelId: 'corridas',
            },
          });
          console.log('🔔 Notificação local de corrida agendada');
        } catch (e) {
          console.error('❌ Erro ao agendar notificação local:', e);
        }
      }
      
      // VERIFICAÇÃO MAIS ROBUSTA
      const shouldShowModal = !modalCorrida && !temCorridaAtiva;
      
      console.log('🔍 Condições para exibir modal:', {
        modalCorrida,
        temCorridaAtiva,
        shouldShowModal,
        dismissedRideId: dismissedRideIdRef.current,
        novaCorridaId: data.corrida?.id
      });
      
      if (shouldShowModal && online) {
        // Verificar se esta corrida não foi recentemente recusada
        if (dismissedRideIdRef.current !== data.corrida?.id) {
          console.log('✅ Exibindo modal para corrida:', data.corrida?.id);
          
          // Adicionar informação da API à corrida
          const corridaComAPI = {
            ...data.corrida,
            api_acao_url: data.api_endpoint || API_ACAO_CORRIDA
          };
          
          // Atualizar estado da corrida
          setCorridaAtual(corridaComAPI);
          
          // Abre o modal com pequeno delay
          setTimeout(() => {
            abrirModalCorrida();
          }, 100);
        } else {
          console.log('⏭️ Corrida ignorada (foi recusada recentemente):', data.corrida?.id);
        }
      } else {
        console.log('❌ Modal não exibido. Razão:', {
          modalAberto: modalCorrida,
          corridaAtiva: temCorridaAtiva,
          corridaAtualId: corridaAtual?.id
        });
      }
    });

    addCorridasHandler('corrida_confirmada', (data) => {
      console.log('🚗 Corrida confirmada:', data);
      
      if (data.success) {
        setTemCorridaAtiva(true);
        
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        
        fecharModalCorrida();
        
        // Navega para tela de corrida
        navigation.navigate('Corrida', { 
          corrida: data.corrida || data.data,
          motoristaId: motoristaId 
        });
      }
    });

    addCorridasHandler('corrida_expirada', (data) => {
      console.log('⏰ Corrida expirada:', data.corrida_id);
     
    });

    addCorridasHandler('corrida_indisponivel', (data) => {
      console.log('🚫 Corrida indisponível:', data.corrida_id);
    });

    addCorridasHandler('corrida_recusada', (data) => {
      console.log('✅ Corrida recusada confirmada:', data.corrida_id);
    });

    addCorridasHandler('sem_corridas', (data) => {
      console.log('ℹ️ Nenhuma corrida disponível:', data.message);
    });

    addCorridasHandler('error', (data) => {
      console.warn('⚠️ Erro do servidor (corridas):', data);
    });

    return () => {
      removeCorridasHandler('welcome');
      removeCorridasHandler('motorista_info');
      removeCorridasHandler('response');
      removeCorridasHandler('corridas_list');
      removeCorridasHandler('nova_corrida');
      removeCorridasHandler('corrida_confirmada');
      removeCorridasHandler('status_updated');
      removeCorridasHandler('corrida_expirada');
      removeCorridasHandler('corrida_indisponivel');
      removeCorridasHandler('corrida_recusada');
      removeCorridasHandler('sem_corridas');
      removeCorridasHandler('error');
    };
  }, [motoristaId, online, tipoVeiculo, modalCorrida, temCorridaAtiva, corridaAtual?.id, navigation, addCorridasHandler, removeCorridasHandler, sendCorridas, abrirModalCorrida, fecharModalCorrida, setCorridaAtual, setTemCorridaAtiva]);

  // Setup inicial do som
  useEffect(() => {
    let mounted = true;
    const setupSound = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const sound = new Audio.Sound();
        await sound.loadAsync(require('../../assets/sounds/ubereates.mp3'));
        await sound.setIsLoopingAsync(false);
        if (mounted) rideSoundRef.current = sound;
        console.log('🔊 Som configurado com sucesso');
      } catch (e) {
        console.error('❌ Erro ao configurar som:', e);
      }
    };
    setupSound();
    return () => {
      mounted = false;
      try { 
        if (rideSoundRef.current) {
          rideSoundRef.current.unloadAsync();
        }
      } catch (e) {}
    };
  }, []);

  // Solicitar corridas automaticamente quando online e conectado
  useEffect(() => {
    const isCorridasConnected = wsCorridasStatus === 'connected';
    if (online && motoristaId && isCorridasConnected) {
      console.log('🔍 Motorista online e conectado, solicitando corridas...');
      
      const sendSolicit = () => {
        console.log('📤 Enviando solicitação de corridas...');
        sendCorridas({
          type: 'solicitar_corridas',
          motorista_id: motoristaId,
          timestamp: Date.now()
        });
      };
      
      // Envia imediatamente e agenda periodicidade
      sendSolicit();
      
      if (!rideSolicitIntervalRef.current) {
        rideSolicitIntervalRef.current = setInterval(() => {
          console.log('🔄 Solicitando corridas automaticamente...');
          sendSolicit();
        }, 15000); // A cada 15 segundos
      }
    } else {
      if (rideSolicitIntervalRef.current) {
        clearInterval(rideSolicitIntervalRef.current);
        rideSolicitIntervalRef.current = null;
      }
    }
    
    return () => {
      if (rideSolicitIntervalRef.current) {
        clearInterval(rideSolicitIntervalRef.current);
        rideSolicitIntervalRef.current = null;
      }
    };
  }, [online, motoristaId, wsCorridasStatus, sendCorridas]);

  // Atualizar localização no mapa
  useEffect(() => {
    if (currentLocation) {
      const newRegion = {
        ...currentLocation,
        latitudeDelta: 0.015,
        longitudeDelta: 0.0121,
      };
      
      setLocalizacaoMotorista(newRegion);
      
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }
    }
  }, [currentLocation]);

  // Atualizar heading
  useEffect(() => {
    setCurrentHeading(heading);
  }, [heading]);

  // Geocoding da cidade
  useEffect(() => {
    const doReverseGeocode = async () => {
      try {
        const lat = localizacaoMotorista?.latitude;
        const lon = localizacaoMotorista?.longitude;
        if (!lat || !lon) return;
        const key = `${lat.toFixed(3)}|${lon.toFixed(3)}`;
        if (lastGeocodeKeyRef.current === key) return;
        lastGeocodeKeyRef.current = key;
        const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (Array.isArray(results) && results[0]) {
          const a = results[0];
          const cityCandidate = a.city || a.subregion || a.district || a.name || a.region;
          if (cityCandidate && String(cityCandidate).trim().length > 0) {
            setCidadeAtual(String(cityCandidate));
          }
        }
      } catch (e) {
        console.error('❌ Erro no geocoding:', e);
      }
    };
    doReverseGeocode();
  }, [localizacaoMotorista?.latitude, localizacaoMotorista?.longitude]);

  // Animação da barra de progresso
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        })
      ])
    );
    loop.start();
    return () => {
      progressAnim.stopAnimation();
    };
  }, [progressAnim]);

  // Animação das mensagens de busca
  useEffect(() => {
    messageAnim.setValue(0);
    Animated.timing(messageAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic)
    }).start();
  }, [searchingIndex, messageAnim]);

  // Play som de notificação de corrida
  const playRideNotification = async () => {
    try {
      const now = Date.now();
      if (now - lastRideSoundAtRef.current < 2000) return;
      if (rideSoundRef.current) {
        await rideSoundRef.current.replayAsync();
        lastRideSoundAtRef.current = now;
        console.log('🔊 Som de notificação tocado');
      }
    } catch (e) {
      console.error('❌ Erro ao tocar som:', e);
    }
  };

  // Carregar dados do motorista
  useEffect(() => {
    const loadMotoristaData = async () => {
      try {
        console.log('👤 Carregando dados do motorista...');
        const { setUser } = useAuthStore.getState();
        
        // Primeiro tenta carregar do store (AsyncStorage)
        const userData = await loadUser();
        
        // Se veio via params, atualiza o store
        const userFromParams = route?.params?.user;
        const motoristaIdFromParams = route?.params?.motoristaId;
        
        if (userFromParams) {
          console.log('👤 Usuário recebido via params, atualizando store...');
          setUser(userFromParams);
        } else if (motoristaIdFromParams && !userData) {
          // Se só tem motoristaId nos params, cria objeto mínimo
          const minimalUser = {
            id: motoristaIdFromParams,
            motorista_id: motoristaIdFromParams,
            tipo_veiculo: route?.params?.tipo_veiculo || '1',
          };
          setUser(minimalUser);
        } else if (!userData) {
          // Se não tem nada, tenta carregar do AsyncStorage diretamente (fallback)
          const stored = await AsyncStorage.getItem('user_data');
          if (stored) {
            const parsed = JSON.parse(stored);
            setUser(parsed);
          }
        }

      } catch (e) {
        console.error('❌ Erro ao carregar dados do motorista:', e);
      }
    };
    
    loadMotoristaData();
  }, [route?.params, loadUser]);

  useEffect(() => {
    carregarSaldoDia();
  }, [carregarSaldoDia]);

  // Atualizar status online/offline nos DOIS servidores
  useEffect(() => {
    if (motoristaId) {
      console.log('🔄 Atualizando status do motorista:', { motoristaId, online });
      
      // Atualizar status no servidor de LOCALIZAÇÃO
      sendLocalizacao({
        type: 'atualizar_status',
        motorista_id: motoristaId,
        status: online ? 'online' : 'offline',
        timestamp: Date.now()
      });
      
      // Atualizar status no servidor de CORRIDAS
      sendCorridas({
        type: 'atualizar_status',
        motorista_id: motoristaId,
        status: online ? 'online' : 'offline',
        timestamp: Date.now()
      });
      
      if (online) {
        startBackgroundLocationTracking();
      } else {
        stopBackgroundLocationTracking();
      }
    }
  }, [online, motoristaId, sendLocalizacao, sendCorridas]);

  const ensureLocalizacaoLogin = useCallback(() => {
    const isConnected = wsLocalizacaoRef.current?.readyState === WebSocket.OPEN;
    if (!motoristaId || !isConnected) return;

    const now = Date.now();
    if (now - lastLocalizacaoLoginAtRef.current < 10000) return;
    lastLocalizacaoLoginAtRef.current = now;

    console.log('📍 Garantindo login no WS de localização...');
    sendLocalizacao({
      type: 'motorista_login',
      motorista_id: motoristaId,
      timestamp: now
    });
  }, [motoristaId, sendLocalizacao, wsLocalizacaoRef]);

  const ensureCorridasLoginAndSolicit = useCallback(() => {
    const isConnected = wsCorridasRef.current?.readyState === WebSocket.OPEN;
    if (!motoristaId || !online || !isConnected) return;

    const now = Date.now();
    if (now - lastCorridasLoginAtRef.current < 10000) return;
    lastCorridasLoginAtRef.current = now;

    console.log('🚗 Garantindo login/solicitação no WS de corridas...');
    sendCorridas({
      type: 'motorista_login',
      motorista_id: motoristaId,
      timestamp: now
    });
    sendCorridas({
      type: 'solicitar_corridas',
      motorista_id: motoristaId,
      timestamp: now
    });
  }, [motoristaId, online, sendCorridas, wsCorridasRef]);

  const ensureLocalizacaoStatusSync = useCallback(() => {
    const isConnected = wsLocalizacaoRef.current?.readyState === WebSocket.OPEN;
    if (!motoristaId || !isConnected) return;

    const now = Date.now();
    if (now - lastLocalizacaoStatusAtRef.current < 10000) return;
    lastLocalizacaoStatusAtRef.current = now;

    console.log('📍 Garantindo sync de status no WS de localização...', { online });
    sendLocalizacao({
      type: 'atualizar_status',
      motorista_id: motoristaId,
      status: online ? 'online' : 'offline',
      timestamp: now
    });
  }, [motoristaId, online, sendLocalizacao, wsLocalizacaoRef]);

  const ensureCorridasStatusSync = useCallback(() => {
    const isConnected = wsCorridasRef.current?.readyState === WebSocket.OPEN;
    if (!motoristaId || !isConnected) return;

    const now = Date.now();
    if (now - lastCorridasStatusAtRef.current < 10000) return;
    lastCorridasStatusAtRef.current = now;

    console.log('🚗 Garantindo sync de status no WS de corridas...', { online });
    sendCorridas({
      type: 'atualizar_status',
      motorista_id: motoristaId,
      status: online ? 'online' : 'offline',
      timestamp: now
    });
  }, [motoristaId, online, sendCorridas, wsCorridasRef]);

  useEffect(() => {
    ensureLocalizacaoLogin();
  }, [motoristaId, wsLocalizacaoStatus, ensureLocalizacaoLogin]);

  useEffect(() => {
    ensureCorridasLoginAndSolicit();
  }, [online, motoristaId, wsCorridasStatus, ensureCorridasLoginAndSolicit]);

  useEffect(() => {
    ensureLocalizacaoStatusSync();
  }, [online, motoristaId, wsLocalizacaoStatus, ensureLocalizacaoStatusSync]);

  useEffect(() => {
    ensureCorridasStatusSync();
  }, [online, motoristaId, wsCorridasStatus, ensureCorridasStatusSync]);

  useEffect(() => {
    const interval = setInterval(() => {
      ensureLocalizacaoLogin();
      ensureCorridasLoginAndSolicit();
      ensureLocalizacaoStatusSync();
      ensureCorridasStatusSync();
    }, 2000);

    return () => clearInterval(interval);
  }, [
    ensureLocalizacaoLogin,
    ensureCorridasLoginAndSolicit,
    ensureLocalizacaoStatusSync,
    ensureCorridasStatusSync
  ]);

  // Inicializar localização
  useEffect(() => {
    const inicializarLocalizacao = async () => {
      try {
        setBuscandoLocalizacao(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão necessária', 'É necessário permitir o acesso à localização.');
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000
        });
        const newRegion = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.0121,
        };
        setLocalizacaoMotorista(newRegion);
        if (mapRef.current) {
          mapRef.current.animateToRegion(newRegion, 1000);
        }
        console.log('📍 Localização inicial obtida:', newRegion);
      } catch (error) {
        console.error('❌ Erro ao inicializar localização:', error);
        Alert.alert('Erro', 'Não foi possível obter sua localização.');
      } finally {
        setBuscandoLocalizacao(false);
      }
    };
    inicializarLocalizacao();
  }, []);

  // Verificar corrida ativa
  useEffect(() => {
    const verificarCorridaAtiva = async () => {
      if (!motoristaId) return;
      
      try {
        console.log('🔍 Verificando se há corrida ativa...');
        const response = await fetch('https://beepapps.cloud/appmotorista/api_verificar_corrida_ativa.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motorista_id: motoristaId }),
        });

        const data = await response.json();
        console.log('📊 Resposta verificação corrida ativa:', data);
        
        if (data.success && data.corrida_ativa && data.corrida) {
          setTemCorridaAtiva(true);
          setOnline(true);

          if (DriverForegroundService?.startService) {
            try {
              await DriverForegroundService.startService(WS_CORRIDAS_URL);
            } catch (e) {
              console.log('Falha ao iniciar DriverForegroundService (ONLINE):', e);
            }
          }

          if (DriverForegroundService?.hasOverlayPermission && DriverForegroundService?.requestOverlayPermission) {
            try {
              const hasPermission = await DriverForegroundService.hasOverlayPermission();
              if (!hasPermission) {
                Alert.alert(
                  'Permissão necessária',
                  'Para exibir a bolha flutuante quando o app estiver minimizado (como Uber/99), permita "Exibir sobre outros apps".',
                  [
                    { text: 'Agora não', style: 'cancel' },
                    {
                      text: 'Continuar',
                      onPress: () => {
                        DriverForegroundService.requestOverlayPermission().catch((err) => {
                          console.log('Falha ao solicitar permissão de sobreposição:', err);
                        });
                      },
                    },
                  ]
                );
              }
            } catch (e) {
              console.log('Erro ao checar permissão de overlay:', e);
            }
          }
          
          Alert.alert(
            'Corrida em Andamento',
            'Você tem uma corrida ativa. Será direcionado para a tela da corrida.',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.navigate('Corrida', { 
                    corrida: data.corrida,
                    motoristaId: motoristaId 
                  });
                }
              }
            ]
          );
        }
      } catch (error) {
        console.error('❌ Erro ao verificar corrida ativa:', error);
      }
    };

    verificarCorridaAtiva();
  }, [motoristaId, navigation]);

  // Ciclo de mensagens de busca
  useEffect(() => {
    let interval = null;
    if (online) {
      interval = setInterval(() => {
        setSearchingIndex((prev) => (prev + 1) % SEARCHING_MESSAGES.length);
      }, 3000);
    } else {
      setSearchingIndex(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [online]);

  // Função para aceitar corrida (unificada)
  const handleAceitarCorrida = async () => {
    console.log('🎯 Iniciando aceite de corrida...');
    
    if (!corridaAtual) {
      Alert.alert('Erro', 'Nenhuma corrida selecionada');
      return;
    }
    
    if (!motoristaId) {
      Alert.alert('Erro', 'Motorista não identificado. Por favor, faça login novamente.');
      return;
    }
    
    console.log('✅ Aceitando corrida:', {
      corrida_id: corridaAtual.id || corridaAtual.ref,
      motorista_id: motoristaId
    });
    
    await aceitarCorridaAPI();
  };

  // Função para recusar corrida (unificada)
  const handleRecusarCorrida = async () => {
    console.log('🎯 Iniciando recusa de corrida...');
    
    if (!corridaAtual) {
      Alert.alert('Atenção', 'Nenhuma corrida para recusar');
      return;
    }
    
    console.log('❌ Recusando corrida:', {
      corrida_id: corridaAtual.id || corridaAtual.ref,
      motorista_id: motoristaId
    });
    
    await recusarCorridaAPI();
  };

  // Função para aceitar corrida via API
  const aceitarCorridaAPI = async () => {
    console.log('🚀 aceitarCorridaAPI chamada');
    
    // Verificar se temos corridaAtual e motoristaId no estado
    if (!corridaAtual) {
      Alert.alert('Erro', 'Nenhuma corrida selecionada');
      return;
    }
    
    // Usar motoristaId do store
    if (!motoristaId) {
      Alert.alert('Erro', 'Motorista não identificado. Por favor, faça login novamente.');
      return;
    }
    
    const corridaId = corridaAtual.id || corridaAtual.ref;
    
    console.log('✅ Dados para aceitar corrida:', {
      corrida_id: corridaId,
      motorista_id: motoristaId,
      api_url: API_ACAO_CORRIDA
    });
    
    try {
      // Primeiro, enviar para WebSocket de corridas
      const wsSent = sendCorridas({
        type: 'aceitar_corrida',
        corrida_id: corridaId,
        motorista_id: motoristaId,
        timestamp: Date.now()
      });
      
      console.log('📤 Enviado para WebSocket:', wsSent);
      
      // Também chamar a API diretamente para garantir
      const data = await aceitarCorrida(corridaId, motoristaId);
      console.log('📝 Resposta da API ao aceitar corrida:', data);
      
      if (data.success) {
        console.log('🎉 Corrida aceita com sucesso!');
        setTemCorridaAtiva(true);
        
        // Parar timer do modal
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        
        // Fechar modal
        fecharModalCorrida();
        
        // Navegar para tela de corrida
        navigation.navigate('Corrida', { 
          corrida: corridaAtual
        });
      } else {
        Alert.alert('Erro', data.message || 'Não foi possível aceitar a corrida');
        // Se falhar, fechar modal e resetar
        fecharModalCorrida();
        setTimeout(() => {
          if (online && motoristaId) {
            sendCorridas({
              type: 'solicitar_corridas',
              motorista_id: motoristaId,
              timestamp: Date.now()
            });
          }
        }, 1000);
      }
      
    } catch (error) {
      console.error('❌ Erro ao aceitar corrida via API:', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor');
      fecharModalCorrida();
    }
  };

  // Função para recusar corrida via API
  const recusarCorridaAPI = async () => {
    console.log('🚀 recusarCorridaAPI chamada');
    
    if (!corridaAtual) {
      console.log('⚠️ Nenhuma corrida para recusar');
      return;
    }
    
    // Usar motoristaId do store
    if (!motoristaId) {
      console.log('⚠️ Motorista não identificado');
      return;
    }
    
    const corridaId = corridaAtual.id || corridaAtual.ref;
    
    console.log('❌ Dados para recusar corrida:', {
      corrida_id: corridaId,
      motorista_id: motoristaId,
      api_url: API_ACAO_CORRIDA
    });
    
    try {
      // Primeiro, enviar para WebSocket
      const wsSent = sendCorridas({
        type: 'recusar_corrida',
        corrida_id: corridaId,
        motorista_id: motoristaId,
        timestamp: Date.now()
      });
      
      console.log('📤 Enviado para WebSocket:', wsSent);
      
      // Também chamar a API diretamente para garantir
      const data = await recusarCorrida(corridaId, motoristaId);
      console.log('📝 Resposta da API ao recusar corrida:', data);
      
      // Marcar como recusada
      dismissedRideIdRef.current = corridaId;
      
      // Parar som
      try { 
        await rideSoundRef.current?.stopAsync(); 
      } catch (e) {}
      
      // Limpar timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      // Fechar modal
      fecharModalCorrida();
      
      // Solicitar novas corridas após recusar
      setTimeout(() => {
        if (online && motoristaId) {
          sendCorridas({
            type: 'solicitar_corridas',
            motorista_id: motoristaId,
            timestamp: Date.now()
          });
        }
      }, 500);
      
      // Remover da lista de recusadas após 2 minutos (para poder receber novamente)
      setTimeout(() => {
        if (dismissedRideIdRef.current === corridaId) {
          console.log('🔄 Limpando corrida recusada após timeout:', corridaId);
          dismissedRideIdRef.current = null;
        }
      }, 120000); // 2 minutos
      
    } catch (error) {
      console.error('❌ Erro ao recusar corrida via API:', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor');
      fecharModalCorrida();
    }
  };

  // Função principal para ficar online/offline
  const toggleOnline = async () => {
    if (loadingOnline || !motoristaId) {
      console.log('⚠️ Não pode alternar status:', { loadingOnline, motoristaId });
      return;
    }

    try {
      setLoadingOnline(true);

      if (!online) {
        // Verificar corrida ativa primeiro
        try {
          const response = await fetch('https://beepapps.cloud/appmotorista/api_verificar_corrida_ativa.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motorista_id: motoristaId }),
          });

          const data = await response.json();
          
          if (data.success && data.corrida_ativa && data.corrida) {
            setTemCorridaAtiva(true);
            setOnline(true);

            if (DriverForegroundService?.startService) {
              try {
                await DriverForegroundService.startService(WS_CORRIDAS_URL);
              } catch (e) {
                console.log('Falha ao iniciar DriverForegroundService (ONLINE):', e);
              }
            }

            if (DriverForegroundService?.hideBubble) {
              try {
                await DriverForegroundService.hideBubble();
              } catch (e) {
                console.log('Falha ao esconder bolha (ONLINE):', e);
              }
            }

            await ensureOverlayPermission();
            
            Alert.alert(
              'Corrida em Andamento',
              'Você tem uma corrida ativa. Será direcionado para a tela da corrida.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    navigation.navigate('Corrida', { 
                      corrida: data.corrida,
                      motoristaId: motoristaId 
                    });
                  }
                }
              ]
            );
            return;
          }
        } catch (error) {
          console.error('❌ Erro ao verificar corrida ativa:', error);
        }

        // Ficar online
        try {
          const current = await Location.getCurrentPositionAsync({ 
            accuracy: Location.Accuracy.Balanced,
            timeout: 10000
          });
          
          const { latitude, longitude } = current.coords;
          
          setOnline(true);

          if (DriverForegroundService?.startService) {
            try {
              await DriverForegroundService.startService(WS_CORRIDAS_URL);
            } catch (e) {
              console.log('Falha ao iniciar DriverForegroundService (ONLINE):', e);
            }
          }

          if (DriverForegroundService?.hideBubble) {
            try {
              await DriverForegroundService.hideBubble();
            } catch (e) {
              console.log('Falha ao esconder bolha (ONLINE):', e);
            }
          }

          await ensureOverlayPermission();
          
          // RESETAR corridas recusadas quando ficar online
          resetDismissedRides();
          
          // Login nos DOIS servidores
          setTimeout(() => {
            sendLocalizacao({
              type: 'motorista_login',
              motorista_id: motoristaId,
              timestamp: Date.now()
            });
            
            sendCorridas({
              type: 'motorista_login',
              motorista_id: motoristaId,
              timestamp: Date.now()
            });
            
            // Solicitar corridas por proximidade
            setTimeout(() => {
              sendCorridas({
                type: 'solicitar_corridas',
                motorista_id: motoristaId,
                timestamp: Date.now()
              });
            }, 2000);
          }, 1000);
          
          Alert.alert('Sucesso', 'Você está online e recebendo corridas por proximidade!');
          
        } catch (error) {
          console.error('❌ Erro ao ficar online:', error);
          Alert.alert('Erro', 'Não foi possível obter a localização.');
        }
      } else {
        // Ficar offline
        setOnline(false);
        setTemCorridaAtiva(false);

        if (DriverForegroundService?.stopService) {
          try {
            await DriverForegroundService.stopService();
          } catch (e) {
            console.log('Falha ao parar DriverForegroundService (OFFLINE):', e);
          }
        }
        
        // Logout nos DOIS servidores
        sendLocalizacao({
          type: 'atualizar_status',
          motorista_id: motoristaId,
          status: 'offline',
          timestamp: Date.now()
        });
        
        sendCorridas({
          type: 'atualizar_status',
          motorista_id: motoristaId,
          status: 'offline',
          timestamp: Date.now()
        });
        
        Alert.alert('Sucesso', 'Você está offline');
      }
    } finally {
      setLoadingOnline(false);
    }
  };

  // Recentralizar no mapa
  const handleRecenter = async () => {
    try {
      setBuscandoLocalizacao(true);
      
      const current = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000
      });
      
      const latitude = current.coords.latitude;
      const longitude = current.coords.longitude;
      
      const newRegion = {
        latitude: latitude,
        longitude: longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.0121,
      };
      
      setLocalizacaoMotorista(newRegion);
      
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }
      
      // Atualizar no servidor de LOCALIZAÇÃO
      if (online && motoristaId) {
        sendLocalizacao({
          type: 'atualizar_localizacao',
          motorista_id: motoristaId,
          latitude: latitude,
          longitude: longitude,
          rotacao: currentHeading,
          timestamp: Date.now()
        });
      }
      
      Alert.alert('Sucesso', 'Localização recentrada!');
      
    } catch (e) {
      console.error('❌ Erro ao recentrar:', e);
      Alert.alert('Erro', 'Não foi possível recentrar sua localização.');
    } finally {
      setBuscandoLocalizacao(false);
    }
  };

  // Abrir modal de corrida
  const abrirModalCorrida = useCallback(async () => {
    if (modalCorrida) {
      console.log('⚠️ Modal já está aberto');
      return;
    }
    
    console.log('📱 Abrindo modal de corrida para corrida:', corridaAtual?.id);
    setModalCorrida(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (!timerIntervalRef.current) {
      setTimerSeconds(30);
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            try {
              if (corridaAtual && motoristaId) {
                console.log('⏰ Tempo esgotado. Liberando corrida no servidor:', corridaAtual.id || corridaAtual.ref);
                recusarCorridaAPI();
              }
            } catch (e) {
              console.warn('Falha ao liberar corrida no timeout:', e);
            }
            fecharModalCorrida();
            setTimeout(() => {
              if (online && motoristaId) {
                sendCorridas({
                  type: 'solicitar_corridas',
                  motorista_id: motoristaId,
                  timestamp: Date.now()
                });
              }
            }, 500);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [modalCorrida, corridaAtual, motoristaId, online, sendCorridas, fecharModalCorrida, recusarCorridaAPI, slideAnim]);

  // Fechar modal de corrida
  const fecharModalCorrida = useCallback(() => {
    console.log('🔒 Fechando modal de corrida');
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    try { 
      rideSoundRef.current?.stopAsync(); 
    } catch (e) {
      console.warn('Erro ao parar som:', e);
    }

    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setModalCorrida(false);
      
      // Limpa corrida atual após fechar o modal
      setTimeout(() => {
        setCorridaAtual(null);
      }, 500);
    });
  }, [setCorridaAtual, slideAnim]);


  // Cleanup
  useEffect(() => {
    return () => {
      stopBackgroundLocationTracking();

      if (snackbarTimeoutRef.current) {
        clearTimeout(snackbarTimeoutRef.current);
        snackbarTimeoutRef.current = null;
      }
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      
      if (rideSolicitIntervalRef.current) {
        clearInterval(rideSolicitIntervalRef.current);
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#f8fafc" 
      />

      {/* Snackbar */}
      {snackbarState.visible && (
        <View pointerEvents="none" style={styles.snackbarContainer}>
          <View
            style={[
              styles.snackbar,
              snackbarState.kind === 'error' && styles.snackbarError,
              snackbarState.kind === 'success' && styles.snackbarSuccess,
            ]}
          >
            <Text style={styles.snackbarText}>{snackbarState.message}</Text>
          </View>
        </View>
      )}
      
      {/* Mapa */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={localizacaoMotorista}
        showsUserLocation={false}
        showsMyLocationButton={false}
        customMapStyle={uberMapStyle}
      >
        
        {/* Marcador do motorista */}
        {localizacaoMotorista && (
          <Marker
            coordinate={{
              latitude: localizacaoMotorista.latitude,
              longitude: localizacaoMotorista.longitude
            }}
            rotation={currentHeading || 0}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
          >
            <View style={styles.markerMotorista}>
              <Icon name="navigation" size={25} color="#007AFF" />
            </View>
          </Marker>
        )}

        {/* Áreas Dinâmicas */}
        {online && (
          <AreasDinamicasMapa 
            localizacaoMotorista={localizacaoMotorista}
            motoristaId={motoristaId}
            online={online}
            wsManager={{
              addMessageHandler: addCorridasHandler,
              removeMessageHandler: removeCorridasHandler,
              send: sendCorridas,
              isConnected: () => wsCorridasStatus === 'connected',
            }}
          />
        )}
      </MapView>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => navigation.navigate('Perfil')}
          >
            <View style={styles.profileIcon}>
              <Icon name="person" size={20} color="#000" />
            </View>
          </TouchableOpacity>
          
          <View style={styles.locationContainer}>
            <View style={styles.locationPin}>
              <Icon name="navigation" size={16} color="#000" />
            </View>
            <Text style={styles.locationText} numberOfLines={1}>
              {buscandoLocalizacao ? 'Buscando localização...' : (cidadeAtual || 'Localização')}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.balanceButton}
          onPress={() => setGanhosScreenModalVisivel(true)}
        >
          <LinearGradient
            colors={['#000000', '#333333']}
            style={styles.balanceGradient}
          >
            <Text style={styles.balanceText}>
              {saldoOculto ? '••••' : `R$ ${saldoDia.toFixed(2).replace('.', ',')}`}
            </Text>
            <TouchableOpacity 
              onPress={() => setSaldoOculto(prev => !prev)}
              style={styles.eyeButton}
            >
              <Icon 
                name={saldoOculto ? 'visibility-off' : 'visibility'} 
                size={16} 
                color="#FFF" 
              />
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Botão de recentralizar */}
      <TouchableOpacity 
        style={styles.recenterButton}
        onPress={handleRecenter}
      >
        <LinearGradient
          colors={['#007AFF', '#0056CC']}
          style={styles.recenterGradient}
        >
          <Icon name="my-location" size={20} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Ações rápidas */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Historico')}
        >
          <Icon name="history" size={22} color="#1E293B" />
          <Text style={styles.quickActionText}>Histórico</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => setCarteiraModalVisivel(true)}
        >
          <Icon name="account-balance-wallet" size={22} color="#1E293B" />
          <Text style={styles.quickActionText}>Carteira</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Suporte')}
        >
          <Icon name="support-agent" size={22} color="#1E293B" />
          <Text style={styles.quickActionText}>Suporte</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Perfil')}
        >
          <Icon name="settings" size={22} color="#1E293B" />
          <Text style={styles.quickActionText}>Ajustes</Text>
        </TouchableOpacity>
      </View>

      {/* Container Inferior */}
      <View style={styles.bottomContainer}>
        {/* Botão Principal */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[
              styles.mainButton,
              online ? styles.mainButtonOnline : styles.mainButtonOffline,
              loadingOnline && styles.mainButtonDisabled
            ]}
            onPress={toggleOnline}
            disabled={loadingOnline}
          >
            <LinearGradient
              colors={online ? ['#00B060', '#00CC6A'] : ['#000000', '#333333']}
              style={styles.buttonGradient}
            >
              {loadingOnline ? (
                <Text style={styles.mainButtonText}>CARREGANDO...</Text>
              ) : (
                <Text style={styles.mainButtonText}>
                  {online ? 'ONLINE' : 'FICAR ONLINE'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'android' && (
          <View style={styles.bubbleButtonsContainer}>
            <TouchableOpacity
              style={[styles.forceBubbleButton, styles.forceBubbleButtonHalf]}
              onPress={forceShowBubbleAndMinimize}
            >
              <Text style={styles.forceBubbleButtonText}>FORÇAR BOLHA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.forceBubbleButton, styles.forceBubbleButtonHalf, styles.hideBubbleButton]}
              onPress={hideBubbleManually}
            >
              <Text style={styles.forceBubbleButtonText}>ESCONDER BOLHA</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status de busca */}
        {online && (
          <View style={styles.searchingContainer}>
            <View 
              style={styles.progressBarContainer}
              onLayout={(e) => setProgressContainerWidth(e.nativeEvent.layout.width)}
            >
              <Animated.View 
                style={[
                  styles.progressBar,
                  {
                    width: Math.max(60, progressContainerWidth * 0.3),
                    transform: [{ 
                      translateX: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-Math.max(60, progressContainerWidth * 0.3), progressContainerWidth]
                      })
                    }]
                  }
                ]}
              />
            </View>
            <Animated.Text 
              style={[
                styles.searchingText,
                {
                  opacity: messageAnim,
                  transform: [{ 
                    translateY: messageAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] })
                  }]
                }
              ]}
            >
              {SEARCHING_MESSAGES[searchingIndex]}
            </Animated.Text>
          </View>
        )}
      </View>

      {/* Modal de Corrida */}
      <Modal
        visible={modalCorrida}
        transparent={true}
        animationType="none"
        onRequestClose={fecharModalCorrida}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContent,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.rideHeader}>
              <View style={styles.passengerInfo}>
                <View style={styles.passengerAvatar}>
                  <Text style={styles.passengerAvatarText}>
                    {getPassengerName(corridaAtual).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.passengerTexts}>
                  <Text style={styles.passengerName}>
                    {getPassengerName(corridaAtual)}
                  </Text>
                  <View style={styles.passengerMetaRow}>
                    <Icon name="star" size={14} color="#F59E0B" />
                    <Text style={styles.passengerMetaText}>
                      {getPassengerRating(corridaAtual)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.modalTimerPill}>
                <Icon name="schedule" size={16} color="#fff" />
                <Text style={styles.modalTimerText}>{`${timerSeconds}s`}</Text>
              </View>
            </View>
            
            <View style={styles.timerBarContainer}>
              <View style={[styles.timerBar, { width: `${(timerSeconds / 30) * 100}%` }]} />
            </View>

            <View style={styles.rideInfoCard}>
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Icon name="payments" size={18} color="#111827" />
                  <Text style={styles.metricLabel}>Valor</Text>
                  <Text style={styles.metricValue}>{formatValorCorrida(corridaAtual)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Icon name="route" size={18} color="#111827" />
                  <Text style={styles.metricLabel}>Distância</Text>
                  <Text style={styles.metricValue}>{formatDistanciaCorrida(corridaAtual)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Icon name="schedule" size={18} color="#111827" />
                  <Text style={styles.metricLabel}>Tempo</Text>
                  <Text style={styles.metricValue}>{formatTempoCorrida(corridaAtual)}</Text>
                </View>
              </View>
              <View style={styles.routeRow}>
                <View style={styles.routeMarkers}>
                  <View style={styles.routeDotOrigin} />
                  <View style={styles.routeLine} />
                  <View style={styles.routeDotDest} />
                </View>
                <View style={styles.routeTexts}>
                  <Text style={styles.routeLabel}>Origem</Text>
                  <Text style={styles.routeValue} numberOfLines={1}>
                    {corridaAtual?.origem?.endereco || corridaAtual?.origem_endereco || 'Endereço de origem'}
                  </Text>
                  <Text style={[styles.routeLabel, { marginTop: 10 }]}>Destino</Text>
                  <Text style={styles.routeValue} numberOfLines={1}>
                    {corridaAtual?.destino?.endereco || corridaAtual?.destino_endereco || 'Endereço de destino'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.bottomActionBar}>
              <TouchableOpacity
                style={styles.sideAction}
                onPress={handleRecusarCorrida}
                activeOpacity={0.7}
              >
                <Icon name="close" size={30} color="#DC2626" />
                <Text style={styles.sideActionText}>Recusar</Text>
              </TouchableOpacity>

              <View style={styles.centerActionWrapper}>
                <Animated.View
                  {...panResponder.panHandlers}
                  style={{
                    transform: [
                      { translateX: dragX },
                      { scale: pulseAnim }
                    ],
                    backgroundColor: dragX.interpolate({
                      inputRange: [-120, 0, 120],
                      outputRange: ['#FEE2E2', '#FFFFFF', '#DCFCE7']
                    }),
                    borderColor: dragX.interpolate({
                      inputRange: [-120, 0, 120],
                      outputRange: ['#DC2626', '#111', '#16A34A']
                    }),
                    borderWidth: 3,
                    width: 90,
                    height: 90,
                    borderRadius: 45,
                    alignItems: 'center',
                    justifyContent: 'center',
                    elevation: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                  }}
                >
                  <Icon name="directions-car" size={34} color="#111" />
                  <Text style={styles.centerTimer}>{timerSeconds}s</Text>
                </Animated.View>
              </View>

              <TouchableOpacity
                style={styles.sideAction}
                onPress={handleAceitarCorrida}
                activeOpacity={0.7}
              >
                <Icon name="check" size={30} color="#16A34A" />
                <Text style={styles.sideActionText}>Aceitar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal de Carteira */}
      <Modal
        visible={carteiraModalVisivel}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCarteiraModalVisivel(false)}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <TouchableOpacity 
              onPress={() => setCarteiraModalVisivel(false)} 
              style={styles.fullModalCloseButton}
            >
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
            <CarteiraScreen route={{ params: { motoristaId } }} />
          </View>
        </View>
      </Modal>

      {/* Modal de Ganhos */}
      <Modal
        visible={ganhosScreenModalVisivel}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setGanhosScreenModalVisivel(false)}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <TouchableOpacity 
              onPress={() => setGanhosScreenModalVisivel(false)} 
              style={styles.fullModalCloseButton}
            >
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
            <GanhosScreen route={{ params: { motoristaId } }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  snackbarContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 150,
    alignItems: 'center',
    zIndex: 999,
  },
  snackbar: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
    opacity: 0.96,
  },
  snackbarError: {
    backgroundColor: '#B91C1C',
  },
  snackbarSuccess: {
    backgroundColor: '#047857',
  },
  snackbarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 30,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationPin: {
    marginRight: 8,
    backgroundColor: '#f0f0f0',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  balanceButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    marginLeft: 10,
  },
  balanceGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2c3e50',
  },
  balanceText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  eyeButton: {
    padding: 4,
  },
  recenterButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    right: 16,
    zIndex: 10,
  },
  recenterGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  quickActions: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 180 : 160,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  quickActionButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  quickActionText: {
    fontSize: 11,
    color: '#4B5563',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 35,
  },
  bubbleButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 10,
    paddingHorizontal: 20,
  },
  forceBubbleButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  forceBubbleButtonHalf: {
    flex: 1,
    maxWidth: '48%',
  },
  hideBubbleButton: {
    backgroundColor: '#FF3B30',
  },
  forceBubbleButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  websocketStatusContainer: {
    width: '100%',
    marginBottom: 12,
  },
  websocketStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  websocketDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  websocketConnected: {
    backgroundColor: '#10B981',
  },
  websocketConnecting: {
    backgroundColor: '#F59E0B',
  },
  websocketDisconnected: {
    backgroundColor: '#EF4444',
  },
  websocketText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  debugContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 12,
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B7280',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  debugButtonText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainButton: {
    width: 200,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mainButtonOnline: {
    backgroundColor: '#00B060',
  },
  mainButtonOffline: {
    backgroundColor: '#2c3e50',
  },
  mainButtonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  mainButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  searchingContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    width: '30%',
    backgroundColor: '#00B060',
    borderRadius: 2,
  },
  searchingText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  passengerAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  passengerTexts: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  passengerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  passengerMetaText: {
    marginLeft: 4,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  modalTimerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalTimerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  timerBarContainer: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 24,
  },
  timerBar: {
    height: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 2,
  },
  rideInfoCard: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  routeRow: {
    flexDirection: 'row',
  },
  routeMarkers: {
    alignItems: 'center',
    marginRight: 12,
  },
  routeDotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginVertical: 6,
  },
  routeDotDest: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  routeTexts: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  actionsContainer: {
    
  },
  bottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingTop: 20,
    paddingBottom: 30,
    backgroundColor: '#fff',
  },
  sideAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideActionText: {
    marginTop: 4,
    fontSize: 12,
    color: '#374151',
  },
  centerActionWrapper: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -45 }],
  },
  centerActionDragging: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  centerTimer: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  declineButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  declineText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  acceptButton: {
    marginTop: 12,
  },
  acceptGradient: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  acceptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  markerMotorista: {
    backgroundColor: '#FFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fullModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  fullModalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: Platform.OS === 'ios' ? 50 : 30,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  fullModalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 100,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
  },
  debugInfoButton: {
    position: 'absolute',
    bottom: 200,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
});
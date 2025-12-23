import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Notifications from "expo-notifications";
import * as TaskManager from 'expo-task-manager';
import { useEffect, useRef, useState } from "react";
import { AppState, Modal, NativeModules, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";

// Endpoints de chat e corridas
const API_BASE_URL = 'https://beepapps.cloud/apppassageiro';
const API_MOTORISTA_URL = 'https://beepapps.cloud/appmotorista';
const CHECK_ACTIVE_RIDES_URL = `${API_BASE_URL}/check_active_rides.php`;
const BUSCAR_MSG_URL = `${API_BASE_URL}/buscar_msg.php`;

// Endpoint para salvar token Expo
const SAVE_EXPO_TOKEN_URL = `${API_MOTORISTA_URL}/save_expo_token.php`;

// Defina o nome da tarefa em background
const LOCATION_TRACKING_TASK = 'background-location-tracking';

// Defina a tarefa de background para tracking de localização
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Erro na tarefa de background:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    const location = locations[0];
    
    if (location) {
      const { latitude, longitude } = location.coords;
      
      // Obter dados do motorista do AsyncStorage
      try {
        const storedUser = await AsyncStorage.getItem('user_data');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          const motoristaId = user?.id || user?.motorista_id;
          
          if (motoristaId) {
            // Atualizar localização na API mesmo em background
            await fetch('https://beepapps.cloud/appmotorista/atualizarLocalizacao.php', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                motorista_id: motoristaId,
                latitude: latitude,
                longitude: longitude
              }),
            });
            
            console.log('📍 Localização atualizada em background:', { latitude, longitude });
          }
        }
      } catch (err) {
        console.error('Erro ao atualizar localização em background:', err);
      }
    }
  }
});

// Configuração global de comportamento da notificação
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Função para salvar o token Expo no servidor
const saveExpoTokenToServer = async (token, motoristaId) => {
  if (!token || !motoristaId) {
    console.log('Token ou motoristaId ausente, ignorando...');
    return;
  }

  try {
    console.log('🔄 Enviando token para servidor:', { motoristaId, token: token.substring(0, 20) + '...' });
    
    const response = await fetch(SAVE_EXPO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        motorista_id: motoristaId,
        expo_token: token
      }),
    });

    const result = await response.json();
    if (result.success) {
      console.log('✅ Token Expo salvo no servidor para motorista:', motoristaId);
    } else {
      console.warn('⚠️ Falha ao salvar token:', result.message);
    }
  } catch (error) {
    console.error('❌ Erro ao enviar token para servidor:', error);
  }
};

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState("");
  const notificationListener = useRef();
  const responseListener = useRef();
  const lastSeenMessageIdRef = useRef(null);
  const userDataRef = useRef(null);
  const [notificationModal, setNotificationModal] = useState({ visible: false, message: '', activeRideRef: null });
  
  // Ref para controle do AppState da bolha
  const appStateRef = useRef(AppState.currentState);

  // Ref de navegação para checar rota atual e navegar a partir do App
  const navigationRef = useRef(createNavigationContainerRef());
  const pendingNotificationDataRef = useRef(null);

  const { DriverForegroundService } = NativeModules || {};

  // Som de nova mensagem (pré-carregado e reutilizado)
  const messageSoundRef = useRef(null);
  // Módulo de fala (TTS) carregado dinamicamente
  const speechRef = useRef(null);

  const navigateFromNotificationData = (data) => {
    if (!data) return;

    if (!navigationRef.current?.isReady()) {
      pendingNotificationDataRef.current = data;
      return;
    }

    if (data?.tipo === 'corrida') {
      navigationRef.current.navigate('Inicio', {
        corridaPendente: data.corrida || { id: data.corrida_id },
        motoristaId: data.motorista_id,
      });
      return;
    }

    if (data?.target) {
      navigationRef.current.navigate(data.target);
    }
  };

  // ========== CONFIGURAÇÃO DO BACKGROUND LOCATION ==========
  useEffect(() => {
    let isMounted = true;

    const setupBackgroundLocation = async () => {
      try {
        // Solicitar permissões para foreground e background
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        
        if (foregroundStatus !== 'granted') {
          console.log('Permissão de foreground negada');
          return;
        }

        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        
        if (backgroundStatus !== 'granted') {
          console.log('Permissão de background negada');
          return;
        }

        // Verificar se a tarefa já está registrada
        const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
        
        if (!isTaskRegistered) {
          console.log('📱 Registrando tarefa de background location...');
        }
      } catch (error) {
        console.error('Erro ao configurar background location:', error);
      }
    };

    setupBackgroundLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  // ========== CONFIGURAÇÕES DE ÁUDIO E TTS ==========
  useEffect(() => {
    // Configurar modo de áudio (iOS tocar mesmo no modo silencioso)
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      } catch (e) {
        console.log('Falha ao configurar modo de áudio:', e);
      }
    })();

    // Carregar módulo de fala (TTS) se disponível
    try {
      const Speech = require('expo-speech');
      speechRef.current = Speech;
    } catch (e) {
      console.log('Módulo expo-speech não disponível. TTS desativado.');
    }

    // Cleanup do som ao desmontar
    return () => {
      if (messageSoundRef.current) {
        messageSoundRef.current.unloadAsync().catch(() => {});
        messageSoundRef.current = null;
      }
    };
  }, []);

  // ========== MODO IMERSIVO ANDROID ==========
  useEffect(() => {
    const applyImmersiveNavBar = async () => {
      if (Platform.OS !== 'android') return;
      try {
        // Tentar carregar o módulo dinamicamente
        const NavigationBar = require('expo-navigation-bar');
        if (NavigationBar) {
          await NavigationBar.setVisibilityAsync('hidden');
          await NavigationBar.setBehaviorAsync('overlay-swipe');
          await NavigationBar.setBackgroundColorAsync('transparent');
        }
      } catch (e) {
        // Módulo não disponível - não é crítico, apenas log
        if (__DEV__) {
          console.log('expo-navigation-bar não disponível (opcional)');
        }
      }
    };

    applyImmersiveNavBar();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        applyImmersiveNavBar();

        if (Platform.OS === 'android' && DriverForegroundService?.consumeOpenFromBubbleFlag) {
          DriverForegroundService.consumeOpenFromBubbleFlag()
            .then((openedFromBubble) => {
              if (openedFromBubble && navigationRef.current?.isReady()) {
                navigationRef.current.navigate('Inicio');
              }
            })
            .catch(() => {});
        }
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  // ========== FUNÇÕES DE ÁUDIO E TTS ==========
  const playNewMessageSound = async () => {
    try {
      if (!messageSoundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          require('./assets/sounds/newmensagem.mp3')
        );
        messageSoundRef.current = sound;
      }
      await messageSoundRef.current.replayAsync();
    } catch (e) {
      console.log('Erro ao reproduzir som de nova mensagem:', e);
    }
  };

  const speakNewMessage = (texto, remetenteTipo) => {
    try {
      const prefixo = (remetenteTipo || '').toLowerCase() === 'passageiro' ? 'Passageiro diz: ' : 'Motorista diz: ';
      const frase = `${prefixo}${texto || ''}`.replace(/\s+/g, ' ').trim();
      if (speechRef.current?.speak && frase) {
        speechRef.current.speak(frase, { language: 'pt-BR', rate: 1.0, pitch: 1.0 });
      }
    } catch (e) {
      console.log('Erro ao falar nova mensagem:', e);
    }
  };

  // ========== WATCHER DE MENSAGENS ==========
  useEffect(() => {
    let isMounted = true;
    let intervalId = null;

    const fetchActiveRideAndMessages = async () => {
      try {
        // 1) Ler dados do usuário
        const storedUser = await AsyncStorage.getItem('user_data');
        if (!storedUser) return;
        const user = JSON.parse(storedUser);
        userDataRef.current = user;
        const cpf = user?.cpf || '';
        const telefone = user?.telefone || '';
        if (!cpf && !telefone) return;

        // 2) Verificar corrida ativa
        const rideRes = await fetch(CHECK_ACTIVE_RIDES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpf, telefone })
        });
        const rideJson = await rideRes.json();
        const activeRide = rideJson?.active_ride ?? rideJson?.data?.active_ride ?? null;
        if (!activeRide || !activeRide.ref) return;

        // 3) Buscar mensagens da corrida ativa
        const msgRes = await fetch(`${BUSCAR_MSG_URL}?ref_corrida=${activeRide.ref}`);
        if (!msgRes.ok) return;
        const msgJson = await msgRes.json();
        const messages = msgJson?.messages || [];
        if (!messages.length) return;

        // 4) Detectar novas mensagens
        const sorted = messages
          .map(m => ({
            id: parseInt(m.id, 10),
            texto: m.mensagem,
            remetente: m.remetente_tipo,
            dataEnvio: m.data_envio
          }))
          .sort((a, b) => a.id - b.id);

        const lastSeen = lastSeenMessageIdRef.current ?? 0;
        const newMessages = sorted.filter(m => m.id > lastSeen);

        if (newMessages.length) {
          lastSeenMessageIdRef.current = sorted[sorted.length - 1].id;

          const lastFromPassenger = [...newMessages].reverse().find(m => (m.remetente || '').toLowerCase() === 'passageiro');
          if (lastFromPassenger && isMounted) {
            const currentRouteName = navigationRef.current?.isReady() 
              ? navigationRef.current.getCurrentRoute()?.name 
              : null;
            if (currentRouteName === 'Chat') {
              return;
            }

            speakNewMessage(lastFromPassenger.texto || '', 'passageiro');

            setNotificationModal({
              visible: true,
              message: lastFromPassenger.texto || 'Você recebeu uma nova mensagem',
              activeRideRef: activeRide.ref
            });

            playNewMessageSound();
          }
        }
      } catch (err) {
        console.log('Watcher de mensagens erro:', err?.message || err);
      }
    };

    intervalId = setInterval(fetchActiveRideAndMessages, 4000);
    fetchActiveRideAndMessages();

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // ========== NOTIFICAÇÕES PUSH + SALVAR TOKEN ==========
  useEffect(() => {
    // Configurar canais de notificação (Android)
    (async () => {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('corridas', {
            name: 'Corridas',
            importance: Notifications.AndroidImportance.MAX,
            enableVibrate: true,
            vibrationPattern: [0, 500, 200, 500],
            sound: 'default',
          });
        } catch (err) {
          console.log('Falha ao criar canal de notificação corridas:', err);
        }
      }
    })();
    const handleTokenRegistration = async (token) => {
      if (token) {
        console.log("📱 Expo Push Token recebido:", token.substring(0, 30) + "...");
        setExpoPushToken(token);
        
        // Tentar salvar o token no servidor
        try {
          const storedUser = await AsyncStorage.getItem('user_data');
          if (storedUser) {
            const user = JSON.parse(storedUser);
            const motoristaId = user?.id || user?.motorista_id;
            if (motoristaId) {
              console.log('👤 Motorista ID encontrado:', motoristaId);
              await saveExpoTokenToServer(token, motoristaId);
            } else {
              console.log('⚠️ Motorista ID não encontrado no user_data');
            }
          } else {
            console.log('ℹ️ Nenhum user_data encontrado no AsyncStorage');
          }
        } catch (err) {
          console.error('❌ Erro ao processar user_data:', err);
        }
      }
    };

    // Registrar para notificações push
    registerForPushNotificationsAsync().then(handleTokenRegistration);

    (async () => {
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        const data = lastResponse?.notification?.request?.content?.data;
        if (data) {
          navigateFromNotificationData(data);
        }
      } catch (err) {
        console.log('Falha ao ler última notificação:', err?.message || err);
      }
    })();

    // Listener para notificações recebidas
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("📩 Notificação recebida:", notification);
      });

    // Listener para quando usuário clica na notificação
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("👆 Usuário clicou na notificação:", response);
        const data = response.notification.request.content.data;
        navigateFromNotificationData(data);
      });

    return () => {
      if (notificationListener.current && typeof notificationListener.current.remove === 'function') {
        notificationListener.current.remove();
      }
      if (responseListener.current && typeof responseListener.current.remove === 'function') {
        responseListener.current.remove();
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          if (Platform.OS === 'android') {
            try {
              const NavigationBar = require('expo-navigation-bar');
              if (NavigationBar) {
                NavigationBar.setVisibilityAsync('hidden');
                NavigationBar.setBehaviorAsync('overlay-swipe');
                NavigationBar.setBackgroundColorAsync('transparent');
              }
            } catch {
              // Módulo não disponível - não é crítico
            }
          }

          if (pendingNotificationDataRef.current) {
            const data = pendingNotificationDataRef.current;
            pendingNotificationDataRef.current = null;
            navigateFromNotificationData(data);
          }
        }}
        onStateChange={() => {
          if (Platform.OS === 'android') {
            try {
              const NavigationBar = require('expo-navigation-bar');
              if (NavigationBar) {
                NavigationBar.setVisibilityAsync('hidden');
                NavigationBar.setBehaviorAsync('overlay-swipe');
                NavigationBar.setBackgroundColorAsync('transparent');
              }
            } catch {
              // Módulo não disponível - não é crítico
            }
          }
        }}
      >
        <AppNavigator />
      </NavigationContainer>

      {/* Modal de notificação global para novas mensagens */}
      <Modal
        visible={notificationModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificationModal(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nova mensagem</Text>
            <Text style={styles.modalMessage} numberOfLines={3}>
              {notificationModal.message}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalPrimaryButton]}
                onPress={() => {
                  const ref = notificationModal.activeRideRef;
                  const user = userDataRef.current || {};
                  setNotificationModal(prev => ({ ...prev, visible: false }));

                  if (navigationRef.current?.isReady() && ref) {
                    navigationRef.current.navigate('Chat', {
                      ref_corrida: ref,
                      userType: 'passageiro',
                      userId: user?.id || user?.cpf || 'unknown',
                      otherUserName: 'Motorista'
                    });
                  }
                }}
              >
                <Text style={styles.modalButtonTextPrimary}>Abrir chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSecondaryButton]}
                onPress={() => setNotificationModal(prev => ({ ...prev, visible: false }))}
              >
                <Text style={styles.modalButtonTextSecondary}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaProvider>
  );
}

// Função de registro de token (com tratamento de erro melhorado)
async function registerForPushNotificationsAsync() {
  let token;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      if (__DEV__) {
        console.log("⚠️ Permissão de notificações negada");
      }
      return null;
    }

    // Tentar obter o token Expo
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "3f39d6b4-1dca-4c8d-96a8-5a4daf9f36c7",
      });
      token = tokenData.data;
    } catch (err) {
      // Firebase não configurado - não é crítico para desenvolvimento
      if (err?.message?.includes('FirebaseApp') || err?.message?.includes('Firebase')) {
        if (__DEV__) {
          console.log("⚠️ Firebase não configurado. Push notifications podem não funcionar.");
          console.log("💡 Para produção, configure FCM seguindo: https://docs.expo.dev/push-notifications/fcm-credentials/");
        }
      } else {
        console.error("Erro ao obter token Expo:", err);
      }
      // Retornar null mas não quebrar o app
      return null;
    }
  } catch (error) {
    console.error("Erro ao registrar notificações:", error);
    return null;
  }

  return token;
}

// Estilos (mantidos iguais)
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalMessage: {
    color: '#d9d9d9',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalPrimaryButton: {
    backgroundColor: '#f5c611',
    borderColor: '#f5c611',
  },
  modalSecondaryButton: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalButtonTextPrimary: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '700',
  },
  modalButtonTextSecondary: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

import { useCallback, useRef } from 'react';
import { WS_CONFIG } from '../constants/api';

/**
 * Hook customizado para gerenciar conexões WebSocket
 * @param {string} url - URL do WebSocket
 * @returns {Object} Objeto com métodos para controlar o WebSocket
 */
export const useWebSocket = (url) => {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const messageHandlersRef = useRef(new Map());

  const addMessageHandler = useCallback((type, handler) => {
    messageHandlersRef.current.set(type, handler);
  }, []);

  const removeMessageHandler = useCallback((type) => {
    messageHandlersRef.current.delete(type);
  }, []);

  const connect = useCallback(() => {
    if (isConnectingRef.current || (wsRef.current?.readyState === WebSocket.OPEN)) {
      return;
    }

    isConnectingRef.current = true;
    
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        console.warn(`Erro ao fechar conexão anterior (${url}):`, e);
      }
      wsRef.current = null;
    }

    try {
      console.log(`🔗 Conectando ao WebSocket (${url})...`);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ WebSocket conectado! (${url})`);
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            } catch (error) {
              console.error(`Erro ao enviar ping (${url}):`, error);
            }
          }
        }, WS_CONFIG.PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const dataStr = event.data.toString();
          
          // Verificar se é HTML/erro HTTP
          if (dataStr.trim().startsWith('<!DOCTYPE') || 
              dataStr.includes('<html>') ||
              dataStr.includes('<head>') ||
              dataStr.includes('HTTP/1.1') ||
              dataStr.includes('Error') ||
              dataStr.trim().startsWith('<')) {
            
            console.warn(`⚠️ Servidor retornou HTML/Erro HTTP (${url}):`, dataStr.substring(0, 200));
            
            // Tentar reconectar após erro HTTP
            if (reconnectAttemptsRef.current < WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
              setTimeout(() => {
                console.log(`🔄 Reconectando após erro HTTP (${url})...`);
                connect();
              }, WS_CONFIG.RECONNECT_DELAY);
            }
            return;
          }
          
          // Tentar parse JSON
          try {
            const data = JSON.parse(dataStr);
            
            // DEBUG: Log mensagens recebidas
            if (data.type === 'nova_corrida') {
              console.log('🚗 NOVA CORRIDA RECEBIDA VIA WEBSOCKET:', {
                id: data.corrida?.id,
                ref: data.corrida?.ref,
                motoristaId: data.corrida?.motorista_id,
                valor: data.corrida?.valor,
                api_endpoint: data.api_endpoint
              });
            }

            let messageType = data.type;
            if (!messageType) {
              if (
                Array.isArray(data.corridas) ||
                data.total_corridas !== undefined ||
                data.corridas_pendentes !== undefined
              ) {
                messageType = 'corridas_list';
              } else if (data.success !== undefined) {
                messageType = 'response';
              }
            }

            if (messageType) {
              const handler = messageHandlersRef.current.get(messageType);
              if (handler) {
                try {
                  handler(data);
                } catch (error) {
                  console.error(`Erro no handler ${messageType} (${url}):`, error);
                }
              } else {
                console.log(`📨 Mensagem sem handler (${url}):`, messageType);
              }
            } else {
              console.log(`📨 Mensagem recebida sem type (${url})`);
            }

            if (data.type === 'pong') {
              console.log(`🏓 Pong recebido (${url})`);
            }
          } catch (parseError) {
            console.error(`❌ Erro ao fazer parse JSON (${url}):`, parseError.message);
            console.warn('Conteúdo recebido:', dataStr.substring(0, 500));
          }
        } catch (error) {
          console.error(`❌ Erro geral ao processar mensagem (${url}):`, error.message);
        }
      };

      ws.onclose = (event) => {
        console.log(`⚠️ WebSocket desconectado (${url}). Código: ${event.code}, Razão: ${event.reason}`);
        isConnectingRef.current = false;
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        if (reconnectAttemptsRef.current < WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          console.log(`🔄 Reconectando (${url}) (${reconnectAttemptsRef.current}/${WS_CONFIG.MAX_RECONNECT_ATTEMPTS})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, WS_CONFIG.RECONNECT_DELAY * reconnectAttemptsRef.current);
        } else {
          console.log(`❌ Máximo de tentativas de reconexão (${url})`);
        }
      };

      ws.onerror = (error) => {
        console.error(`❌ Erro WebSocket (${url}):`, error.message);
        isConnectingRef.current = false;
      };

    } catch (error) {
      console.error(`❌ Erro ao criar conexão (${url}):`, error);
      isConnectingRef.current = false;
    }
  }, [url]);

  const send = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify(data);
        wsRef.current.send(message);
        
        // DEBUG: Log mensagens enviadas importantes
        if (data.type === 'aceitar_corrida' || data.type === 'recusar_corrida') {
          console.log(`📤 Enviado (${url}):`, { type: data.type, corrida_id: data.corrida_id });
        }
        
        return true;
      } catch (error) {
        console.error(`❌ Erro ao enviar (${url}):`, error);
        return false;
      }
    } else {
      console.warn(`⚠️ WebSocket não conectado (${url}), estado:`, wsRef.current?.readyState);
      return false;
    }
  }, [url]);

  const disconnect = useCallback(() => {
    console.log(`🔌 Desconectando WebSocket (${url})`);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        console.warn(`Erro ao fechar WebSocket (${url}):`, e);
      }
      wsRef.current = null;
    }
    
    reconnectAttemptsRef.current = 0;
    isConnectingRef.current = false;
    messageHandlersRef.current.clear();
  }, [url]);

  const isConnected = useCallback(() => {
    return wsRef.current?.readyState === WebSocket.OPEN;
  }, []);

  const getConnectionState = useCallback(() => {
    if (!wsRef.current) return 'disconnected';
    
    switch (wsRef.current.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }, []);

  return {
    connect,
    disconnect,
    send,
    isConnected,
    getConnectionState,
    addMessageHandler,
    removeMessageHandler,
    wsRef
  };
};

// URLs da API
export const API_BASE_URL = 'https://beepapps.cloud/apppassageiro';
export const API_MOTORISTA_URL = 'https://beepapps.cloud/appmotorista';
export const API_ACAO_CORRIDA = `${API_MOTORISTA_URL}/api_acao_corrida.php`;
export const CHECK_ACTIVE_RIDES_URL = `${API_BASE_URL}/check_active_rides.php`;
export const BUSCAR_MSG_URL = `${API_BASE_URL}/buscar_msg.php`;
export const SAVE_EXPO_TOKEN_URL = `${API_MOTORISTA_URL}/save_expo_token.php`;

// WebSocket URLs
export const WS_LOCALIZACAO_URL = 'wss://beepapps.cloud/ws1';
export const WS_CORRIDAS_URL = 'wss://beepapps.cloud/ws2';

// WebSocket Config
export const WS_CONFIG = {
  RECONNECT_DELAY: 3000,
  PING_INTERVAL: 30000,
  PING_TIMEOUT: 10000,
  MAX_RECONNECT_ATTEMPTS: 10
};

// Background Tasks
export const LOCATION_TRACKING_TASK = 'background-location-tracking';

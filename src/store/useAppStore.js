import { create } from 'zustand';

/**
 * Store para gerenciar estado geral da aplicação
 */
export const useAppStore = create((set, get) => ({
  // Estado de online/offline
  online: false,
  setOnline: (value) => set({ online: value }),

  // Estado de corrida
  corridaAtual: null,
  temCorridaAtiva: false,
  setCorridaAtual: (corrida) => set({ corridaAtual: corrida }),
  setTemCorridaAtiva: (value) => set({ temCorridaAtiva: value }),

  // Saldo do dia
  saldoDia: 0,
  setSaldoDia: (value) => set({ saldoDia: value }),

  // Localização do motorista
  localizacaoMotorista: {
    latitude: -5.195395088992599,
    longitude: -39.280787173061384,
    latitudeDelta: 0.015,
    longitudeDelta: 0.0121,
  },
  setLocalizacaoMotorista: (location) => set({ localizacaoMotorista: location }),

  // Cidade atual
  cidadeAtual: null,
  setCidadeAtual: (city) => set({ cidadeAtual: city }),

  // Status de WebSocket
  wsLocalizacaoStatus: 'disconnected',
  wsCorridasStatus: 'disconnected',
  setWsLocalizacaoStatus: (status) => set({ wsLocalizacaoStatus: status }),
  setWsCorridasStatus: (status) => set({ wsCorridasStatus: status }),
}));

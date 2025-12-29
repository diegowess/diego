import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Store para gerenciar autenticação e dados do usuário/motorista
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // Estado
      user: null,
      motoristaId: null,
      tipoVeiculo: null,
      isAuthenticated: false,
      isLoading: true,

      // Actions
      setUser: (userData) => {
        const motoristaId = userData?.id || userData?.motorista_id || userData?.user_id;
        const tipoVeiculo = userData?.tipo_veiculo || userData?.tipoVeiculo;
        
        set({
          user: userData,
          motoristaId,
          tipoVeiculo,
          isAuthenticated: !!motoristaId,
        });

        // Também salvar no AsyncStorage para compatibilidade
        if (userData) {
          AsyncStorage.setItem('user_data', JSON.stringify(userData));
        }
      },

      clearUser: () => {
        set({
          user: null,
          motoristaId: null,
          tipoVeiculo: null,
          isAuthenticated: false,
        });
        AsyncStorage.removeItem('user_data');
      },

      loadUser: async () => {
        try {
          set({ isLoading: true });
          const stored = await AsyncStorage.getItem('user_data');
          if (stored) {
            const userData = JSON.parse(stored);
            const motoristaId = userData?.id || userData?.motorista_id || userData?.user_id;
            const tipoVeiculo = userData?.tipo_veiculo || userData?.tipoVeiculo;
            
            set({
              user: userData,
              motoristaId,
              tipoVeiculo,
              isAuthenticated: !!motoristaId,
              isLoading: false,
            });
            return userData;
          }
          set({ isLoading: false });
          return null;
        } catch (error) {
          console.error('Erro ao carregar usuário:', error);
          set({ isLoading: false });
          return null;
        }
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, ...updates };
          get().setUser(updatedUser);
        }
      },
    }),
    {
      name: 'auth-storage', // Nome da chave no AsyncStorage
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        motoristaId: state.motoristaId,
        tipoVeiculo: state.tipoVeiculo,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  NativeModules,
  RefreshControl,
  Platform as RNPlatform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Chaves para armazenamento
export const USER_DATA_KEY = 'user_data';
export const LOGIN_CREDENTIALS_KEY = 'login_credentials';

const PerfilScreen = ({ navigation, route }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Estados para edição
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados para endereço
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  // Sincronizar campos com dados do usuário
  useEffect(() => {
    if (user) {
      setNome(user.nome || '');
      setEmail(user.email || '');
      setTelefone(user.telefone || '');
      setRua(user.rua || '');
      setNumero(user.numero || '');
      setBairro(user.bairro || '');
      setCidade(user.cidade || '');
      setEstado(user.estado || '');
    }
  }, [user]);

  // Carregar dados quando a tela for focada
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserData();
    });

    return unsubscribe;
  }, [navigation]);

  // Carregar dados do usuário
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      const storedUser = await AsyncStorage.getItem(USER_DATA_KEY);
      
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        
        // Buscar dados atualizados do servidor
        await fetchUpdatedUserData(userData.id);
      } else {
        Alert.alert('Erro', 'Usuário não encontrado');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Falha ao carregar dados do usuário');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUpdatedUserData = async (userId) => {
    try {
      const response = await fetch('https://beepapps.cloud/appmotorista/get_user_data.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.user) {
          // Atualizar dados locais
          const updatedUser = {
            ...result.user,
            // Garantir que os campos existam
            nome: result.user.nome || '',
            email: result.user.email || '',
            telefone: result.user.telefone || '',
            rua: result.user.rua || '',
            numero: result.user.numero || '',
            bairro: result.user.bairro || '',
            cidade: result.user.cidade || '',
            estado: result.user.estado || '',
            nota: result.user.nota || '5.0',
            qtd_corridas: result.user.qtd_corridas || 0
          };
          
          setUser(updatedUser);
          await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados atualizados:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleEditProfile = async () => {
  if (!nome.trim()) {
    Alert.alert('Erro', 'Nome é obrigatório');
    return;
  }

  if (!email.trim()) {
    Alert.alert('Erro', 'Email é obrigatório');
    return;
  }

  setIsLoading(true);
  try {
    console.log('=== INICIANDO ATUALIZAÇÃO DE PERFIL ===');
    
    const url = 'https://beepapps.cloud/appmotorista/update_profile.php';
    console.log('URL:', url);
    
    const requestData = {
      user_id: user.id,
      nome: nome.trim(),
      email: email.trim(),
      telefone: telefone.trim() || '',
      rua: rua.trim() || '',
      numero: numero.trim() || '',
      bairro: bairro.trim() || '',
      cidade: cidade.trim() || '',
      estado: estado.trim() || ''
    };
    
    console.log('Dados enviados:', JSON.stringify(requestData, null, 2));
    
    // Adicionar timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestData),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('Status:', response.status);
    console.log('Status text:', response.statusText);
    
    // Verificar se a resposta é válida
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Pegar resposta como texto primeiro
    const responseText = await response.text();
    console.log('Resposta completa (primeiros 500 chars):', responseText.substring(0, 500));
    
    if (!responseText.trim()) {
      throw new Error('Resposta vazia do servidor');
    }
    
    // Tentar parsear JSON
    let result;
    try {
      result = JSON.parse(responseText);
      console.log('JSON parseado com sucesso:', result);
    } catch (jsonError) {
      console.error('Erro ao parsear JSON:', jsonError);
      console.error('Texto que causou erro:', responseText);
      throw new Error('Resposta do servidor não é JSON válido');
    }
    
    // Verificar estrutura da resposta
    if (typeof result.success === 'undefined') {
      throw new Error('Resposta não contém campo "success"');
    }
    
    if (result.success) {
      console.log('Atualização bem-sucedida!');
      
      // Atualizar dados locais
      const updatedUser = {
        ...user,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        rua: rua.trim(),
        numero: numero.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        estado: estado.trim()
      };
      
      // Se o servidor retornou dados atualizados, usar eles
      if (result.user) {
        Object.assign(updatedUser, result.user);
      }
      
      setUser(updatedUser);
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
      
      Alert.alert('Sucesso', result.message || 'Perfil atualizado com sucesso!');
      setEditMode(false);
      
      // Recarregar dados
      loadUserData();
      
    } else {
      Alert.alert('Erro', result.message || 'Falha ao atualizar perfil');
    }
    
  } catch (error) {
    console.error('=== ERRO DETALHADO ===');
    console.error('Mensagem:', error.message);
    console.error('Tipo:', error.name);
    
    if (error.name === 'AbortError') {
      Alert.alert('Timeout', 'A requisição demorou muito. Verifique sua conexão.');
    } else if (error.message.includes('Network request failed')) {
      Alert.alert('Erro de Rede', 'Não foi possível conectar ao servidor. Verifique sua conexão.');
    } else {
      Alert.alert('Erro', `Não foi possível atualizar o perfil: ${error.message}`);
    }
  } finally {
    setIsLoading(false);
  }
};

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Erro', 'Todos os campos de senha são obrigatórios');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erro', 'As novas senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Erro', 'A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('https://beepapps.cloud/appmotorista/change_password.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert('Sucesso', 'Senha alterada com sucesso!');
        setModalVisible(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('Erro', result.message || 'Falha ao alterar senha');
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      Alert.alert('Erro', 'Falha na conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              if (RNPlatform.OS === 'android' && NativeModules?.DriverForegroundService?.stopService) {
                try {
                  await NativeModules.DriverForegroundService.stopService();
                } catch (e) {
                  console.log('Falha ao parar DriverForegroundService (logout):', e);
                }
              }
              await AsyncStorage.removeItem(USER_DATA_KEY);
              await AsyncStorage.removeItem(LOGIN_CREDENTIALS_KEY);
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Erro ao fazer logout:', error);
            }
          }
        }
      ]
    );
  };

  const formatCPF = (cpf) => {
    if (!cpf) return 'Não informado';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatPhone = (phone) => {
    if (!phone) return 'Não informado';
    // Remove caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Formata baseado no tamanho
    if (cleanPhone.length === 11) {
      return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (cleanPhone.length === 10) {
      return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
      return phone;
    }
  };

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#000" translucent={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Carregando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar  backgroundColor="#000" showHideTransition={true} />
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={60} color="#666" />
          <Text style={styles.errorText}>Usuário não encontrado</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadUserData}
          >
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent={false} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            loadUserData().then(() => {
              navigation.goBack();
            });
          }}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Perfil</Text>
        
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => setEditMode(!editMode)}
        >
          <Icon 
            name={editMode ? "close" : "edit"} 
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#000']}
            tintColor="#000"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Seção do Perfil */}
        <View style={styles.profileSection}>
          <LinearGradient
            colors={['#000', '#1a1a1a']}
            style={styles.profileGradient}
          >
            <View style={styles.avatarContainer}>
              {user.foto ? (
                <Image 
                  source={{ uri: user.foto }} 
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Icon name="person" size={40} color="#666" />
                </View>
              )}
            </View>

            <Text style={styles.userName}>{user.nome}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            
            {/* Rating Section */}
            <View style={styles.ratingSection}>
              <View style={styles.ratingContainer}>
                <View style={styles.ratingStars}>
                  <Icon name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>{user.nota || '5.0'}</Text>
                </View>
                <Text style={styles.corridasText}>{user.qtd_corridas || 0} corridas</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Informações Pessoais */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="person-outline" size={20} color="#000" />
            <Text style={styles.cardTitle}>Informações Pessoais</Text>
          </View>
          
          <View style={styles.infoItem}>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Nome completo</Text>
              {editMode ? (
                <TextInput
                  style={styles.textInput}
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Digite seu nome"
                  placeholderTextColor="#999"
                />
              ) : (
                <Text style={styles.infoValue}>{user.nome}</Text>
              )}
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              {editMode ? (
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Digite seu email"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={styles.infoValue}>{user.email}</Text>
              )}
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Telefone</Text>
              {editMode ? (
                <TextInput
                  style={styles.textInput}
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder="Digite seu telefone"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.infoValue}>
                  {formatPhone(user.telefone)}
                </Text>
              )}
            </View>
          </View>

          {user.cpf && (
            <View style={styles.infoItem}>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>CPF</Text>
                <Text style={styles.infoValue}>{formatCPF(user.cpf)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Endereço */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="location-on" size={20} color="#000" />
            <Text style={styles.cardTitle}>Endereço</Text>
          </View>
          
          {editMode ? (
            <>
              <View style={styles.infoItem}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Rua</Text>
                  <TextInput
                    style={styles.textInput}
                    value={rua}
                    onChangeText={setRua}
                    placeholder="Digite a rua"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Número</Text>
                  <TextInput
                    style={styles.textInput}
                    value={numero}
                    onChangeText={setNumero}
                    placeholder="Número"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Bairro</Text>
                  <TextInput
                    style={styles.textInput}
                    value={bairro}
                    onChangeText={setBairro}
                    placeholder="Digite o bairro"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Cidade</Text>
                  <TextInput
                    style={styles.textInput}
                    value={cidade}
                    onChangeText={setCidade}
                    placeholder="Digite a cidade"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Estado</Text>
                  <TextInput
                    style={styles.textInput}
                    value={estado}
                    onChangeText={setEstado}
                    placeholder="Digite o estado"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              {(user.rua || user.numero) && (
                <View style={styles.infoItem}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Endereço</Text>
                    <Text style={styles.infoValue}>
                      {user.rua || ''} {user.numero || ''}
                    </Text>
                  </View>
                </View>
              )}

              {user.bairro && (
                <View style={styles.infoItem}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Bairro</Text>
                    <Text style={styles.infoValue}>{user.bairro}</Text>
                  </View>
                </View>
              )}

              {(user.cidade || user.estado) && (
                <View style={styles.infoItem}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Cidade/Estado</Text>
                    <Text style={styles.infoValue}>
                      {user.cidade || ''} {user.estado ? `- ${user.estado}` : ''}
                    </Text>
                  </View>
                </View>
              )}

              {!user.rua && !user.bairro && !user.cidade && (
                <View style={styles.emptyState}>
                  <Icon name="location-off" size={40} color="#666" />
                  <Text style={styles.emptyStateText}>Nenhum endereço cadastrado</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Ações */}
        <View style={styles.actionsSection}>
          {editMode ? (
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleEditProfile}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#000', '#333']}
                style={styles.saveButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon name="check" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setModalVisible(true)}
              >
                <View style={styles.actionButtonIcon}>
                  <Icon name="lock" size={22} color="#000" />
                </View>
                <View style={styles.actionButtonContent}>
                  <Text style={styles.actionButtonTitle}>Alterar Senha</Text>
                  <Text style={styles.actionButtonSubtitle}>Atualize sua senha de acesso</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('Historico')}
              >
                <View style={styles.actionButtonIcon}>
                  <Icon name="history" size={22} color="#000" />
                </View>
                <View style={styles.actionButtonContent}>
                  <Text style={styles.actionButtonTitle}>Histórico de Corridas</Text>
                  <Text style={styles.actionButtonSubtitle}>Veja suas corridas anteriores</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('Carteira', { 
                  motoristaId: (user?.id || user?.motorista_id || user?.user_id) 
                })}
              >
                <View style={styles.actionButtonIcon}>
                  <Icon name="account-balance-wallet" size={22} color="#000" />
                </View>
                <View style={styles.actionButtonContent}>
                  <Text style={styles.actionButtonTitle}>Carteira</Text>
                  <Text style={styles.actionButtonSubtitle}>Saldo e saques</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.logoutButton]}
                onPress={handleLogout}
              >
                <View style={styles.actionButtonIcon}>
                  <Icon name="logout" size={22} color="#ff4444" />
                </View>
                <View style={styles.actionButtonContent}>
                  <Text style={[styles.actionButtonTitle, styles.logoutText]}>Sair da Conta</Text>
                  <Text style={styles.actionButtonSubtitle}>Encerrar sessão atual</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Espaço no final */}
        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Modal para Alterar Senha */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alterar Senha</Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={styles.modalInput}
                placeholder="Senha atual"
                placeholderTextColor="#999"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Nova senha"
                placeholderTextColor="#999"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Confirmar nova senha"
                placeholderTextColor="#999"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={handleChangePassword}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#000', '#333']}
                  style={styles.confirmButtonGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Alterar Senha</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    color: '#000',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  errorText: {
    color: '#000',
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#000',
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#000',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 8,
  },
  editButton: {
    padding: 8,
  },
  profileSection: {
    marginBottom: 8,
  },
  profileGradient: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  userEmail: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  ratingSection: {
    marginTop: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  corridasText: {
    color: '#ccc',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  infoValue: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  textInput: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  actionsSection: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonTitle: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  actionButtonSubtitle: {
    color: '#666',
    fontSize: 12,
  },
  logoutButton: {
    marginTop: 8,
  },
  logoutText: {
    color: '#ff4444',
  },
  bottomSpace: {
    height: 30,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#f8f8f8',
    color: '#000',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  cancelButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PerfilScreen;
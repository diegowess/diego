import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');

  // Verifica se já existe sessão salva e pula o login
  useEffect(() => {
    const checkSavedSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user_data');
        if (storedUser) {
          navigation.replace('Inicio');
        }
      } catch (e) {
        // Apenas log
        console.log('Erro ao verificar sessão salva:', e);
      }
    };
    checkSavedSession();
  }, [navigation]);

  const formatCPF = (text) => {
    const cleaned = text.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})$/);
    if (match) {
      return !match[2] ? match[1] : `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}${match[4] ? `-${match[4]}` : ''}`;
    }
    return text;
  };

  const handleLogin = async () => {
    if (!cpf || !senha) {
      Alert.alert('Erro', 'Por favor, preencha CPF e senha');
      return;
    }

    // Remove formatação do CPF
    const cpfNumerico = cpf.replace(/\D/g, '');

    if (cpfNumerico.length !== 11) {
      Alert.alert('Erro', 'CPF deve ter 11 dígitos');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('https://beepapps.cloud/appmotorista/login.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: cpfNumerico,
          senha: senha
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Login bem-sucedido
        Alert.alert('Sucesso', 'Login realizado com sucesso!');
        // Salvar sessão para não precisar logar novamente
        try {
          const rawUser = data.user ? data.user : { cpf: cpfNumerico };
          // Normalizar a estrutura para sempre conter um campo 'id' do motorista
          const normalizedId = rawUser?.id ?? rawUser?.motorista_id ?? rawUser?.user_id ?? null;
          const userPayload = normalizedId ? { ...rawUser, id: normalizedId } : rawUser;
          await AsyncStorage.setItem('user_data', JSON.stringify(userPayload));
          await AsyncStorage.setItem('login_credentials', JSON.stringify({ cpf: cpfNumerico, senha }));
        } catch (e) {
          console.log('Falha ao salvar sessão:', e);
        }
        // Redirecionar para a tela Inicio
        navigation.replace('Inicio');
      } else {
        Alert.alert('Erro', data.message || 'Erro ao fazer login');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleCPFChange = (text) => {
    setCpf(formatCPF(text));
  };

  const handleForgotPassword = () => {
    setShowEmailModal(true);
    setEmail('');
  };

  const handleSendRecoveryEmail = () => {
  if (!email || !email.includes('@')) {
    Alert.alert('Erro', 'Por favor, digite um e-mail válido');
    return;
  }

  console.log('Enviando recuperação para:', email);
  
  setLoading(true);
  
  // Log para debug
  console.log('Fazendo requisição para password_reset.php...');
  
  fetch('https://beepapps.cloud/appmotorista/password_reset.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'request_reset',
      email: email.trim()
    }),
  })
  .then(response => {
    console.log('Status da resposta:', response.status);
    console.log('Headers:', response.headers);
    return response.json();
  })
  .then(data => {
    console.log('Resposta do servidor:', data);
    setLoading(false);
    setShowEmailModal(false);
    Alert.alert(
      data.success ? 'Sucesso' : 'Aviso',
      data.message
    );
  })
  .catch(error => {
    console.error('Erro completo:', error);
    setLoading(false);
    Alert.alert('Erro', 'Não foi possível processar sua solicitação: ' + error.message);
  });
};

  const closeEmailModal = () => {
    setShowEmailModal(false);
    setEmail('');
  };

  return (
    <ImageBackground
      source={require('../../assets/images/sertao.jpg')}
      style={styles.background}
      blurRadius={5}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header com Logo */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>BeepCar</Text>
            <Text style={styles.driveText}>Motorista</Text>
          </View>
          <Text style={styles.tagline}>Seu motorista de confiança</Text>
        </View>

        {/* Formulário de Login */}
        <View style={styles.loginContainer}>
          <Text style={styles.title}>Entrar</Text>
          <Text style={styles.subtitle}>Acesse sua conta de motorista</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>CPF</Text>
            <TextInput
              style={styles.input}
              placeholder="000.000.000-00"
              placeholderTextColor="#999"
              value={cpf}
              onChangeText={handleCPFChange}
              keyboardType="numeric"
              maxLength={14}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite sua senha"
              placeholderTextColor="#999"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginButtonText}>ENTRAR</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.forgotPassword} 
            onPress={handleForgotPassword}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordText}>Esqueci minha senha</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}></Text>
        </View>

        {/* Modal para digitar e-mail */}
        <Modal
          visible={showEmailModal}
          transparent={true}
          animationType="slide"
          onRequestClose={closeEmailModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Recuperar Senha</Text>
              <Text style={styles.modalSubtitle}>
                Digite seu e-mail cadastrado para receber o link de recuperação:
              </Text>
              
              <TextInput
                style={styles.emailInput}
                placeholder="seu@email.com"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={closeEmailModal}
                  disabled={loading}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.sendButton]} 
                  onPress={handleSendRecoveryEmail}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.sendButtonText}>Enviar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: height * 0.1,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
  driveText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.9,
  },
  loginContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 20,
    padding: 25,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
    color: '#000',
  },
  loginButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotPasswordText: {
    color: '#666',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  footerText: {
    color: '#FFF',
    fontSize: 12,
    opacity: 0.7,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  emailInput: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
    color: '#000',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  sendButton: {
    backgroundColor: '#000',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
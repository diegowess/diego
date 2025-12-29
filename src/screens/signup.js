import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SignUp({ navigation }) {
  // Estados para controle de etapas
  const [currentStep, setCurrentStep] = useState(1);
  const [foto, setFoto] = useState(null);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [modalTermosVisible, setModalTermosVisible] = useState(false);
  
  // Estados dos dados do usuário
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleButtonPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Formatação de CPF e Telefone
  const formatCPF = (text) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
    if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
  };

  const formatTelefone = (text) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  };

  // Função para upload de foto
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para adicionar uma foto.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setFoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Falha ao selecionar imagem');
    }
  };

  // Função para upload de foto para o servidor
  const uploadFoto = async (userId) => {
    if (!foto) return null;
    
    try {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('foto', {
        uri: foto,
        type: 'image/jpeg',
        name: 'profile.jpg'
      });

      const uploadResponse = await fetch('https://beepapps.cloud/apppassageiro/upload_foto.php', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadResult = await uploadResponse.json();
      
      if (uploadResult.success) {
        return uploadResult.foto_url;
      } else {
        console.error('Erro no upload:', uploadResult.message);
        return null;
      }
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      return null;
    }
  };

  // Validação da primeira etapa (Dados Pessoais)
  const validateStep1 = () => {
    if (!nome.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório');
      return false;
    }

    if (!email.trim()) {
      Alert.alert('Erro', 'Email é obrigatório');
      return false;
    }

    if (!cpf || cpf.length !== 14) {
      Alert.alert('Erro', 'CPF inválido');
      return false;
    }

    if (!telefone || telefone.length < 14) {
      Alert.alert('Erro', 'Telefone inválido');
      return false;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erro', 'Email inválido');
      return false;
    }

    return true;
  };

  // Validação da segunda etapa (Senha)
  const validateStep2 = () => {
    if (!senha || !confirmarSenha) {
      Alert.alert('Erro', 'Por favor, preencha a senha');
      return false;
    }

    if (senha !== confirmarSenha) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return false;
    }

    if (senha.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return false;
    }

    return true;
  };

  // Avançar para próxima etapa
  const nextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  // Voltar para etapa anterior
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  // Função final de cadastro
  const handleSignUp = async () => {
    if (!aceitouTermos) {
      Alert.alert('Erro', 'Você precisa aceitar os termos de política para continuar');
      return;
    }

    setIsLoading(true);

    try {
      const cleanCpf = cpf.replace(/\D/g, '');
      const cleanTelefone = telefone.replace(/\D/g, '');

      // Dados para cadastro
      const userData = {
        nome: nome.trim(),
        email: email.trim(),
        cpf: cleanCpf,
        telefone: cleanTelefone,
        senha: senha
      };

      // Fazer cadastro
      const response = await fetch('https://beepapps.cloud/apppassageiro/signup.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      const result = await response.json();

      if (result.success) {
        // Fazer upload da foto se houver
        let fotoUrl = null;
        if (foto) {
          fotoUrl = await uploadFoto(result.user_id);
        }

        Alert.alert(
          'Sucesso', 
          'Cadastro realizado com sucesso!',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      } else {
        Alert.alert('Erro', result.message || 'Erro ao realizar cadastro');
      }
      
    } catch (error) {
      console.error('Erro no cadastro:', error);
      Alert.alert('Erro', 'Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar etapa atual
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return renderStep1();
    }
  };

  const renderStep1 = () => (
    <>
      <Text style={styles.stepTitle}>Dados Pessoais</Text>
      
      {/* Foto do perfil */}
      <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
        {foto ? (
          <Image source={{ uri: foto }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera" size={32} color="#666" />
            <Text style={styles.photoText}>Adicionar Foto</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.inputContainer}>
        <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Nome completo"
          placeholderTextColor="#666"
          value={nome}
          onChangeText={setNome}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="mail" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="card" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="CPF"
          placeholderTextColor="#666"
          value={cpf}
          onChangeText={(text) => setCpf(formatCPF(text))}
          keyboardType="numeric"
          maxLength={14}
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="call" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Telefone"
          placeholderTextColor="#666"
          value={telefone}
          onChangeText={(text) => setTelefone(formatTelefone(text))}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.stepTitle}>Segurança</Text>
      
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#666"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity 
          style={styles.eyeIconContainer} 
          onPress={() => setShowPassword(!showPassword)}
        >
          <Ionicons 
            name={showPassword ? "eye-off" : "eye"} 
            size={20} 
            color="#666" 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Confirmar senha"
          placeholderTextColor="#666"
          value={confirmarSenha}
          onChangeText={setConfirmarSenha}
          secureTextEntry={!showConfirmPassword}
        />
        <TouchableOpacity 
          style={styles.eyeIconContainer} 
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
        >
          <Ionicons 
            name={showConfirmPassword ? "eye-off" : "eye"} 
            size={20} 
            color="#666" 
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.passwordHint}>
        A senha deve ter pelo menos 6 caracteres
      </Text>
    </>
  );

  const renderStep3 = () => (
    <>
      <Text style={styles.stepTitle}>Termos e Condições</Text>
      
      <View style={styles.termsContainer}>
        <Ionicons name="document-text" size={60} color="#666" />
        <Text style={styles.termsTitle}>Política de Privacidade</Text>
        <Text style={styles.termsDescription}>
          Para finalizar seu cadastro, leia e aceite nossa política de privacidade e termos de uso.
        </Text>
        
        <TouchableOpacity 
          style={styles.readTermsButton}
          onPress={() => setModalTermosVisible(true)}
        >
          <Text style={styles.readTermsText}>Ler Política Completa</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.termsCheckbox, aceitouTermos && styles.termsCheckboxChecked]}
          onPress={() => setAceitouTermos(!aceitouTermos)}
        >
          <Ionicons 
            name={aceitouTermos ? "checkbox" : "square-outline"} 
            size={24} 
            color={aceitouTermos ? "#fff" : "#666"} 
          />
          <Text style={styles.termsCheckboxText}>
            Li e aceito os termos de política
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <LinearGradient
      colors={['#0a0a0a', '#1a1a1a', '#2a2a2a']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <Animated.View style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={prevStep}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              
              <View style={styles.logoContainer}>
                <Ionicons name="person-add" size={50} color="#fff" />
              </View>
              <Text style={styles.title}>Cadastro</Text>
              <Text style={styles.subtitle}>Etapa {currentStep} de 3</Text>
              
              {/* Progress Steps */}
              <View style={styles.progressContainer}>
                {[1, 2, 3].map((step) => (
                  <View 
                    key={step}
                    style={[
                      styles.progressStep,
                      step <= currentStep && styles.progressStepActive,
                      step < currentStep && styles.progressStepCompleted
                    ]}
                  />
                ))}
              </View>
            </Animated.View>

            {/* Form */}
            <Animated.View style={[
              styles.formContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}>
              <View style={styles.form}>
                {renderStep()}

                {/* Botões de Navegação */}
                <View style={styles.buttonsContainer}>
                  {currentStep > 1 && (
                    <TouchableOpacity 
                      style={styles.secondaryButton}
                      onPress={prevStep}
                    >
                      <Text style={styles.secondaryButtonText}>Voltar</Text>
                    </TouchableOpacity>
                  )}
                  
                  {currentStep < 3 ? (
                    <TouchableOpacity 
                      style={styles.primaryButton}
                      onPress={nextStep}
                    >
                      <Text style={styles.primaryButtonText}>Continuar</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.primaryButton, (!aceitouTermos || isLoading) && styles.primaryButtonDisabled]}
                      onPress={handleSignUp}
                      disabled={!aceitouTermos || isLoading}
                    >
                      {isLoading ? (
                        <Text style={styles.primaryButtonText}>Cadastrando...</Text>
                      ) : (
                        <Text style={styles.primaryButtonText}>Finalizar Cadastro</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Link para Login */}
                <TouchableOpacity 
                  style={styles.loginLink}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.loginLinkText}>
                    Já tem uma conta? <Text style={styles.loginLinkBold}>Entrar</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Modal de Termos */}
        <Modal
          animationType="slide"
          transparent={false}
          visible={modalTermosVisible}
          onRequestClose={() => setModalTermosVisible(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.modalBackButton}
                onPress={() => setModalTermosVisible(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
                <Text style={styles.modalBackText}>Voltar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Política de Privacidade</Text>
            </View>
            
            <WebView 
              source={{ uri: 'https://88driveqxb.shop/politica.html' }}
              style={styles.webview}
            />
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.acceptButton}
                onPress={() => {
                  setAceitouTermos(true);
                  setModalTermosVisible(false);
                }}
              >
                <Text style={styles.acceptButtonText}>Aceitar Termos</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 8,
  },
  logoContainer: {
    marginBottom: 16,
    backgroundColor: 'transparent',
    borderRadius: 25,
    padding: 15,
    borderWidth: 2,
    borderColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  progressStep: {
    width: 30,
    height: 4,
    backgroundColor: '#333',
    marginHorizontal: 4,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#fff',
  },
  progressStepCompleted: {
    backgroundColor: '#3ddc84',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  form: {
    width: '100%',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  photoText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    height: 60,
  },
  inputIcon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 0,
  },
  eyeIconContainer: {
    padding: 8,
  },
  passwordHint: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  termsContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    marginBottom: 24,
  },
  termsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  termsDescription: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  readTermsButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 20,
  },
  readTermsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  termsCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  termsCheckboxChecked: {
    backgroundColor: 'rgba(61, 220, 132, 0.2)',
    borderColor: '#3ddc84',
  },
  termsCheckboxText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginRight: 8,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginLeft: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#666',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 16,
  },
  loginLinkText: {
    color: '#ccc',
    fontSize: 16,
  },
  loginLinkBold: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBackText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 60,
  },
  webview: {
    flex: 1,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  acceptButton: {
    backgroundColor: '#3ddc84',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
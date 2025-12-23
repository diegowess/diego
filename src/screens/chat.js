import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// Configurações da API
const API_BASE_URL = 'https://beepapps.cloud/apppassageiro';
const ENVIAR_MSG_URL = `${API_BASE_URL}/enviar_msg.php`;
const BUSCAR_MSG_URL = `${API_BASE_URL}/buscar_msg.php`; // Você precisará criar este endpoint

export default function Chat({ route, navigation }) {
  // Dados da corrida vindos da navegação
  const { 
    ref_corrida, 
    userType = 'passageiro', 
    userId, 
    otherUserName = 'Motorista',
    driverInfo 
  } = route.params || {};
  
  const [corridaData] = useState({
    ref_corrida: ref_corrida || 'CR-default',
    userType: userType,
    userId: userId,
    otherUserName: otherUserName
  });

  // Debug para verificar se a ref está chegando corretamente
  useEffect(() => {
    console.log('Chat iniciado com dados:', {
      ref_corrida,
      userType,
      userId,
      otherUserName
    });
    console.log('Ref da corrida no chat:', corridaData.ref_corrida);
  }, []);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);
  const [userPhoto, setUserPhoto] = useState(null);

  const quickMessages = [
    'Olá!',
    'Bom dia!',
    'Boa tarde!',
    'Boa noite!',
    'Estou a caminho.',
    'Cheguei no local.',
    'Pode sair agora?',
    'Obrigado!'
  ];

  // Carregar foto do usuário do AsyncStorage
  useEffect(() => {
    const loadUserPhoto = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user_data');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed?.foto) {
            setUserPhoto(parsed.foto);
            console.log('Foto do usuário carregada no chat:', parsed.foto);
          } else {
            console.log('Usuário sem foto, usando fallback.');
          }
        }
      } catch (e) {
        console.log('Erro ao carregar foto do usuário:', e);
      }
    };
    loadUserPhoto();
  }, []);

  // Buscar mensagens existentes ao carregar
  useEffect(() => {
    fetchMessages();
    
    // Polling para novas mensagens a cada 3 segundos
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

// E atualize a função fetchMessages:
const fetchMessages = async () => {
  try {
    console.log('Buscando mensagens para:', corridaData.ref_corrida);
    
    const response = await fetch(
      `${BUSCAR_MSG_URL}?ref_corrida=${corridaData.ref_corrida}`
    );
    
    console.log('Resposta da API:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Dados recebidos:', data);
      
      if (data.success && data.messages) {
        // Converter mensagens da API para o formato do app
        const formattedMessages = data.messages.map(msg => ({
          id: msg.id.toString(),
          text: msg.mensagem,
          time: formatTime(msg.data_envio), // Usar data_envio do banco
          isUser: msg.remetente_tipo === corridaData.userType,
          rawData: msg
        }));
        
        console.log('Mensagens formatadas:', formattedMessages.length);
        setMessages(formattedMessages);
      }
    } else {
      console.error('Erro na resposta:', response.status);
    }
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
  }
};

 const formatTime = (dateString) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // Se não for uma data válida, usar hora atual
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    console.error('Erro ao formatar tempo:', error);
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};

  const sendMessage = async (textParam) => {
    const candidate = textParam ?? newMessage;
    if (!candidate || !candidate.trim()) return;

    const messageText = candidate.trim();
    if (!textParam) setNewMessage('');
    setLoading(true);

    // Mensagem otimista (aparece imediatamente)
    const tempMessage = {
      id: `temp_${Date.now()}`,
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isUser: true
    };

    setMessages(prev => [...prev, tempMessage]);

    // Rola para a última mensagem
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const response = await fetch(ENVIAR_MSG_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref_corrida: corridaData.ref_corrida,
          remetente_tipo: corridaData.userType,
          remetente_id: corridaData.userId,
          mensagem: messageText
        })
      });

      const data = await response.json();

      // No sendMessage, atualize esta parte:
if (data.success) {
  // Remove a mensagem temporária e adiciona a definitiva da API
  setMessages(prev => {
    const filtered = prev.filter(msg => msg.id !== tempMessage.id);
    return [...filtered, {
      id: data.message.id.toString(),
      text: data.message.mensagem,
      time: formatTime(data.message.data_envio),
      isUser: true
    }];
  });
} else {
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem. Tente novamente.');
      
      // Remove a mensagem temporária em caso de erro
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setLoading(false);
    }
  };

  const motoristaIcon = require('../../assets/images/motoristaicon.png');
  const defaultUserIcon = require('../../assets/images/icon.png');

  const renderMessage = ({ item }) => {
    const isUser = item.isUser;
    return (
      <View style={[styles.messageRow, isUser ? styles.rowRight : styles.rowLeft]}>
        {!isUser && (
          <Image source={motoristaIcon} style={styles.avatar} />
        )}
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.driverBubble
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userText : styles.driverText
          ]}>
            {item.text}
          </Text>
          <Text style={styles.messageTime}>
            {item.time}
          </Text>
        </View>
        {isUser && (
          <Image
            source={userPhoto ? { uri: userPhoto } : defaultUserIcon}
            style={[styles.avatar, styles.userAvatar]}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Botão voltar flutuante */}
      <TouchableOpacity 
        style={styles.floatingBackButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>

      {/* Lista de Mensagens */}
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Mensagem de Segurança Fixa */}
        <View style={styles.securityMessageContainer}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#4A90E2" />
          <Text style={styles.securityMessageText}>
            Lembre-se: nunca compartilhe senhas ou informações pessoais. Nossos motoristas nunca pedirão pagamentos fora da plataforma.
          </Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
              <Text style={styles.emptySubtext}>Inicie a conversa enviando uma mensagem</Text>
            </View>
          }
        />

        <View style={styles.quickRepliesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {quickMessages.map((msg) => (
              <TouchableOpacity
                key={msg}
                style={styles.quickReply}
                onPress={() => sendMessage(msg)}
                disabled={loading}
              >
                <Text style={styles.quickReplyText}>{msg}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Barra de Digitação */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Digite sua mensagem..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            editable={!loading}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              (!newMessage.trim() || loading) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ccc" />
            ) : (
              <Ionicons 
                name="send" 
                size={20} 
                color={newMessage.trim() ? "#fff" : "#ccc"} 
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  floatingBackButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    backgroundColor: '#fff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    alignItems: 'center',
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  driverStatus: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  menuButton: {
    padding: 4,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  rowLeft: {
    alignSelf: 'flex-start',
  },
  rowRight: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  driverBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F7',
    borderBottomLeftRadius: 4,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginHorizontal: 8,
  },
  userAvatar: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  driverText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F2F2F7',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
  },
  securityMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7F3FF',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  securityMessageText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#004085',
    lineHeight: 18,
  },
  quickRepliesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  quickReply: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  quickReplyText: {
    fontSize: 14,
    color: '#007AFF',
  },
});
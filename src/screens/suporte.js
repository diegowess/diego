import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
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
import { USER_DATA_KEY } from './perfil';

const SuporteScreen = ({ navigation }) => {
    const [activeTab, setActiveTab] = useState('meus-tickets');
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Estados para tickets
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [ticketMessages, setTicketMessages] = useState([]);
    
    // Estados para novo ticket
    const [showNewTicketModal, setShowNewTicketModal] = useState(false);
    const [categorias, setCategorias] = useState([]);
    const [novaMensagem, setNovaMensagem] = useState('');
    
    // Formulário novo ticket
    const [assunto, setAssunto] = useState('');
    const [descricao, setDescricao] = useState('');
    const [categoriaId, setCategoriaId] = useState('');
    const [prioridade, setPrioridade] = useState('media');
    
    // Carregar dados do usuário
    useEffect(() => {
        loadUserData();
    }, []);
    
    const loadUserData = async () => {
        try {
            const storedUser = await AsyncStorage.getItem(USER_DATA_KEY);
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                setUser(userData);
                
                // Carregar categorias e tickets
                await Promise.all([
                    loadCategorias(),
                    loadTickets(userData.id)
                ]);
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const loadCategorias = async () => {
        try {
            const response = await fetch('https://beepapps.cloud/appmotorista/get_support_categories.php');
            const result = await response.json();
            
            if (result.success) {
                setCategorias(result.categorias);
                if (result.categorias.length > 0) {
                    setCategoriaId(result.categorias[0].id);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
        }
    };
    
    const loadTickets = async (userId) => {
        try {
            const response = await fetch('https://beepapps.cloud/appmotorista/get_user_tickets.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ user_id: userId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                setTickets(result.tickets);
            }
        } catch (error) {
            console.error('Erro ao carregar tickets:', error);
        }
    };
    
    const loadTicketMessages = async (ticketId) => {
        try {
            const response = await fetch('https://beepapps.cloud/appmotorista/get_ticket_messages.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ticket_id: ticketId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                setTicketMessages(result.mensagens);
                setSelectedTicket(ticketId);
            }
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error);
        }
    };
    
    const handleCreateTicket = async () => {
        if (!assunto.trim() || !descricao.trim() || !categoriaId) {
            Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
            return;
        }
        
        setIsLoading(true);
        try {
            const response = await fetch('https://beepapps.cloud/appmotorista/create_ticket.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.id,
                    categoria_id: categoriaId,
                    assunto: assunto.trim(),
                    descricao: descricao.trim(),
                    prioridade: prioridade
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                Alert.alert('Sucesso', 'Ticket criado com sucesso!');
                setShowNewTicketModal(false);
                setAssunto('');
                setDescricao('');
                await loadTickets(user.id);
            } else {
                Alert.alert('Erro', result.message || 'Falha ao criar ticket');
            }
        } catch (error) {
            console.error('Erro ao criar ticket:', error);
            Alert.alert('Erro', 'Falha na conexão');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSendMessage = async () => {
        if (!novaMensagem.trim() || !selectedTicket) return;
        
        try {
            const response = await fetch('https://beepapps.cloud/appmotorista/send_message.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ticket_id: selectedTicket,
                    user_id: user.id,
                    mensagem: novaMensagem.trim()
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                setNovaMensagem('');
                await loadTicketMessages(selectedTicket);
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    };
    
    const getStatusColor = (status) => {
        switch (status) {
            case 'aberto': return '#4CAF50';
            case 'em_andamento': return '#FF9800';
            case 'resolvido': return '#2196F3';
            case 'fechado': return '#9E9E9E';
            default: return '#666';
        }
    };
    
    const getStatusText = (status) => {
        switch (status) {
            case 'aberto': return 'Aberto';
            case 'em_andamento': return 'Em Andamento';
            case 'resolvido': return 'Resolvido';
            case 'fechado': return 'Fechado';
            default: return status;
        }
    };
    
    const getPriorityColor = (prioridade) => {
        switch (prioridade) {
            case 'urgente': return '#F44336';
            case 'alta': return '#FF9800';
            case 'media': return '#2196F3';
            case 'baixa': return '#4CAF50';
            default: return '#666';
        }
    };
    
    const getPriorityText = (prioridade) => {
        switch (prioridade) {
            case 'urgente': return 'Urgente';
            case 'alta': return 'Alta';
            case 'media': return 'Média';
            case 'baixa': return 'Baixa';
            default: return prioridade;
        }
    };
    
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR').substring(0, 5);
    };
    
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        if (user) {
            await loadTickets(user.id);
        }
        setRefreshing(false);
    }, [user]);
    
    if (isLoading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#000" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#000" />
                    <Text style={styles.loadingText}>Carregando...</Text>
                </View>
            </SafeAreaView>
        );
    }
    
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                
                <Text style={styles.headerTitle}>Suporte</Text>
                
                <TouchableOpacity 
                    style={styles.newTicketButton}
                    onPress={() => setShowNewTicketModal(true)}
                >
                    <Icon name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
            
            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'meus-tickets' && styles.activeTab]}
                    onPress={() => setActiveTab('meus-tickets')}
                >
                    <Text style={[styles.tabText, activeTab === 'meus-tickets' && styles.activeTabText]}>
                        Meus Tickets
                    </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'faq' && styles.activeTab]}
                    onPress={() => setActiveTab('faq')}
                >
                    <Text style={[styles.tabText, activeTab === 'faq' && styles.activeTabText]}>
                        FAQ
                    </Text>
                </TouchableOpacity>
            </View>
            
            {activeTab === 'meus-tickets' ? (
                <View style={styles.content}>
                    {selectedTicket ? (
                        // Visualização do ticket
                        <KeyboardAvoidingView 
                            style={{ flex: 1 }}
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        >
                            <View style={styles.ticketHeader}>
                                <TouchableOpacity 
                                    style={styles.backToTickets}
                                    onPress={() => setSelectedTicket(null)}
                                >
                                    <Icon name="arrow-back" size={20} color="#000" />
                                    <Text style={styles.backToTicketsText}>Voltar para tickets</Text>
                                </TouchableOpacity>
                            </View>
                            
                            <ScrollView style={styles.messagesContainer}>
                                {ticketMessages.map((msg, index) => (
                                    <View 
                                        key={index}
                                        style={[
                                            styles.messageBubble,
                                            msg.tipo === 'user' ? styles.userMessage : styles.adminMessage
                                        ]}
                                    >
                                        <View style={styles.messageHeader}>
                                            <Text style={styles.messageSender}>
                                                {msg.tipo === 'user' ? 'Você' : 'Suporte'}
                                            </Text>
                                            <Text style={styles.messageTime}>
                                                {formatDate(msg.created_at)}
                                            </Text>
                                        </View>
                                        <Text style={[
                                            styles.messageText,
                                            msg.tipo === 'user' ? styles.userMessageText : styles.adminMessageText
                                        ]}>
                                            {msg.mensagem}
                                        </Text>
                                        
                                        {msg.anexo_url && (
                                            <TouchableOpacity style={[
                                                styles.attachmentButton,
                                                msg.tipo === 'user' ? styles.userAttachmentButton : styles.adminAttachmentButton
                                            ]}>
                                                <Icon name="attach-file" size={16} color={msg.tipo === 'user' ? "#fff" : "#666"} />
                                                <Text style={[
                                                    styles.attachmentText,
                                                    msg.tipo === 'user' ? styles.userAttachmentText : styles.adminAttachmentText
                                                ]}>
                                                    Anexo
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </ScrollView>
                            
                            {/* Input para nova mensagem */}
                            <View style={styles.messageInputContainer}>
                                <TextInput
                                    style={styles.messageInput}
                                    placeholder="Digite sua mensagem..."
                                    placeholderTextColor="#999"
                                    value={novaMensagem}
                                    onChangeText={setNovaMensagem}
                                    multiline
                                />
                                <TouchableOpacity 
                                    style={styles.sendButton}
                                    onPress={handleSendMessage}
                                    disabled={!novaMensagem.trim()}
                                >
                                    <Icon 
                                        name="send" 
                                        size={24} 
                                        color={novaMensagem.trim() ? "#000" : "#ccc"} 
                                    />
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    ) : (
                        // Lista de tickets
                        <FlatList
                            data={tickets}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={styles.ticketCard}
                                    onPress={() => loadTicketMessages(item.id)}
                                >
                                    <View style={styles.ticketHeaderRow}>
                                        <View style={styles.ticketInfo}>
                                            <Text style={styles.ticketId}>#{item.ticket_id}</Text>
                                            <Text style={styles.ticketAssunto} numberOfLines={1}>
                                                {item.assunto}
                                            </Text>
                                        </View>
                                        <View style={styles.ticketStatusContainer}>
                                            <View style={[
                                                styles.statusBadge,
                                                { backgroundColor: getStatusColor(item.status) }
                                            ]}>
                                                <Text style={styles.statusText}>
                                                    {getStatusText(item.status)}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    
                                    <View style={styles.ticketDetails}>
                                        <View style={styles.detailRow}>
                                            <Icon name="category" size={14} color="#666" />
                                            <Text style={styles.detailText}>{item.categoria_nome}</Text>
                                        </View>
                                        
                                        <View style={styles.detailRow}>
                                            <Icon name="priority-high" size={14} color="#666" />
                                            <Text style={[
                                                styles.detailText,
                                                { color: getPriorityColor(item.prioridade) }
                                            ]}>
                                                {getPriorityText(item.prioridade)}
                                            </Text>
                                        </View>
                                        
                                        <View style={styles.detailRow}>
                                            <Icon name="access-time" size={14} color="#666" />
                                            <Text style={styles.detailText}>
                                                {formatDate(item.created_at)}
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    {item.novas_respostas > 0 && (
                                        <View style={styles.newMessagesBadge}>
                                            <Text style={styles.newMessagesText}>
                                                {item.novas_respostas} nova{item.novas_respostas > 1 ? 's' : ''}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}
                            keyExtractor={(item) => item.id.toString()}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Icon name="support-agent" size={60} color="#ccc" />
                                    <Text style={styles.emptyText}>Nenhum ticket encontrado</Text>
                                    <Text style={styles.emptySubtext}>
                                        Crie seu primeiro ticket de suporte
                                    </Text>
                                </View>
                            }
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    colors={['#000']}
                                    tintColor="#000"
                                />
                            }
                            contentContainerStyle={styles.ticketsList}
                        />
                    )}
                </View>
            ) : (
                // FAQ Section
                <ScrollView style={styles.faqContainer}>
                    <View style={styles.faqSection}>
                        <Text style={styles.faqTitle}>Perguntas Frequentes</Text>
                        
                        <TouchableOpacity style={styles.faqItem}>
                            <View style={styles.faqQuestion}>
                                <Text style={styles.faqQuestionText}>
                                    Como atualizar meus dados cadastrais?
                                </Text>
                                <Icon name="keyboard-arrow-down" size={24} color="#666" />
                            </View>
                            <Text style={styles.faqAnswer}>
                                Acesse a tela de Perfil e clique no ícone de edição. 
                                Após fazer as alterações, clique em "Salvar Alterações".
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.faqItem}>
                            <View style={styles.faqQuestion}>
                                <Text style={styles.faqQuestionText}>
                                    Como solicitar um saque?
                                </Text>
                                <Icon name="keyboard-arrow-down" size={24} color="#666" />
                            </View>
                            <Text style={styles.faqAnswer}>
                                Vá para a seção "Carteira" no seu perfil e clique em "Solicitar Saque". 
                                O valor mínimo para saque é R$ 20,00.
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.faqItem}>
                            <View style={styles.faqQuestion}>
                                <Text style={styles.faqQuestionText}>
                                    Problemas para aceitar corridas
                                </Text>
                                <Icon name="keyboard-arrow-down" size={24} color="#666" />
                            </View>
                            <Text style={styles.faqAnswer}>
                                Verifique sua conexão com a internet e se o GPS está ativado. 
                                Se o problema persistir, reinicie o aplicativo.
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.faqItem}>
                            <View style={styles.faqQuestion}>
                                <Text style={styles.faqQuestionText}>
                                    Como alterar minha senha?
                                </Text>
                                <Icon name="keyboard-arrow-down" size={24} color="#666" />
                            </View>
                            <Text style={styles.faqAnswer}>
                                Na tela de Perfil, clique em "Alterar Senha" e preencha os campos solicitados.
                            </Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.contactInfo}>
                        <Text style={styles.contactTitle}>Contato Direto</Text>
                        <View style={styles.contactItem}>
                            <Icon name="email" size={20} color="#000" />
                            <Text style={styles.contactText}>suporte@beepapps.cloud</Text>
                        </View>
                        <View style={styles.contactItem}>
                            <Icon name="phone" size={20} color="#000" />
                            <Text style={styles.contactText}>(11) 99999-9999</Text>
                        </View>
                        <View style={styles.contactItem}>
                            <Icon name="access-time" size={20} color="#000" />
                            <Text style={styles.contactText}>Segunda a Sexta, 9h às 18h</Text>
                        </View>
                    </View>
                </ScrollView>
            )}
            
            {/* Modal para novo ticket */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showNewTicketModal}
                onRequestClose={() => setShowNewTicketModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Novo Ticket</Text>
                            <TouchableOpacity 
                                onPress={() => setShowNewTicketModal(false)}
                                style={styles.modalCloseButton}
                            >
                                <Icon name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Assunto *</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="Descreva brevemente o problema"
                                    placeholderTextColor="#999"
                                    value={assunto}
                                    onChangeText={setAssunto}
                                />
                            </View>
                            
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Categoria *</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.categoriesContainer}>
                                        {categorias.map((cat) => (
                                            <TouchableOpacity
                                                key={cat.id}
                                                style={[
                                                    styles.categoryButton,
                                                    categoriaId === cat.id && styles.categoryButtonActive
                                                ]}
                                                onPress={() => setCategoriaId(cat.id)}
                                            >
                                                <Text style={[
                                                    styles.categoryButtonText,
                                                    categoriaId === cat.id && styles.categoryButtonTextActive
                                                ]}>
                                                    {cat.nome}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                            
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Prioridade</Text>
                                <View style={styles.prioritiesContainer}>
                                    {['baixa', 'media', 'alta', 'urgente'].map((prio) => (
                                        <TouchableOpacity
                                            key={prio}
                                            style={[
                                                styles.priorityButton,
                                                prioridade === prio && styles.priorityButtonActive,
                                                { borderColor: getPriorityColor(prio) }
                                            ]}
                                            onPress={() => setPrioridade(prio)}
                                        >
                                            <Text style={[
                                                styles.priorityButtonText,
                                                prioridade === prio && { color: getPriorityColor(prio) }
                                            ]}>
                                                {getPriorityText(prio)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                            
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Descrição *</Text>
                                <TextInput
                                    style={[styles.formInput, styles.textArea]}
                                    placeholder="Descreva detalhadamente o problema..."
                                    placeholderTextColor="#999"
                                    value={descricao}
                                    onChangeText={setDescricao}
                                    multiline
                                    numberOfLines={6}
                                    textAlignVertical="top"
                                />
                            </View>
                            
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Anexos (opcional)</Text>
                                <TouchableOpacity style={styles.uploadButton}>
                                    <Icon name="attach-file" size={20} color="#000" />
                                    <Text style={styles.uploadButtonText}>Anexar arquivo</Text>
                                </TouchableOpacity>
                                <Text style={styles.uploadHint}>
                                    Tipos permitidos: JPG, PNG, PDF, TXT. Máx. 5MB
                                </Text>
                            </View>
                        </ScrollView>
                        
                        <View style={styles.modalFooter}>
                            <TouchableOpacity 
                                style={styles.cancelButton}
                                onPress={() => setShowNewTicketModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={styles.submitButton}
                                onPress={handleCreateTicket}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Enviar Ticket</Text>
                                )}
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
    newTicketButton: {
        padding: 8,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#000',
    },
    tabText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '500',
    },
    activeTabText: {
        color: '#000',
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    ticketsList: {
        padding: 16,
        paddingBottom: 30,
    },
    ticketCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    ticketHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    ticketInfo: {
        flex: 1,
        marginRight: 12,
    },
    ticketId: {
        color: '#666',
        fontSize: 12,
        marginBottom: 4,
    },
    ticketAssunto: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    ticketStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    ticketDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        color: '#666',
        fontSize: 12,
    },
    newMessagesBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    newMessagesText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 20,
    },
    emptyText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
    },
    emptySubtext: {
        color: '#666',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    // Ticket Messages
    ticketHeader: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    backToTickets: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backToTicketsText: {
        color: '#000',
        fontSize: 16,
        marginLeft: 8,
    },
    messagesContainer: {
        flex: 1,
        padding: 16,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
    },
    userMessage: {
        backgroundColor: '#000',
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    adminMessage: {
        backgroundColor: '#f0f0f0',
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    messageSender: {
        color: '#666',
        fontSize: 12,
        fontWeight: 'bold',
    },
    messageTime: {
        color: '#999',
        fontSize: 10,
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20,
    },
    userMessageText: {
        color: '#fff',
    },
    adminMessageText: {
        color: '#000',
    },
    attachmentButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        marginTop: 8,
    },
    userAttachmentButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    adminAttachmentButton: {
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    attachmentText: {
        fontSize: 12,
        marginLeft: 4,
    },
    userAttachmentText: {
        color: '#fff',
    },
    adminAttachmentText: {
        color: '#000',
    },
    messageInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    messageInput: {
        flex: 1,
        backgroundColor: '#f8f8f8',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        maxHeight: 100,
        fontSize: 16,
        color: '#000',
    },
    sendButton: {
        padding: 8,
        marginLeft: 8,
    },
    // FAQ Section
    faqContainer: {
        flex: 1,
        padding: 16,
    },
    faqSection: {
        marginBottom: 24,
    },
    faqTitle: {
        color: '#000',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    faqItem: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    faqQuestion: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    faqQuestionText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
        marginRight: 12,
    },
    faqAnswer: {
        color: '#666',
        fontSize: 14,
        lineHeight: 20,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    contactInfo: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    contactTitle: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    contactText: {
        color: '#000',
        fontSize: 16,
        marginLeft: 12,
    },
    // Modal Styles
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
        maxWidth: 500,
        maxHeight: '80%',
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
        fontSize: 20,
        fontWeight: 'bold',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalBody: {
        flex: 1,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 20,
    },
    formGroup: {
        marginBottom: 20,
    },
    formLabel: {
        color: '#000',
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
    },
    formInput: {
        backgroundColor: '#f8f8f8',
        color: '#000',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        fontSize: 16,
    },
    textArea: {
        minHeight: 120,
        textAlignVertical: 'top',
    },
    categoriesContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    categoryButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#f8f8f8',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    categoryButtonActive: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    categoryButtonText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '500',
    },
    categoryButtonTextActive: {
        color: '#fff',
    },
    prioritiesContainer: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    priorityButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 2,
    },
    priorityButtonActive: {
        backgroundColor: '#f8f8f8',
    },
    priorityButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderStyle: 'dashed',
    },
    uploadButtonText: {
        color: '#000',
        fontSize: 16,
        marginLeft: 8,
    },
    uploadHint: {
        color: '#666',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
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
    submitButton: {
        flex: 1,
        padding: 16,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: '#000',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default SuporteScreen;
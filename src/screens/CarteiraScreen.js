import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuthStore } from '../store/useAuthStore';

const { width } = Dimensions.get('window');

const API_BASE_URL = 'https://beepapps.cloud/appmotorista';

export default function CarteiraScreen({ route }) {
  const navigation = useNavigation();
  const { motoristaId, loadUser } = useAuthStore();
  const [saldo, setSaldo] = useState(0);
  const [historicoSaques, setHistoricoSaques] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalSaqueVisible, setModalSaqueVisible] = useState(false);
  const [valorSaque, setValorSaque] = useState('');
  const [solicitandoSaque, setSolicitandoSaque] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!motoristaId) {
        await loadUser();
      }
      if (motoristaId) {
        carregarDadosCarteira();
      }
    };
    init();
  }, [motoristaId, loadUser]);

  const carregarDadosCarteira = async () => {
    if (!motoristaId) {
      Alert.alert('Erro', 'ID do motorista não encontrado');
      return;
    }

    try {
      setCarregando(true);
      
      // Carregar saldo
      const responseSaldo = await fetch(`${API_BASE_URL}/api_saldo.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          motorista_id: motoristaId,
          action: 'get_saldo'
        }),
      });

      const dataSaldo = await responseSaldo.json();

      if (dataSaldo.success) {
        setSaldo(dataSaldo.saldo);
      }

      // Carregar histórico de saques
      const responseHistorico = await fetch(`${API_BASE_URL}/api_saques.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          motorista_id: motoristaId,
          action: 'get_historico'
        }),
      });

      const dataHistorico = await responseHistorico.json();

      if (dataHistorico.success) {
        setHistoricoSaques(dataHistorico.historico);
      }

    } catch (error) {
      console.error('Erro:', error);
      Alert.alert('Erro', 'Falha na conexão');
    } finally {
      setCarregando(false);
    }
  };

  const solicitarSaque = async () => {
    if (!valorSaque || parseFloat(valorSaque) <= 0) {
      Alert.alert('Erro', 'Digite um valor válido para saque');
      return;
    }

    const valor = parseFloat(valorSaque);
    
    if (valor > saldo) {
      Alert.alert('Erro', 'Saldo insuficiente para este saque');
      return;
    }

    if (valor < 10) {
      Alert.alert('Erro', 'Valor mínimo para saque é R$ 10,00');
      return;
    }

    try {
      setSolicitandoSaque(true);
      
      const response = await fetch(`${API_BASE_URL}/api_saques.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          motorista_id: motoristaId,
          action: 'solicitar_saque',
          valor: valor
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Sucesso', 'Saque solicitado com sucesso!');
        setModalSaqueVisible(false);
        setValorSaque('');
        // Recarregar dados
        carregarDadosCarteira();
      } else {
        Alert.alert('Erro', data.message || 'Erro ao solicitar saque');
      }
    } catch (error) {
      console.error('Erro:', error);
      Alert.alert('Erro', 'Falha na conexão');
    } finally {
      setSolicitandoSaque(false);
    }
  };

  const formatarData = (dataString) => {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'aprovado': return '#4CAF50';
      case 'pendente': return '#FF9800';
      case 'recusado': return '#F44336';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'aprovado': return 'Aprovado';
      case 'pendente': return 'Pendente';
      case 'recusado': return 'Recusado';
      default: return status;
    }
  };

  if (carregando) {
    return (
      <View style={styles.carregandoContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.carregandoText}>Carregando carteira...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Minha Carteira</Text>
        <View style={styles.headerActions}>
          
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Inicio')}>
            <Icon name="home" size={20} color="#000" />
            <Text style={styles.headerButtonText}>Início</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Card de Saldo */}
        <View style={styles.saldoContainer}>
          <View style={styles.saldoCard}>
            <Icon name="account-balance-wallet" size={40} color="#4CAF50" />
            <Text style={styles.saldoLabel}>Saldo Disponível</Text>
            <Text style={styles.saldoValor}>R$ {saldo.toFixed(2)}</Text>
            <TouchableOpacity 
              style={styles.botaoSaque}
              onPress={() => setModalSaqueVisible(true)}
              disabled={saldo < 10}
            >
              <Text style={[
                styles.botaoSaqueText,
                saldo < 10 && styles.botaoSaqueTextDisabled
              ]}>
                {saldo < 10 ? 'Saldo Mínimo: R$ 10,00' : 'Solicitar Saque'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Histórico de Saques */}
        <View style={styles.historicoContainer}>
          <Text style={styles.historicoTitulo}>Histórico de Saques</Text>
          
          {historicoSaques.length === 0 ? (
            <View style={styles.semDadosContainer}>
              <Icon name="history" size={50} color="#CCC" />
              <Text style={styles.semDadosText}>Nenhum saque realizado</Text>
            </View>
          ) : (
            historicoSaques.map((saque, index) => (
              <View key={index} style={styles.saqueItem}>
                <View style={styles.saqueInfo}>
                  <Text style={styles.saqueValor}>R$ {parseFloat(saque.valor).toFixed(2)}</Text>
                  <Text style={styles.saqueData}>{formatarData(saque.solicitado_em)}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(saque.status) + '20' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: getStatusColor(saque.status) }
                  ]}>
                    {getStatusText(saque.status)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal de Saque */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalSaqueVisible}
        onRequestClose={() => setModalSaqueVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Solicitar Saque</Text>
            
            <Text style={styles.modalLabel}>Valor disponível: R$ {saldo.toFixed(2)}</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Digite o valor do saque"
              keyboardType="numeric"
              value={valorSaque}
              onChangeText={setValorSaque}
            />
            
            <Text style={styles.modalInfo}>
              Valor mínimo: R$ 10,00
            </Text>

            <View style={styles.modalBotoes}>
              <TouchableOpacity 
                style={[styles.modalBotao, styles.modalBotaoCancelar]}
                onPress={() => setModalSaqueVisible(false)}
              >
                <Text style={styles.modalBotaoTextoCancelar}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBotao, styles.modalBotaoConfirmar]}
                onPress={solicitarSaque}
                disabled={solicitandoSaque}
              >
                {solicitandoSaque ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalBotaoTextoConfirmar}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  headerButtonText: {
    marginLeft: 6,
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  saldoContainer: {
    padding: 20,
  },
  saldoCard: {
    backgroundColor: '#F8F8F8',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saldoLabel: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
  },
  saldoValor: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  botaoSaque: {
    backgroundColor: '#000',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  botaoSaqueText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  botaoSaqueTextDisabled: {
    color: '#999',
  },
  historicoContainer: {
    padding: 20,
  },
  historicoTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  saqueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  saqueInfo: {
    flex: 1,
  },
  saqueValor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  saqueData: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  carregandoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carregandoText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  semDadosContainer: {
    alignItems: 'center',
    padding: 40,
  },
  semDadosText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 25,
    width: width - 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  modalInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  modalBotoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalBotao: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  modalBotaoCancelar: {
    backgroundColor: '#F0F0F0',
  },
  modalBotaoConfirmar: {
    backgroundColor: '#000',
  },
  modalBotaoTextoCancelar: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBotaoTextoConfirmar: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
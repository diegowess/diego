import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');
const API_BASE_URL = 'https://beepapps.cloud/appmotorista';

const periodos = [
  { id: 'diario', label: 'Hoje' },
  { id: 'semanal', label: 'Semana' },
  { id: 'mensal', label: 'Mês' },
];

export default function GanhosScreen({ route }) {
  const navigation = useNavigation();
  const [periodo, setPeriodo] = useState('diario');
  const [dados, setDados] = useState({
    total: 'R$ 0,00',
    corridas: 0,
    tempoOnline: '0h 0m',
    avaliacao: '0.0',
    ganhoPorHora: 'R$ 0,00',
    grafico: {
      labels: [],
      datasets: [{ data: [] }]
    }
  });
  const [carregando, setCarregando] = useState(true);
  const motoristaId = route.params?.motoristaId;

  useEffect(() => {
    carregarGanhos();
  }, [periodo, motoristaId]);

  const carregarGanhos = async () => {
    if (!motoristaId) {
      Alert.alert('Erro', 'ID do motorista não encontrado');
      return;
    }

    try {
      setCarregando(true);
      const response = await fetch(`${API_BASE_URL}/api_ganhos.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          motorista_id: motoristaId,
          periodo: periodo
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Calcular média por corrida
      const totalNumerico = parseFloat(data.total?.replace('R$', '').replace('.', '').replace(',', '.')) || 0;
      const corridas = data.corridas || 0;
      const mediaPorCorrida = corridas > 0 ? totalNumerico / corridas : 0;

      // Garantir que os dados estejam no formato esperado
      const dadosFormatados = {
        total: data.total || 'R$ 0,00',
        corridas: corridas,
        tempoOnline: data.tempo_online || '0h 0m',
        avaliacao: data.avaliacao || '0.0',
        ganhoPorHora: data.ganho_por_hora || 'R$ 0,00',
        mediaPorCorrida: `R$ ${mediaPorCorrida.toFixed(2).replace('.', ',')}`,
        grafico: {
          labels: Array.isArray(data.grafico?.labels) ? data.grafico.labels : [],
          datasets: Array.isArray(data.grafico?.datasets) 
            ? data.grafico.datasets 
            : [{ data: [] }]
        }
      };

      setDados(dadosFormatados);
    } catch (error) {
      console.error('Erro ao carregar ganhos:', error);
      
      // Definir dados padrão em caso de erro
      setDados({
        total: 'R$ 0,00',
        corridas: 0,
        tempoOnline: '0h 0m',
        avaliacao: '0.0',
        ganhoPorHora: 'R$ 0,00',
        mediaPorCorrida: 'R$ 0,00',
        grafico: {
          labels: [],
          datasets: [{ data: [] }]
        }
      });
      
      Alert.alert('Erro', 'Não foi possível carregar os dados de ganhos. Verifique sua conexão e tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  // Dados mockados para atividade recente
  const atividadeRecente = [
    { id: 1, numero: 1001, horario: 'Hoje, 14:35', duracao: '12 min', valor: 'R$ 15,01' },
    { id: 2, numero: 1002, horario: 'Hoje, 15:20', duracao: '8 min', valor: 'R$ 12,50' },
    { id: 3, numero: 1003, horario: 'Hoje, 16:15', duracao: '15 min', valor: 'R$ 18,75' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ganhos</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Card Principal de Ganhos */}
        <LinearGradient
          colors={['#000', '#1a1a1a']}
          style={styles.mainCard}
        >
          <Text style={styles.balanceLabel}>Total ganho</Text>
          <Text style={styles.balanceValue}>{dados.total}</Text>
          
          <View style={styles.periodoContainer}>
            {periodos.map((item) => (
              <TouchableOpacity 
                key={item.id}
                style={[
                  styles.periodoButton, 
                  periodo === item.id && styles.periodoButtonActive
                ]}
                onPress={() => setPeriodo(item.id)}
              >
                <Text style={[
                  styles.periodoText, 
                  periodo === item.id && styles.periodoTextActive
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{dados.corridas}</Text>
              <Text style={styles.statLabel}>Corridas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{dados.mediaPorCorrida}</Text>
              <Text style={styles.statLabel}>Média/Corrida</Text>
            </View>
          </View>
        </LinearGradient>

        {carregando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.loadingText}>Carregando seus ganhos...</Text>
          </View>
        ) : (
          <>
            {/* Gráfico */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Seus ganhos</Text>
                <TouchableOpacity style={styles.chartAction}>
                  <Text style={styles.chartActionText}>Ver detalhes</Text>
                  <Icon name="chevron-right" size={16} color="#000" />
                </TouchableOpacity>
              </View>
              
              {dados?.grafico?.datasets?.[0]?.data?.length > 0 ? (
                <LineChart
                  data={{
                    labels: dados.grafico.labels || [],
                    datasets: [{
                      data: dados.grafico.datasets?.[0]?.data || [],
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      strokeWidth: 3
                    }]
                  }}
                  width={width - 40}
                  height={180}
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                    propsForDots: {
                      r: '4',
                      strokeWidth: '2',
                      stroke: '#000',
                    },
                    propsForBackgroundLines: {
                      stroke: '#f0f0f0',
                      strokeWidth: 1,
                    },
                  }}
                  bezier
                  style={styles.chart}
                  withInnerLines={true}
                  withOuterLines={true}
                  withShadow={false}
                  withDots={true}
                  withVerticalLabels={true}
                  withHorizontalLabels={true}
                />
              ) : (
                <View style={styles.noDataContainer}>
                  <Icon name="show-chart" size={50} color="#e0e0e0" />
                  <Text style={styles.noDataText}>Nenhum dado disponível</Text>
                </View>
              )}
            </View>

            {/* Métricas */}
            <View style={styles.metricsCard}>
              <Text style={styles.sectionTitle}>Métricas</Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <View style={styles.metricIcon}>
                    <Icon name="timer" size={20} color="#000" />
                  </View>
                  <View style={styles.metricContent}>
                    <Text style={styles.metricValue}>{dados.tempoOnline}</Text>
                    <Text style={styles.metricLabel}>Tempo online</Text>
                  </View>
                </View>
                
                <View style={styles.metricItem}>
                  <View style={styles.metricIcon}>
                    <Icon name="star" size={20} color="#000" />
                  </View>
                  <View style={styles.metricContent}>
                    <Text style={styles.metricValue}>{dados.avaliacao}</Text>
                    <Text style={styles.metricLabel}>Avaliação</Text>
                  </View>
                </View>
                
                <View style={styles.metricItem}>
                  <View style={styles.metricIcon}>
                    <Icon name="attach-money" size={20} color="#000" />
                  </View>
                  <View style={styles.metricContent}>
                    <Text style={styles.metricValue}>{dados.ganhoPorHora}</Text>
                    <Text style={styles.metricLabel}>Ganho por hora</Text>
                  </View>
                </View>
                
                <View style={styles.metricItem}>
                  <View style={styles.metricIcon}>
                    <Icon name="trending-up" size={20} color="#000" />
                  </View>
                  <View style={styles.metricContent}>
                    <Text style={styles.metricValue}>{dados.corridas}</Text>
                    <Text style={styles.metricLabel}>Total corridas</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Atividade Recente */}
            <View style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <Text style={styles.sectionTitle}>Atividade recente</Text>
                <TouchableOpacity 
                  style={styles.seeAllButton}
                  onPress={() => navigation.navigate('Historico')}
                >
                  <Text style={styles.seeAllText}>Ver tudo</Text>
                </TouchableOpacity>
              </View>
              
              {atividadeRecente.map((item) => (
                <TouchableOpacity key={item.id} style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Icon name="directions-car" size={20} color="#000" />
                  </View>
                  <View style={styles.activityDetails}>
                    <Text style={styles.activityTitle}>Corrida #{item.numero}</Text>
                    <Text style={styles.activityTime}>{item.horario}</Text>
                  </View>
                  <View style={styles.activityRight}>
                    <Text style={styles.activityAmount}>{item.valor}</Text>
                    <Text style={styles.activityDuration}>{item.duracao}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Ações Rápidas */}
            <View style={styles.actionsCard}>
              <Text style={styles.sectionTitle}>Ações rápidas</Text>
              <View style={styles.actionsGrid}>
                <TouchableOpacity style={styles.actionButton}>
                  <View style={styles.actionIcon}>
                    <Icon name="account-balance-wallet" size={24} color="#000" />
                  </View>
                  <Text style={styles.actionText}>Carteira</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton}>
                  <View style={styles.actionIcon}>
                    <Icon name="receipt" size={24} color="#000" />
                  </View>
                  <Text style={styles.actionText}>Extrato</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton}>
                  <View style={styles.actionIcon}>
                    <Icon name="savings" size={24} color="#000" />
                  </View>
                  <Text style={styles.actionText}>Saques</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton}>
                  <View style={styles.actionIcon}>
                    <Icon name="analytics" size={24} color="#000" />
                  </View>
                  <Text style={styles.actionText}>Relatórios</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
        
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#fff',
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
  headerRight: {
    width: 40,
  },
  mainCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  periodoContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    padding: 4,
    marginBottom: 20,
  },
  periodoButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  periodoButtonActive: {
    backgroundColor: '#fff',
  },
  periodoText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  periodoTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingHorizontal: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  chartCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  chartAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartActionText: {
    fontSize: 14,
    color: '#000',
    marginRight: 4,
  },
  chart: {
    borderRadius: 12,
    marginVertical: 8,
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  metricsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  metricContent: {
    flex: 1,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
  },
  recentActivityCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  seeAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 14,
    color: '#666',
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  activityDuration: {
    fontSize: 12,
    color: '#666',
  },
  actionsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  actionText: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
  },
  bottomSpace: {
    height: 20,
  },
});
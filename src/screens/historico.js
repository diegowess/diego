import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const HistoricoScreen = ({ navigation }) => {
  const [historico, setHistorico] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedCorrida, setSelectedCorrida] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user_data');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        fetchHistorico(userData.id);
      } else {
        Alert.alert('Erro', 'Usuário não encontrado');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Falha ao carregar dados do usuário');
      setIsLoading(false);
    }
  };

  const fetchHistorico = async (userId) => {
    try {
      setIsLoading(true);
      
      console.log('Buscando histórico para user ID:', userId);
      
      const response = await fetch('https://beepapps.cloud/appmotorista/get_historico_corridas.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          motorista_id: userId
        })
      });

      const responseText = await response.text();
      console.log('Resposta bruta:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Erro ao parsear JSON:', parseError);
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} - ${result.message || 'Erro desconhecido'}`);
      }

      if (result.success) {
        console.log('Corridas encontradas:', result.total);
        setHistorico(result.historico || []);
      } else {
        Alert.alert('Erro', result.message || 'Falha ao carregar histórico');
        setHistorico([]);
      }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      Alert.alert('Erro', error.message || 'Falha na conexão');
      setHistorico([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (user) {
      await fetchHistorico(user.id);
    }
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Data não informada';
    
    try {
      if (dateString.includes('/')) {
        return dateString;
      }
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '--:--';
    
    if (timeString.includes(':') && timeString.length > 5) {
      return timeString.substring(0, 5);
    }
    
    return timeString;
  };

  const getCoordinatesFromCorrida = (corrida) => {
    let origemCoords = null;
    let destinoCoords = null;

    if (corrida.latitude_ini && corrida.longitude_ini) {
      origemCoords = {
        latitude: parseFloat(corrida.latitude_ini),
        longitude: parseFloat(corrida.longitude_ini)
      };
    }

    if (corrida.latitude_fim && corrida.longitude_fim) {
      destinoCoords = {
        latitude: parseFloat(corrida.latitude_fim),
        longitude: parseFloat(corrida.longitude_fim)
      };
    }

    if (!origemCoords || isNaN(origemCoords.latitude) || isNaN(origemCoords.longitude)) {
      origemCoords = geocodeAddress(corrida.endereco_origem || corrida.endereco);
    }

    if (!destinoCoords || isNaN(destinoCoords.latitude) || isNaN(destinoCoords.longitude)) {
      destinoCoords = geocodeAddress(corrida.endereco_destino || corrida.endereco_fim);
    }

    return { origemCoords, destinoCoords };
  };

  const geocodeAddress = (endereco) => {
    if (!endereco) {
      return { latitude: -5.1983, longitude: -39.29553 };
    }

    const enderecoLower = endereco.toLowerCase();
    
    if (enderecoLower.includes('vila betania') || enderecoLower.includes('manuel martins')) {
      return { latitude: -5.1816, longitude: -39.2844 };
    } else if (enderecoLower.includes('planalto nova pompéia') || enderecoLower.includes('25 de março')) {
      return { latitude: -5.1919, longitude: -39.3011 };
    } else if (enderecoLower.includes('loquinho do amor') || enderecoLower.includes('doutor antônio furtado')) {
      return { latitude: -5.1916, longitude: -39.3076 };
    } else if (enderecoLower.includes('vila sao paulo')) {
      return { latitude: -5.1986, longitude: -39.2817 };
    } else if (enderecoLower.includes('fogão a lenha') || enderecoLower.includes('desembargador américo')) {
      return { latitude: -5.1914, longitude: -39.2957 };
    }
    
    return { latitude: -5.1983, longitude: -39.29553 };
  };

  const showMapDetails = (corrida) => {
    setSelectedCorrida(corrida);
    
    const { origemCoords, destinoCoords } = getCoordinatesFromCorrida(corrida);

    const minLat = Math.min(origemCoords.latitude, destinoCoords.latitude);
    const maxLat = Math.max(origemCoords.latitude, destinoCoords.latitude);
    const minLng = Math.min(origemCoords.longitude, destinoCoords.longitude);
    const maxLng = Math.max(origemCoords.longitude, destinoCoords.longitude);
    
    const region = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.01) + 0.005,
      longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.01) + 0.005,
    };

    setMapRegion(region);
    setRouteCoordinates([origemCoords, destinoCoords]);
  };

  const closeMapDetails = () => {
    setSelectedCorrida(null);
    setMapRegion(null);
    setRouteCoordinates([]);
  };

  const formatCurrency = (value) => {
    if (!value) return 'R$ 0,00';
    
    if (typeof value === 'string' && value.includes('R$')) {
      return value;
    }
    
    const cleanValue = value.toString().replace('R$', '').replace(',', '.').trim();
    const number = parseFloat(cleanValue);
    
    if (isNaN(number)) {
      return 'R$ 0,00';
    }
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(number);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'finalizada':
        return '#3ddc84';
      case 'cancelado':
      case 'cancelada':
        return '#ff4444';
      case 'pendente':
        return '#ffaa00';
      case 'em andamento':
      case 'andamento':
        return '#2196F3';
      default:
        return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'finalizada':
        return 'check-circle';
      case 'cancelado':
      case 'cancelada':
        return 'cancel';
      case 'pendente':
        return 'access-time';
      case 'em andamento':
      case 'andamento':
        return 'directions-car';
      default:
        return 'help';
    }
  };

  const getVehicleIcon = (vehicleType) => {
    if (!vehicleType) return 'directions-car';
    
    const type = vehicleType.toLowerCase();
    if (type.includes('moto')) return 'two-wheeler';
    if (type.includes('van') || type.includes('ônibus') || type.includes('onibus')) return 'airport-shuttle';
    return 'directions-car';
  };

  const renderHeader = () => (
    <View style={styles.headerInfo}>
      <Text style={styles.headerInfoText}>
        {historico.length} corrida{historico.length !== 1 ? 's' : ''}
      </Text>
      <View style={styles.headerDivider} />
    </View>
  );

  const renderCorrida = ({ item, index }) => (
    <TouchableOpacity 
      style={[
        styles.corridaCard,
        index === 0 && styles.firstCard,
        index === historico.length - 1 && styles.lastCard
      ]}
      onPress={() => showMapDetails(item)}
      activeOpacity={0.7}
    >
      <View style={styles.corridaHeader}>
        <View style={styles.corridaInfo}>
          <Text style={styles.corridaData}>
            {formatDate(item.data)} • {formatTime(item.hora)}
          </Text>
          <Text style={styles.corridaRef}>
            #{item.ref}
          </Text>
        </View>
        <View style={[
          styles.statusContainer, 
          { backgroundColor: getStatusColor(item.status) + '20' }
        ]}>
          <Icon 
            name={getStatusIcon(item.status)} 
            size={14} 
            color={getStatusColor(item.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status?.toUpperCase() || 'DESCONHECIDO'}
          </Text>
        </View>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <View style={styles.pointIconStart}>
            <Icon name="location-pin" size={12} color="#3ddc84" />
          </View>
          <Text style={styles.routeText} numberOfLines={2}>
            {item.endereco_origem || item.endereco || 'Origem não informada'}
          </Text>
        </View>
        
        <View style={styles.routeLine} />
        
        <View style={styles.routePoint}>
          <View style={styles.pointIconEnd}>
            <Icon name="flag" size={12} color="#ff4444" />
          </View>
          <Text style={styles.routeText} numberOfLines={2}>
            {item.endereco_destino || item.endereco_fim || 'Destino não informado'}
          </Text>
        </View>
      </View>

      <View style={styles.corridaDetails}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Icon name="person" size={14} color="#888" />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.motorista || 'Motorista não informado'}
            </Text>
          </View>
          
          <View style={styles.detailItem}>
            <Icon name={getVehicleIcon(item.veiculo)} size={14} color="#888" />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.veiculo || 'Veículo não informado'}
            </Text>
          </View>
        </View>
        
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Icon name="speedometer" size={14} color="#888" />
            <Text style={styles.detailText}>
              {item.distancia || item.km || 'N/A'} km
            </Text>
          </View>
          
          <View style={styles.detailItem}>
            <Icon name="access-time" size={14} color="#888" />
            <Text style={styles.detailText}>
              {item.tempo || item.duracao || 'N/A'} min
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Icon name="credit-card" size={14} color="#888" />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.pagamento || 'Não informado'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.corridaFooter}>
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentMethod}>
            {item.pagamento || 'Pagamento não informado'}
          </Text>
          <Text style={[
            styles.paymentStatus,
            { color: item.pago ? '#3ddc84' : '#ffaa00' }
          ]}>
            {item.pago ? '✓ Pago' : '⏳ Pendente'}
          </Text>
        </View>
        <Text style={styles.corridaValue}>
          {formatCurrency(item.valor || item.taxa)}
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.mapButton}
        onPress={() => showMapDetails(item)}
      >
        <Icon name="map" size={16} color="#000" />
        <Text style={styles.mapButtonText}>Ver detalhes no mapa</Text>
        <Icon name="chevron-right" size={16} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderMapModal = () => (
    <Modal
      visible={!!selectedCorrida}
      animationType="slide"
      transparent={true}
      onRequestClose={closeMapDetails}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalhes da Corrida</Text>
            <TouchableOpacity 
              onPress={closeMapDetails}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {selectedCorrida && (
            <View style={styles.modalBody}>
              <View style={styles.corridaSummary}>
                <Text style={styles.summaryText}>
                  {formatDate(selectedCorrida.data)} • {formatTime(selectedCorrida.hora)}
                </Text>
                <Text style={styles.summaryRef}>
                  #{selectedCorrida.ref}
                </Text>
                <View style={[styles.statusContainer, styles.modalStatus]}>
                  <Icon 
                    name={getStatusIcon(selectedCorrida.status)} 
                    size={16} 
                    color={getStatusColor(selectedCorrida.status)} 
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(selectedCorrida.status) }]}>
                    {selectedCorrida.status?.toUpperCase() || 'DESCONHECIDO'}
                  </Text>
                </View>
              </View>

              <View style={styles.mapContainer}>
                {mapRegion && routeCoordinates.length === 2 && (
                  <MapView
                    style={styles.map}
                    region={mapRegion}
                    showsUserLocation={false}
                    showsPointsOfInterest={false}
                    showsTraffic={false}
                  >
                    <Marker
                      coordinate={routeCoordinates[0]}
                      title="Origem"
                      description={selectedCorrida.endereco_origem || selectedCorrida.endereco}
                    >
                      <View style={styles.markerStart}>
                        <Icon name="location-pin" size={16} color="#fff" />
                      </View>
                    </Marker>

                    <Marker
                      coordinate={routeCoordinates[1]}
                      title="Destino"
                      description={selectedCorrida.endereco_destino || selectedCorrida.endereco_fim}
                    >
                      <View style={styles.markerEnd}>
                        <Icon name="flag" size={16} color="#fff" />
                      </View>
                    </Marker>

                    <Polyline
                      coordinates={routeCoordinates}
                      strokeColor="#000"
                      strokeWidth={3}
                    />
                  </MapView>
                )}
              </View>

              <View style={styles.addressDetails}>
                <View style={styles.addressItem}>
                  <View style={[styles.pointIconStart, styles.addressIcon]}>
                    <Icon name="location-pin" size={12} color="#000" />
                  </View>
                  <View style={styles.addressTextContainer}>
                    <Text style={styles.addressLabel}>Origem</Text>
                    <Text style={styles.addressText}>
                      {selectedCorrida.endereco_origem || selectedCorrida.endereco || 'Não informado'}
                    </Text>
                  </View>
                </View>

                <View style={styles.addressItem}>
                  <View style={[styles.pointIconEnd, styles.addressIcon]}>
                    <Icon name="flag" size={12} color="#000" />
                  </View>
                  <View style={styles.addressTextContainer}>
                    <Text style={styles.addressLabel}>Destino</Text>
                    <Text style={styles.addressText}>
                      {selectedCorrida.endereco_destino || selectedCorrida.endereco_fim || 'Não informado'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{selectedCorrida.distancia || selectedCorrida.km || 'N/A'}</Text>
                  <Text style={styles.statLabel}>Distância (km)</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{selectedCorrida.tempo || selectedCorrida.duracao || 'N/A'}</Text>
                  <Text style={styles.statLabel}>Tempo (min)</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatCurrency(selectedCorrida.valor || selectedCorrida.taxa)}</Text>
                  <Text style={styles.statLabel}>Valor</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="history" size={60} color="#666" />
      <Text style={styles.emptyTitle}>Nenhuma corrida encontrada</Text>
      <Text style={styles.emptyText}>
        Suas corridas aparecerão aqui quando você começar a usar o app.
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton}
        onPress={onRefresh}
      >
        <LinearGradient
          colors={['#000', '#333']}
          style={styles.emptyButtonGradient}
        >
          <Text style={styles.emptyButtonText}>Recarregar</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Carregando histórico...</Text>
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
        
        <Text style={styles.headerTitle}>Histórico de Corridas</Text>
        
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={historico}
        renderItem={renderCorrida}
        keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#000']}
            tintColor="#000"
          />
        }
        ListHeaderComponent={historico.length > 0 ? renderHeader : null}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {renderMapModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
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
  listContainer: {
    flexGrow: 1,
  },
  headerInfo: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerInfoText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginTop: 8,
  },
  corridaCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  firstCard: {
    marginTop: 8,
  },
  lastCard: {
    marginBottom: 20,
  },
  corridaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  corridaInfo: {
    flex: 1,
  },
  corridaData: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  corridaRef: {
    color: '#666',
    fontSize: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalStatus: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  routeContainer: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  pointIconStart: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pointIconEnd: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: '#e0e0e0',
    marginLeft: 9,
    marginVertical: 4,
  },
  routeText: {
    color: '#000',
    fontSize: 14,
    flex: 1,
    lineHeight: 18,
  },
  corridaDetails: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  detailText: {
    color: '#666',
    fontSize: 13,
    marginLeft: 6,
    flex: 1,
  },
  corridaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentMethod: {
    color: '#666',
    fontSize: 13,
    marginBottom: 2,
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  corridaValue: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  mapButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
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
    width: '100%',
    maxWidth: 400,
    maxHeight: SCREEN_HEIGHT * 0.8,
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    flex: 1,
  },
  corridaSummary: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryRef: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  mapContainer: {
    height: 200,
  },
  map: {
    flex: 1,
  },
  markerStart: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerEnd: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  addressDetails: {
    padding: 20,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  addressIcon: {
    marginTop: 2,
  },
  addressTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  addressLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  addressText: {
    color: '#000',
    fontSize: 14,
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#666',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f8f8',
  },
  emptyTitle: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default HistoricoScreen;
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';

  const API_BASE_URL = 'https://beepapps.cloud/appmotorista';

  export default function CorridaScreen({ route, navigation }) {
    const mapRef = useRef(null);

    // Usar stores
    const { motoristaId, loadUser } = useAuthStore();
    const { corridaAtual } = useAppStore();
    
    // Usar corrida do store ou route params
    const [corrida, setCorrida] = useState(route?.params?.corrida || corridaAtual || null);
    const [passageiroIdPersist, setPassageiroIdPersist] = useState(null);
    const [loading, setLoading] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [motoristaLocation, setMotoristaLocation] = useState({
      latitude: -23.55052,
      longitude: -46.633308,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });

    // Estados para o modal de avaliação
    const [showAvaliacaoModal, setShowAvaliacaoModal] = useState(false);
    const [avaliacaoNota, setAvaliacaoNota] = useState(0);
    const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const cancelHandledRef = useRef(false);

    const customMapStyle = useMemo(() => ([
      { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
      { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
      { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2d2d2d' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2d2d2d' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#333333' }] },
      { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#404040' }] },
      { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
      { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2d2d2d' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
    ]), []);

    useEffect(() => {
      const init = async () => {
        // Carregar usuário do store se não estiver disponível
        if (!motoristaId) {
          await loadUser();
        }
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = current.coords;
            setMotoristaLocation(prev => ({ ...prev, latitude, longitude }));
          }
        } catch {}
      };
      init();
    }, [motoristaId, loadUser]);

    useEffect(() => {
      const fetchCorridaAtiva = async () => {
        if (!motoristaId) return;
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/api_verificar_corrida_ativa.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motorista_id: motoristaId }),
          });
          const data = await response.json();
          if (data.success && data.corrida_ativa && data.corrida) {
            setCorrida(data.corrida);
          }
        } catch (e) {
          console.log('Erro ao buscar corrida ativa:', e);
        } finally {
          setLoading(false);
        }
      };

      if (!corrida && motoristaId) {
        fetchCorridaAtiva();
      }
    }, [motoristaId]);

    useEffect(() => {
      if (!motoristaId) return;
      const intervalId = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api_verificar_corrida_ativa.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motorista_id: motoristaId }),
          });
          const data = await response.json();
          const statusStr = (data?.corrida?.status || '').toLowerCase();
          const isCanceled =
            statusStr.includes('cancel') ||
            statusStr === 'cancelada' ||
            statusStr === 'cancelado_passageiro' ||
            statusStr === 'cancelado_cliente';
          const inactive = !data?.corrida_ativa;
          if ((isCanceled || inactive) && !cancelHandledRef.current) {
            cancelHandledRef.current = true;
            Alert.alert('Corrida cancelada', 'O passageiro cancelou a corrida.', [
              { text: 'OK', onPress: () => navigation.navigate('Inicio') },
            ]);
          }
        } catch {}
      }, 5000);
      return () => clearInterval(intervalId);
    }, [motoristaId]);

    useEffect(() => {
      if (!corrida) return;
      const idResolvido = (
        corrida?.passageiro?.id ||
        corrida?.cliente_id ||
        corrida?.passageiro_id ||
        corrida?.cpf ||
        corrida?.passageiro?.cpf ||
        corrida?.passageiro_cpf ||
        corrida?.cliente_cpf
      );
      if (idResolvido && !passageiroIdPersist) {
        setPassageiroIdPersist(idResolvido);
      }
    }, [corrida, passageiroIdPersist]);

    useEffect(() => {
      if (!mapRef.current) return;
      const statusAtual = corrida?.status;
      const motoristaCoords = motoristaLocation ? { latitude: motoristaLocation.latitude, longitude: motoristaLocation.longitude } : null;
      const origem = corrida?.origem ? { latitude: corrida.origem.latitude, longitude: corrida.origem.longitude } : null;
      const destino = corrida?.destino ? { latitude: corrida.destino.latitude, longitude: corrida.destino.longitude } : null;
      const pontos = [];
      if (statusAtual === 'em_rota' && motoristaCoords && destino) {
        pontos.push(motoristaCoords, destino);
      } else if (motoristaCoords && origem) {
        pontos.push(motoristaCoords, origem);
      }
      if (pontos.length === 2) {
        try {
          mapRef.current.fitToCoordinates(pontos, {
            edgePadding: { top: 60, right: 40, bottom: 260, left: 40 },
            animated: true,
          });
        } catch {}
      }
    }, [corrida?.status, corrida?.origem?.latitude, corrida?.origem?.longitude, corrida?.destino?.latitude, corrida?.destino?.longitude, motoristaLocation.latitude, motoristaLocation.longitude]);

    const toNumberOrNull = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const haversineKm = (a, b) => {
      if (!a || !b) return null;
      const toRad = (d) => (d * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(b.latitude - a.latitude);
      const dLon = toRad(b.longitude - a.longitude);
      const lat1 = toRad(a.latitude);
      const lat2 = toRad(b.latitude);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.asin(Math.sqrt(h));
      return R * c;
    };

    const origemCoords = corrida?.origem ? { latitude: corrida.origem.latitude, longitude: corrida.origem.longitude } : null;
    const destinoCoords = corrida?.destino ? { latitude: corrida.destino.latitude, longitude: corrida.destino.longitude } : null;

    const distanciaKm = useMemo(() => {
      const dFromServer = toNumberOrNull(corrida?.distancia);
      if (dFromServer) return dFromServer;
      return haversineKm(origemCoords, destinoCoords)?.toFixed(2) ? Number(haversineKm(origemCoords, destinoCoords).toFixed(2)) : null;
    }, [corrida, origemCoords, destinoCoords]);

    const tempoMin = useMemo(() => {
      const tFromServer = toNumberOrNull(corrida?.tempo_estimado);
      if (tFromServer) return Math.round(tFromServer);
      if (!distanciaKm) return null;
      const avgSpeedKmH = 30;
      const minutes = (distanciaKm / avgSpeedKmH) * 60;
      return Math.max(1, Math.round(minutes));
    }, [corrida, distanciaKm]);

    const valorBRL = useMemo(() => {
      const vFromServer = toNumberOrNull(corrida?.valor);
      if (vFromServer) return Number(vFromServer.toFixed(2));
      if (!distanciaKm) return null;
      const base = 5.0;
      const perKm = 2.5;
      const total = base + perKm * distanciaKm;
      return Number(total.toFixed(2));
    }, [corrida, distanciaKm]);

    const decodePolyline = (encoded) => {
      if (!encoded) return [];
      let index = 0, len = encoded.length;
      let lat = 0, lng = 0;
      const coordinates = [];
      while (index < len) {
        let b, shift = 0, result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;

        shift = 0; result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;

        coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
      }
      return coordinates;
    };

    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      || Constants?.expoConfig?.extra?.GOOGLE_MAPS_API_KEY
      || Constants?.manifest?.extra?.GOOGLE_MAPS_API_KEY
      || "AIzaSyCqogzkL4dzoy_PEbVyAOoc_bdR2BrzWeU";

    const fetchSuggestedRoute = async (origin, destination) => {
      try {
        if (!origin || !destination) return;
        if (!GOOGLE_API_KEY) {
          setRouteCoordinates([origin, destination]);
          return;
        }
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes[0]?.overview_polyline?.points) {
          const coords = decodePolyline(data.routes[0].overview_polyline.points);
          setRouteCoordinates(coords);
        } else {
          setRouteCoordinates([origin, destination]);
        }
      } catch (e) {
        setRouteCoordinates([origin, destination]);
      }
    };

    const cancelarCorrida = async () => {
      if (!corrida || !motoristaId) return;
      setCancelling(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api_acao_corrida.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            corrida_id: corrida.id,
            motorista_id: motoristaId,
            acao: 'cancelar',
          }),
        });
        const data = await response.json();
        if (data.success) {
          Alert.alert('Corrida cancelada', 'A corrida foi cancelada com sucesso.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', data.message || 'Não foi possível cancelar a corrida');
        }
      } catch (e) {
        Alert.alert('Erro', 'Falha de comunicação ao cancelar a corrida');
      } finally {
        setCancelling(false);
      }
    };

    const atualizarStatusCorrida = async (novoStatus) => {
      if (!corrida || !motoristaId) return;
      setUpdatingStatus(true);
      try {
        const payload = {
          corrida_id: corrida.id,
          ref_corrida: corrida.ref,
          motorista_id: motoristaId,
          novo_status: novoStatus,
        };
        const response = await fetch(`${API_BASE_URL}/api_atualizar_status_corrida.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (data.success) {
          setCorrida(prev => ({ ...prev, status: novoStatus }));
          Alert.alert('Sucesso', data.message);
          return data;
        } else {
          Alert.alert('Erro', data.message || 'Não foi possível atualizar status da corrida');
          throw new Error(data.message);
        }
      } catch (e) {
        Alert.alert('Erro', 'Falha de comunicação ao atualizar status');
        throw e;
      } finally {
        setUpdatingStatus(false);
      }
    };

    const handleFinalizarCorrida = async () => {
      if (updatingStatus) return;
      
      try {
        setUpdatingStatus(true);
        const resultado = await atualizarStatusCorrida('finalizada');
        
        if (resultado?.corrida) {
          setCorrida(resultado.corrida);
        }
        
        setTimeout(() => {
          setShowAvaliacaoModal(true);
        }, 1000);
        
      } catch (error) {
        console.log('Erro ao finalizar corrida:', error);
      } finally {
        setUpdatingStatus(false);
      }
    };

    const enviarAvaliacao = async () => {
      if (avaliacaoNota === 0) {
          Alert.alert('Avaliação', 'Por favor, selecione uma nota para o passageiro.');
          return;
      }

      if (!corrida?.id || !motoristaId) {
          Alert.alert('Erro', 'Dados da corrida incompletos. Não foi possível enviar a avaliação.');
          return;
      }

      let passageiroId = passageiroIdPersist || null;
      
      if (!passageiroId) {
        if (corrida?.passageiro?.id) {
            passageiroId = corrida.passageiro.id;
        } else if (corrida?.cliente_id) {
            passageiroId = corrida.cliente_id;
        } else if (corrida?.passageiro_id) {
            passageiroId = corrida.passageiro_id;
        } else if (corrida?.cpf) {
            passageiroId = corrida.cpf;
        } else if (corrida?.passageiro?.cpf) {
            passageiroId = corrida.passageiro.cpf;
        } else if (corrida?.passageiro_cpf) {
            passageiroId = corrida.passageiro_cpf;
        } else if (corrida?.cliente_cpf) {
            passageiroId = corrida.cliente_cpf;
        }
        if (passageiroId && !passageiroIdPersist) {
          setPassageiroIdPersist(passageiroId);
        }
      }

      if (!passageiroId) {
          Alert.alert('Erro', 'ID do passageiro não encontrado. Não foi possível enviar a avaliação.');
          return;
      }

      setEnviandoAvaliacao(true);
      try {
          const evaluationPayload = {
              corrida_id: corrida.id,
              motorista_id: motoristaId,
              passageiro_id: passageiroId,
              cliente_id: corrida?.cliente_id || corrida?.passageiro_id || null,
              cpf: corrida?.cpf || corrida?.passageiro?.cpf || (typeof passageiroId === 'string' ? passageiroId : null),
              telefone: corrida?.telefone || corrida?.passageiro?.telefone || null,
              nota: avaliacaoNota,
              comentario: '', 
              ref_corrida: corrida?.ref_corrida || corrida?.ref || String(corrida.id)
          };
          const response = await fetch(`${API_BASE_URL}/api_avaliar_passageiro.php`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(evaluationPayload),
          });

          const data = await response.json();
          
          if (data.success) {
            Alert.alert('Avaliação enviada', 'Obrigado por avaliar o passageiro!');
            setShowAvaliacaoModal(false);
            setAvaliacaoNota(0);
              
            setTimeout(() => {
              navigation.navigate('Inicio');
            }, 1500);
          } else {
              Alert.alert('Erro', data.message || 'Não foi possível enviar a avaliação');
          }
      } catch (e) {
          Alert.alert('Erro', 'Falha de comunicação ao enviar avaliação');
      } finally {
        setEnviandoAvaliacao(false);
      }
    };

    const abrirChat = () => {
      if (!corrida) {
        Alert.alert('Chat indisponível', 'Corrida não encontrada.');
        return;
      }
      const ref_corrida = corrida?.ref_corrida || corrida?.ref || String(corrida?.id || '');
      navigation.navigate('Chat', {
        ref_corrida,
        userType: 'motorista',
        userId: motoristaId,
        otherUserName: passageiroNome,
        driverInfo: { id: motoristaId },
      });
    };

    const abrirRotas = async () => {
      try {
        const statusAtual = corrida?.status;
        const alvo = statusAtual === 'em_rota' ? corrida?.destino : corrida?.origem;
        if (!alvo) {
          Alert.alert('Rota indisponível', statusAtual === 'em_rota' ? 'Destino do passageiro não encontrado.' : 'Origem do passageiro não encontrada.');
          return;
        }
        const destinoLL = `${alvo.latitude},${alvo.longitude}`;
        const motoristaLL = motoristaLocation ? `${motoristaLocation.latitude},${motoristaLocation.longitude}` : null;

        const wazeUrl = `waze://?ll=${destinoLL}&navigate=yes`;
        const canWaze = await Linking.canOpenURL('waze://');
        if (canWaze) {
          Linking.openURL(wazeUrl);
          return;
        }

        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinoLL}${motoristaLL ? `&origin=${motoristaLL}` : ''}&travelmode=driving`;
        Linking.openURL(gmapsUrl);
      } catch (e) {
        Alert.alert('Erro', 'Não foi possível abrir a navegação.');
      }
    };

    useEffect(() => {
      const motoristaCoords = motoristaLocation ? { latitude: motoristaLocation.latitude, longitude: motoristaLocation.longitude } : null;
      const origem = corrida?.origem ? { latitude: corrida.origem.latitude, longitude: corrida.origem.longitude } : null;
      const destino = corrida?.destino ? { latitude: corrida.destino.latitude, longitude: corrida.destino.longitude } : null;
      let from = null;
      let to = null;
      if (corrida?.status === 'finalizada') {
        setRouteCoordinates([]);
        return;
      }
      if (corrida?.status === 'em_rota') {
        from = motoristaCoords; to = destino;
      } else {
        from = motoristaCoords; to = origem;
      }
      if (from && to) {
        fetchSuggestedRoute(from, to);
      } else {
        setRouteCoordinates([]);
      }
    }, [corrida?.status, corrida?.origem?.latitude, corrida?.origem?.longitude, corrida?.destino?.latitude, corrida?.destino?.longitude, motoristaLocation.latitude, motoristaLocation.longitude, GOOGLE_API_KEY]);

    const passageiroNome = corrida?.passageiro?.nome || corrida?.passageiro_nome || 'Passageiro';
    const passageiroRating = corrida?.passageiro?.rating || corrida?.passageiro_rating || null;
    const passageiroInicial = passageiroNome?.charAt(0)?.toUpperCase() || '?';

    if (loading) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Carregando corrida...</Text>
          </View>
        </View>
      );
    }

    if (!corrida) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <View style={styles.errorContainer}>
            <Icon name="error-outline" size={60} color="#666" />
            <Text style={styles.errorText}>Nenhuma corrida ativa</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.retryButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Corrida Ativa</Text>
          
          <View style={styles.headerRight}>
            <View style={styles.pricePill}>
              
              
            </View>
          </View>
        </View>

        {/* Mapa */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={corrida?.origem ? { latitude: corrida.origem.latitude, longitude: corrida.origem.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 } : motoristaLocation}
            showsUserLocation={true}
            showsMyLocationButton={false}
            customMapStyle={customMapStyle}
          >
            {(
              (corrida?.status === 'em_rota' && motoristaLocation)
                ? (
                  <Marker
                    coordinate={{ latitude: motoristaLocation.latitude, longitude: motoristaLocation.longitude }}
                    title="Origem"
                  >
                    <View style={styles.markerOrigem}>
                      <Icon name="location-on" size={25} color="#4CAF50" />
                    </View>
                  </Marker>
                )
                : (corrida?.origem && (
                  <Marker
                    coordinate={{ latitude: corrida.origem.latitude, longitude: corrida.origem.longitude }}
                    title="Origem"
                  >
                    <View style={styles.markerOrigem}>
                      <Icon name="location-on" size={25} color="#4CAF50" />
                    </View>
                  </Marker>
                ))
            )}

            {corrida?.destino && (
              <Marker
                coordinate={{ latitude: corrida.destino.latitude, longitude: corrida.destino.longitude }}
                title="Destino"
              >
                <View style={styles.markerDestino}>
                  <Icon name="location-on" size={25} color="#FF3B30" />
                </View>
              </Marker>
            )}

            {routeCoordinates.length > 0 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#007AFF"
                strokeColors={['#007AFF']}
                strokeWidth={4}
                geodesic={false}
              />
            )}
          </MapView>
        </View>

        {/* Informações da Corrida */}
        <View style={styles.content}>
          <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false}>
            {/* Informações do Passageiro */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Icon name="person-outline" size={20} color="#fff" />
                <Text style={styles.cardTitle}>Passageiro</Text>
              </View>
              
              <View style={styles.passageiroInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{passageiroInicial}</Text>
                </View>
                <View style={styles.passageiroDetails}>
                  <Text style={styles.passageiroNome}>{passageiroNome}</Text>
                  <View style={styles.ratingContainer}>
                    <Icon name="star" size={16} color="#FFD700" />
                    <Text style={styles.ratingText}>
                      {passageiroRating ? passageiroRating.toFixed?.(1) || passageiroRating : 'Novo'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Status e Informações da Corrida */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Icon name="info-outline" size={20} color="#fff" />
                <Text style={styles.cardTitle}>Informações da Corrida</Text>
              </View>
              
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Icon name="attach-money" size={24} color="#4CAF50" />
                  <Text style={styles.infoLabel}>Valor</Text>
                  <Text style={styles.infoValue}>R$ {valorBRL ? valorBRL.toFixed(2) : '--'}</Text>
                </View>
                
                <View style={styles.infoItem}>
                  <Icon name="schedule" size={24} color="#2196F3" />
                  <Text style={styles.infoLabel}>Tempo</Text>
                  <Text style={styles.infoValue}>{tempoMin ? `${tempoMin} min` : '--'}</Text>
                </View>
                
                <View style={styles.infoItem}>
                  <Icon name="place" size={24} color="#FF9800" />
                  <Text style={styles.infoLabel}>Distância</Text>
                  <Text style={styles.infoValue}>{distanciaKm ? `${distanciaKm.toFixed(2)} km` : '--'}</Text>
                </View>
              </View>
            </View>

            {/* Endereços */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Icon name="location-on" size={20} color="#fff" />
                <Text style={styles.cardTitle}>Trajeto</Text>
              </View>
              
              <View style={styles.enderecosContainer}>
                <View style={styles.enderecoItem}>
                  <View style={styles.enderecoIcon}>
                    <View style={styles.pontoVerde} />
                  </View>
                  <View style={styles.enderecoText}>
                    <Text style={styles.enderecoLabel}>Origem</Text>
                    <Text style={styles.enderecoValue}>
                      {corrida?.origem?.endereco || 'Endereço não informado'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.enderecoItem}>
                  <View style={styles.enderecoIcon}>
                    <View style={styles.pontoVermelho} />
                  </View>
                  <View style={styles.enderecoText}>
                    <Text style={styles.enderecoLabel}>Destino</Text>
                    <Text style={styles.enderecoValue}>
                      {corrida?.destino?.endereco || 'Endereço não informado'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* AÇÕES FIXAS NA PARTE INFERIOR */}
          <View style={styles.actionsContainer}>
            {/* Botões superiores: Chat, Rotas, Cancelar */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={abrirChat}
                disabled={!motoristaId || !corrida}
              >
                <Icon name="chat" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Chat</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={abrirRotas}
                disabled={!corrida?.origem}
              >
                <Icon name="navigation" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Rotas</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.dangerButton]}
                onPress={cancelarCorrida}
                disabled={cancelling}
              >
                <Icon name="cancel" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>
                  {cancelling ? '...' : 'Cancelar'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Botão principal: Cheguei / Iniciar / Finalizar */}
            <TouchableOpacity
              style={[styles.primaryButton, updatingStatus && styles.disabledButton]}
              onPress={() => {
                if (updatingStatus) return;
                if (corrida?.status === 'cheguei') {
                  atualizarStatusCorrida('em_rota');
                } else if (corrida?.status === 'em_rota') {
                  handleFinalizarCorrida();
                } else if (corrida?.status === 'finalizada') {
                  // finalizada: sem ação
                } else {
                  atualizarStatusCorrida('cheguei');
                }
              }}
              disabled={updatingStatus || !corrida || corrida?.status === 'finalizada'}
            >
              <LinearGradient
                colors={['#007AFF', '#0056CC']}
                style={styles.primaryButtonGradient}
              >
                {updatingStatus ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon 
                      name={
                        corrida?.status === 'cheguei' ? "play-arrow" :
                        corrida?.status === 'em_rota' ? "check" : "directions-car"
                      } 
                      size={20} 
                      color="#fff" 
                    />
                    <Text style={styles.primaryButtonText}>
                      {updatingStatus
                        ? 'Aguarde...'
                        : (corrida?.status === 'cheguei'
                            ? 'Iniciar Corrida'
                            : (corrida?.status === 'em_rota'
                                ? 'Finalizar Corrida'
                                : (corrida?.status === 'finalizada' ? 'Finalizada' : 'Cheguei')))}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal de Avaliação */}
        {showAvaliacaoModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Avaliar Passageiro</Text>
              <Text style={styles.modalSubtitle}>
                Como foi sua experiência com {passageiroNome}?
              </Text>
              
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setAvaliacaoNota(star)}
                    style={styles.starButton}
                  >
                    <Icon 
                      name={star <= avaliacaoNota ? "star" : "star-border"} 
                      size={48} 
                      color={star <= avaliacaoNota ? "#FFD700" : "#CCCCCC"} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.ratingTextModal}>
                {avaliacaoNota === 0 ? 'Selecione uma nota' : `${avaliacaoNota} estrela${avaliacaoNota !== 1 ? 's' : ''}`}
              </Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => {
                    setShowAvaliacaoModal(false);
                    setAvaliacaoNota(0);
                    setTimeout(() => {
                      navigation.navigate('Inicio');
                    }, 500);
                  }}
                  disabled={enviandoAvaliacao}
                >
                  <Text style={styles.modalButtonTextSecondary}>Pular</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={enviarAvaliacao}
                  disabled={enviandoAvaliacao || avaliacaoNota === 0}
                >
                  <LinearGradient
                    colors={['#007AFF', '#0056CC']}
                    style={styles.modalButtonGradient}
                  >
                    {enviandoAvaliacao ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.modalButtonTextPrimary}>Enviar Avaliação</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
    },
    loadingText: {
      color: '#fff',
      marginTop: 16,
      fontSize: 16,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: '#000',
    },
    errorText: {
      color: '#fff',
      fontSize: 18,
      marginTop: 16,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 20,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: '#007AFF',
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
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    pricePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 6,
    },
    priceText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
  mapContainer: {
      height: '35%',
      width: '100%',
    },
    map: {
      width: '100%',
      height: '100%',
    },
    markerOrigem: {
      backgroundColor: '#FFF',
      padding: 5,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: '#4CAF50',
    },
    markerDestino: {
      backgroundColor: '#FFF',
      padding: 5,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: '#FF3B30',
    },
    content: {
      flex: 1,
      padding: 16,
    },
    scrollContent: {
      flex: 1,
    },
    scrollContentContainer: {
      paddingBottom: 160,
    },
    card: {
      backgroundColor: '#1a1a1a',
      marginBottom: 16,
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    cardTitle: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    passageiroInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#333',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    avatarText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#fff',
    },
    passageiroDetails: {
      flex: 1,
    },
    passageiroNome: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    ratingText: {
      color: '#FFD700',
      fontSize: 14,
      fontWeight: 'bold',
      marginLeft: 4,
    },
    infoGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    infoItem: {
      alignItems: 'center',
      flex: 1,
    },
    infoLabel: {
      color: '#ccc',
      fontSize: 12,
      marginTop: 8,
      marginBottom: 4,
    },
    infoValue: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    enderecosContainer: {
      marginTop: 8,
    },
    enderecoItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    enderecoIcon: {
      marginRight: 15,
      marginTop: 2,
    },
    pontoVerde: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#4CAF50',
    },
    pontoVermelho: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#FF3B30',
    },
    enderecoText: {
      flex: 1,
    },
    enderecoLabel: {
      fontSize: 12,
      color: '#ccc',
      marginBottom: 4,
    },
    enderecoValue: {
      fontSize: 14,
      color: '#fff',
      fontWeight: '500',
      lineHeight: 20,
    },
    actionsContainer: {
      marginTop: 0,
      paddingTop: 12,
      paddingBottom: 20,
      backgroundColor: '#000',
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
      gap: 12,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      gap: 8,
    },
    secondaryButton: {
      backgroundColor: '#333',
    },
    dangerButton: {
      backgroundColor: '#FF3B30',
    },
    actionButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 14,
    },
    primaryButton: {
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#007AFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    primaryButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    disabledButton: {
      opacity: 0.6,
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: '#1a1a1a',
      borderRadius: 20,
      padding: 24,
      margin: 20,
      width: '90%',
      maxWidth: 400,
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: 8,
    },
    modalSubtitle: {
      fontSize: 16,
      color: '#ccc',
      textAlign: 'center',
      marginBottom: 24,
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 20,
    },
    starButton: {
      padding: 10,
    },
    ratingTextModal: {
      fontSize: 16,
      color: '#ccc',
      marginBottom: 16,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      borderRadius: 12,
      overflow: 'hidden',
    },
    modalButtonSecondary: {
      backgroundColor: '#333',
    },
    modalButtonPrimary: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    modalButtonGradient: {
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 12,
    },
    modalButtonTextSecondary: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
      textAlign: 'center',
      paddingVertical: 12,
    },
    modalButtonTextPrimary: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
    },
  });

// src/screens/buscarlocal.js
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GOOGLE_API_KEY = "AIzaSyCqogzkL4dzoy_PEbVyAOoc_bdR2BrzWeU";

const BuscarLocalScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { onLocationSelect } = route.params || {};
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [currentCity, setCurrentCity] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Obter localização do usuário
  const getUserLocation = useCallback(async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let currentLocation = await Location.getCurrentPositionAsync({});
        setUserLocation(currentLocation.coords);
        
        // Obter nome da cidade atual
        const cityName = await getCityName(
          currentLocation.coords.latitude, 
          currentLocation.coords.longitude
        );
        setCurrentCity(cityName);
      }
    } catch (error) {
      console.log('Erro ao obter localização:', error);
    }
  }, []);

  // Obter localização do usuário ao carregar a tela
  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  // Função para obter nome da cidade usando reverse geocoding
  const getCityName = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}&language=pt-BR`
      );
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const addressComponents = data.results[0].address_components;
        let city = '';
        let state = '';
        
        for (let component of addressComponents) {
          if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
            city = component.long_name;
          }
          if (component.types.includes('administrative_area_level_1')) {
            state = component.short_name;
          }
        }
        
        return city && state ? `${city}, ${state}` : 'Localização Atual';
      }
      return 'Localização Atual';
    } catch (error) {
      console.log('Erro ao obter cidade:', error);
      return 'Localização Atual';
    }
  };

  // Buscar locais usando Google Places API - apenas da cidade atual
  const searchLocations = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      // Usar localização do usuário como base para os resultados
      const baseLat = userLocation ? userLocation.latitude : -23.5505;
      const baseLng = userLocation ? userLocation.longitude : -46.6333;
      
      // Buscar com query + nome da cidade para resultados mais precisos
      const searchQueryWithCity = `${query} ${currentCity}`;
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQueryWithCity)}&location=${baseLat},${baseLng}&radius=20000&key=${GOOGLE_API_KEY}&language=pt-BR`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.results) {
        const filteredResults = data.results.slice(0, 10).map(place => ({
          id: place.place_id,
          name: place.name,
          address: place.formatted_address,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
        }));
        
        setSearchResults(filteredResults);
      } else {
        // Se não encontrar resultados, buscar apenas na cidade
        const fallbackResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${baseLat},${baseLng}&radius=30000&key=${GOOGLE_API_KEY}&language=pt-BR`
        );
        
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackData.status === 'OK' && fallbackData.results) {
          const filteredResults = fallbackData.results.slice(0, 8).map(place => ({
            id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
          }));
          
          setSearchResults(filteredResults);
        } else {
          setSearchResults([]);
        }
      }
    } catch (error) {
      console.log('Erro ao buscar locais:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      searchLocations(searchQuery);
    }, 400);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  const handleLocationSelect = (location) => {
    if (onLocationSelect) {
      onLocationSelect(location);
    }
    navigation.goBack();
  };

  const renderLocationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.locationItem}
      onPress={() => handleLocationSelect(item)}
    >
      <View style={styles.locationIcon}>
        <Text style={styles.locationIconText}>📍</Text>
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>{item.name}</Text>
        <Text style={styles.locationAddress} numberOfLines={2}>
          {item.address}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.emptyStateText}>Buscando locais...</Text>
        </View>
      );
    }

    if (searchQuery.length >= 2 && searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>🔍</Text>
          <Text style={styles.emptyStateTitle}>Nenhum local encontrado</Text>
          <Text style={styles.emptyStateText}>
            {currentCity ? `Tente buscar por outro nome em ${currentCity}` : 'Tente buscar por outro nome'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateEmoji}>🔍</Text>
        <Text style={styles.emptyStateTitle}>Encontre seu destino</Text>
        <Text style={styles.emptyStateText}>
          {currentCity 
            ? `Digite o nome de ruas, bairros ou pontos de referência em ${currentCity}`
            : 'Digite o nome de ruas, bairros ou pontos de referência'
          }
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Para onde?</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={`Buscar em ${currentCity || 'sua cidade'}...`}
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
            clearButtonMode="while-editing"
          />
          {isSearching && (
            <ActivityIndicator size="small" color="#4CAF50" style={styles.searchLoading} />
          )}
        </View>
      </View>

      {/* Location Info */}
      {currentCity && (
        <View style={styles.locationInfoHeader}>
          <Text style={styles.locationInfoText}>
            📍 Buscando em: <Text style={styles.locationCity}>{currentCity}</Text>
          </Text>
        </View>
      )}

      {/* Results */}
      <View style={styles.resultsContainer}>
        {searchQuery.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              {searchResults.length > 0 ? 'Resultados da busca' : ''}
            </Text>
            <FlatList
              data={searchResults}
              renderItem={renderLocationItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmptyState}
              contentContainerStyle={styles.listContent}
            />
          </>
        ) : (
          renderEmptyState()
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 24,
    color: '#000',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 25,
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 10,
    fontSize: 16,
    color: '#666',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#000',
  },
  searchLoading: {
    marginLeft: 10,
  },
  locationInfoHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  locationInfoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  locationCity: {
    fontWeight: '600',
    color: '#4CAF50',
  },
  resultsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginHorizontal: 20,
    marginVertical: 15,
  },
  listContent: {
    flexGrow: 1,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    marginTop: 2,
  },
  locationIconText: {
    fontSize: 14,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default BuscarLocalScreen;
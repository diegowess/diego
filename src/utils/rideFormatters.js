/**
 * Funções utilitárias para formatação de dados de corridas
 */

// Extrai coordenada de diferentes formatos
export const extractCoord = (v) => {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(/[^0-9\.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Calcula distância em km entre origem e destino
export const computeDistanceKm = (c) => {
  const o = c?.origem || {};
  const d = c?.destino || {};
  
  const lat1 = extractCoord(o.latitude) ?? extractCoord(o.lat) ?? 
               extractCoord(c.origem_latitude) ?? extractCoord(c.origem_lat) ?? 
               extractCoord(c.origemLat) ?? extractCoord(c.origem_lat);
  
  const lon1 = extractCoord(o.longitude) ?? extractCoord(o.lng) ?? 
               extractCoord(o.lon) ?? extractCoord(c.origem_longitude) ?? 
               extractCoord(c.origem_lng) ?? extractCoord(c.origemLon);
  
  const lat2 = extractCoord(d.latitude) ?? extractCoord(d.lat) ?? 
               extractCoord(c.destino_latitude) ?? extractCoord(c.destino_lat) ?? 
               extractCoord(c.destinoLat);
  
  const lon2 = extractCoord(d.longitude) ?? extractCoord(d.lng) ?? 
               extractCoord(d.lon) ?? extractCoord(c.destino_longitude) ?? 
               extractCoord(c.destino_lng) ?? extractCoord(c.destinoLon);
  
  if ([lat1, lon1, lat2, lon2].some((v) => v == null)) return null;
  
  const toRad = (x) => x * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const cang = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * cang;
  return Number.isFinite(dist) ? dist : null;
};

// Formata valor da corrida
export const formatValorCorrida = (corrida) => {
  if (!corrida) return 'R$ 0,00';
  
  const candidate = corrida?.valor || 
                    corrida?.valor_corrida || 
                    corrida?.preco || 
                    corrida?.price || 
                    corrida?.tarifa || 
                    corrida?.total || 
                    corrida?.total_valor ||
                    corrida?.valor_total;
  
  if (typeof candidate === 'number') {
    return `R$ ${candidate.toFixed(2).replace('.', ',')}`;
  }
  
  if (typeof candidate === 'string') {
    const normalized = candidate.replace(/[^\d,\.-]/g, '').replace(',', '.');
    const val = parseFloat(normalized);
    if (!isNaN(val)) {
      return `R$ ${val.toFixed(2).replace('.', ',')}`;
    }
  }
  
  const distKm = computeDistanceKm(corrida);
  if (distKm !== null) {
    const estimate = 5.50 + (distKm * 2.50);
    return `R$ ${estimate.toFixed(2).replace('.', ',')}`;
  }
  
  return 'R$ 0,00';
};

// Formata distância da corrida
export const formatDistanciaCorrida = (corrida) => {
  if (!corrida) return '0,0 km';
  
  const candidate = corrida?.distancia_km || 
                    corrida?.distancia || 
                    corrida?.km || 
                    corrida?.distance || 
                    corrida?.dist ||
                    corrida?.distancia_total;
  
  if (typeof candidate === 'number') {
    const km = candidate > 100 ? candidate / 1000 : candidate;
    return `${km.toFixed(1).replace('.', ',')} km`;
  }
  
  if (typeof candidate === 'string') {
    const normalized = candidate.toLowerCase();
    if (normalized.includes('km')) return candidate;
    
    const val = parseFloat(normalized.replace(/[^\d,\.]/g, '').replace(',', '.'));
    if (!isNaN(val)) {
      const km = val > 100 ? val / 1000 : val;
      return `${km.toFixed(1).replace('.', ',')} km`;
    }
  }
  
  const distKm = computeDistanceKm(corrida);
  if (distKm !== null) {
    return `${distKm.toFixed(1).replace('.', ',')} km`;
  }
  
  return '0,0 km';
};

// Formata tempo estimado da corrida
export const formatTempoCorrida = (corrida) => {
  if (!corrida) return '0 min';
  
  const candidate = corrida?.tempo || 
                    corrida?.tempo_estimado || 
                    corrida?.duracao || 
                    corrida?.duration || 
                    corrida?.minutos ||
                    corrida?.tempo_total;
  
  if (typeof candidate === 'number') {
    return `${Math.round(candidate)} min`;
  }
  
  if (typeof candidate === 'string') {
    const normalized = candidate.toLowerCase();
    if (normalized.includes('min')) return candidate;
    
    const val = parseFloat(normalized.replace(/[^\d,\.]/g, '').replace(',', '.'));
    if (!isNaN(val)) {
      return `${Math.round(val)} min`;
    }
  }
  
  const distKm = computeDistanceKm(corrida);
  if (distKm !== null) {
    const minutos = Math.max(1, Math.round(distKm * 4));
    return `${minutos} min`;
  }
  
  return '0 min';
};

// Extrai nome do passageiro
export const getPassengerName = (corrida) => {
  if (!corrida) return 'Novo Passageiro';
  
  const name = corrida?.passageiro?.nome || 
               corrida?.passageiro_nome || 
               corrida?.nome_passageiro || 
               corrida?.nome || 
               corrida?.cliente_nome ||
               corrida?.user_name;
  
  if (name) {
    return name.toString().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }
  
  return 'Novo Passageiro';
};

// Extrai rating do passageiro
export const getPassengerRating = (corrida) => {
  if (!corrida) return '4.8';
  
  const rating = corrida?.passageiro?.rating || 
                 corrida?.rating || 
                 corrida?.passageiro_rating || 
                 corrida?.cliente_rating;
  
  if (rating !== undefined && rating !== null) {
    if (typeof rating === 'number') {
      return rating.toFixed(1);
    }
    if (typeof rating === 'string') {
      const num = parseFloat(rating);
      if (!isNaN(num)) {
        return num.toFixed(1);
      }
    }
  }
  
  return '4.8';
};

import { API_ACAO_CORRIDA, API_BASE_URL, API_MOTORISTA_URL } from '../constants/api';

/**
 * Serviço para chamadas de API relacionadas a corridas e motoristas
 */

/**
 * Aceita uma corrida
 * @param {string|number} corridaId - ID da corrida
 * @param {string|number} motoristaId - ID do motorista
 * @returns {Promise<Object>} Resposta da API
 */
export const aceitarCorrida = async (corridaId, motoristaId) => {
  try {
    const response = await fetch(API_ACAO_CORRIDA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        acao: 'aceitar',
        corrida_id: corridaId,
        motorista_id: motoristaId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao aceitar corrida:', error);
    throw error;
  }
};

/**
 * Recusa uma corrida
 * @param {string|number} corridaId - ID da corrida
 * @param {string|number} motoristaId - ID do motorista
 * @returns {Promise<Object>} Resposta da API
 */
export const recusarCorrida = async (corridaId, motoristaId) => {
  try {
    const response = await fetch(API_ACAO_CORRIDA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        acao: 'recusar',
        corrida_id: corridaId,
        motorista_id: motoristaId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao recusar corrida:', error);
    throw error;
  }
};

/**
 * Carrega os ganhos do motorista
 * @param {string|number} motoristaId - ID do motorista
 * @param {string} periodo - Período ('diario', 'semanal', 'mensal')
 * @returns {Promise<number>} Total de ganhos
 */
export const carregarGanhos = async (motoristaId, periodo = 'diario') => {
  try {
    const response = await fetch(`${API_MOTORISTA_URL}/api_ganhos.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        motorista_id: motoristaId,
        periodo: periodo,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const totalRaw = String(data?.total ?? 'R$ 0,00');
    const totalNumerico = Number.parseFloat(
      totalRaw
        .replace('R$', '')
        .trim()
        .replaceAll('.', '')
        .replace(',', '.')
    );

    return Number.isFinite(totalNumerico) ? totalNumerico : 0;
  } catch (error) {
    console.error('Erro ao carregar ganhos:', error);
    return 0;
  }
};

/**
 * Atualiza a localização do motorista na API
 * @param {string|number} motoristaId - ID do motorista
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<Object>} Resposta da API
 */
export const atualizarLocalizacao = async (motoristaId, latitude, longitude) => {
  try {
    const response = await fetch(`${API_MOTORISTA_URL}/atualizarLocalizacao.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        motorista_id: motoristaId,
        latitude: latitude,
        longitude: longitude,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao atualizar localização:', error);
    throw error;
  }
};

/**
 * Verifica corridas ativas
 * @param {string|number} motoristaId - ID do motorista
 * @returns {Promise<Object>} Dados das corridas ativas
 */
export const verificarCorridasAtivas = async (motoristaId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/check_active_rides.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        motorista_id: motoristaId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao verificar corridas ativas:', error);
    throw error;
  }
};

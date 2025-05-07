// Configurações
const MAP_CENTER = [-15.788, -47.879]; // Coordenadas iniciais
const API_ENDPOINT = 'api/last_position.php?deviceId=device01';
const HISTORY_API_ENDPOINT = 'api/history_positions.php?deviceId=device01&filter=';
const UPDATE_INTERVAL = 10000; // 10 segundos

// Elementos da UI
const elements = {
    map: null,
    marker: null,
    updateTime: document.getElementById('update-time'),
    accuracy: document.getElementById('gps-accuracy'),
    status: document.getElementById('connection-status'),
    currentPosition: null,
    historyLayer: null,
    pathLayer: null
};

// Formata data/hora para o fuso de Brasília
function formatarDataBrasilia(timestamp) {
    const options = {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    return new Date(timestamp).toLocaleString('pt-BR', options);
}

// Inicializa o mapa
function initMap() {
    elements.map = L.map('map').setView(MAP_CENTER, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(elements.map);
}

// Atualiza a posição no mapa
function updateMapPosition(data) {
    elements.currentPosition = data;
    const coords = [data.latitude, data.longitude];

    if (!elements.marker) {
        elements.marker = L.marker(coords).addTo(elements.map)
            .bindPopup(`Última atualização: ${formatarDataBrasilia(data.timestamp)}`);
    } else {
        elements.marker
            .setLatLng(coords)
            .setPopupContent(`Última atualização: ${formatarDataBrasilia(data.timestamp)}`);
    }

    elements.map.setView(coords, 17);
}

// Função para calcular distância entre dois pontos em km (fórmula de Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Carrega TODAS as posições do banco de dados
async function loadAllPositions() {
    try {
        const response = await fetch(HISTORY_API_ENDPOINT);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const positions = await response.json();

        // Remove as camadas anteriores
        if (elements.historyLayer) {
            elements.map.removeLayer(elements.historyLayer);
        }
        if (elements.pathLayer) {
            elements.map.removeLayer(elements.pathLayer);
        }

        // Cria uma nova camada para os pontos
        elements.historyLayer = L.layerGroup().addTo(elements.map);

        // Adiciona cada posição ao mapa
        positions.forEach(pos => {
            L.circleMarker([pos.latitude, pos.longitude], {
                radius: 5,
                fillColor: "#FF5722",
                color: "#FFF",
                weight: 1,
                fillOpacity: 0.8
            })
                .bindPopup(`
                <strong>Posição registrada</strong><br>
                Data: ${formatarDataBrasilia(pos.created_at)}<br>
                Lat: ${pos.latitude.toFixed(6)}<br>
                Lon: ${pos.longitude.toFixed(6)}
            `)
                .addTo(elements.historyLayer);
        });

        // Cria uma linha conectando os pontos (caminho percorrido)
        if (positions.length > 1) {
            const latlngs = positions.map(pos => [pos.latitude, pos.longitude]);
            elements.pathLayer = L.polyline(latlngs, {
                color: '#FF5722',
                weight: 3,
                opacity: 0.7,
                lineJoin: 'round'
            }).addTo(elements.map);
        }

        // Ajusta o zoom para mostrar todos os pontos
        if (positions.length > 0) {
            const group = new L.featureGroup(positions.map(pos =>
                L.marker([pos.latitude, pos.longitude])
            ));
            elements.map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }

        // Cálculo da distância total (mesma lógica)
        let totalDistance = 0;
        if (positions.length > 1) {
            for (let i = 1; i < positions.length; i++) {
                const prev = positions[i - 1];
                const curr = positions[i];
                totalDistance += calculateDistance(
                    prev.latitude,
                    prev.longitude,
                    curr.latitude,
                    curr.longitude
                );
            }
        }

        document.getElementById('total-distance').textContent = totalDistance.toFixed(2);


    } catch (error) {
        console.error('Erro ao carregar posições:', error);
    }
}

async function loadHistory(filter) {
    try {
        updateFilterDateDisplay(filter);

        // Limpeza inicial
        if (elements.historyLayer) elements.map.removeLayer(elements.historyLayer);
        if (elements.pathLayer) elements.map.removeLayer(elements.pathLayer);

        // Fetch e tratamento de erro
        const response = await fetch(`${HISTORY_API_ENDPOINT}${filter}`);
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const positions = await response.json();
        if (positions.error) {
            console.error('Erro no servidor:', positions.error);
            return;
        }

        // 1. Filtragem primeiro!
        const filteredPositions = filterRedundantPoints(positions);

        // 2. Cálculo da distância com pontos filtrados
        let totalDistance = 0;
        if (filteredPositions.length > 1) {
            for (let i = 1; i < filteredPositions.length; i++) {
                const prev = filteredPositions[i - 1];
                const curr = filteredPositions[i];
                totalDistance += calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
            }
        }

        // 3. Criação dos elementos do mapa com pontos filtrados
        elements.historyLayer = L.layerGroup().addTo(elements.map);

        filteredPositions.forEach(pos => {
            L.circleMarker([pos.latitude, pos.longitude], {
                radius: 5,
                fillColor: "#FF5722",
                color: "#FFF",
                weight: 1,
                fillOpacity: 0.8
            })
                .bindPopup(`
                <strong>Posição registrada</strong><br>
                Data: ${formatarDataBrasilia(pos.created_at)}<br>
                Lat: ${pos.latitude.toFixed(6)}<br>
                Lon: ${pos.longitude.toFixed(6)}
            `)
                .addTo(elements.historyLayer);
        });

        // 4. Linha do caminho com pontos filtrados
        if (filteredPositions.length > 1) {
            const latlngs = filteredPositions.map(pos => [pos.latitude, pos.longitude]);
            elements.pathLayer = L.polyline(latlngs, {
                color: '#FF5722',
                weight: 3,
                opacity: 0.7,
                lineJoin: 'round'
            }).addTo(elements.map);

            elements.map.fitBounds(elements.pathLayer.getBounds(), { padding: [50, 50] });
        }

        // 5. Atualização da interface
        const distanceElement = document.getElementById('total-distance');
        if (totalDistance < 1) {
            distanceElement.textContent = (totalDistance * 1000).toFixed(0);
            distanceElement.nextSibling.textContent = ' metros';
        } else {
            distanceElement.textContent = totalDistance.toFixed(2);
            distanceElement.nextSibling.textContent = ' km';
        }

    } catch (error) {
        console.error('Falha ao carregar histórico:', error);
        alert('Erro ao carregar histórico. Verifique o console para detalhes.');
    }
}

function filterRedundantPoints(positions, minDistance = 0.02) { // 20 metros
    const filtered = [];
    let lastValidPoint = null;

    positions.forEach((point) => {
        if (!lastValidPoint) {
            filtered.push(point);
            lastValidPoint = point;
            return;
        }

        const distance = calculateDistance(
            lastValidPoint.latitude,
            lastValidPoint.longitude,
            point.latitude,
            point.longitude
        );

        if (distance >= minDistance) {
            filtered.push(point);
            lastValidPoint = point;
        }
    });

    return filtered;
}

// Função auxiliar para exibir a data do filtro
function updateFilterDateDisplay(filter) {
    const now = new Date();
    const filterDateElement = document.getElementById('current-filter-date');

    let filterText = '';
    let filterDate = '';

    switch (filter) {
        case '30min':
            filterText = 'Últimos 30 minutos';
            break;
        case '1h':
            filterText = 'Última hora';
            break;
        case '3h':
            filterText = 'Últimas 3 horas';
            break;
        case 'today':
            const today = new Date(now);
            today.setDate(today.getDate() - 0);
            filterText = 'Dia anterior';
            filterDate = formatDate(today);
            break;
        case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            filterText = 'Dia anterior';
            filterDate = formatDate(yesterday);
            break;
        case '2_days_before':
            const twoDaysBefore = new Date(now);
            twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
            filterText = '2 dias antes';
            filterDate = formatDate(twoDaysBefore);
            break;
        case '3_days_before':
            const threeDaysBefore = new Date(now);
            threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
            filterText = '3 dias antes';
            filterDate = formatDate(threeDaysBefore);
            break;
        case '4_days_before':
            const fourDaysBefore = new Date(now);
            fourDaysBefore.setDate(fourDaysBefore.getDate() - 4);
            filterText = '4 dias antes';
            filterDate = formatDate(fourDaysBefore);
            break;
        case '5_days_before':
            const fiveDaysBefore = new Date(now);
            fiveDaysBefore.setDate(fiveDaysBefore.getDate() - 5);
            filterText = '5 dias antes';
            filterDate = formatDate(fiveDaysBefore);
            break;
        case '6_days_before':
            const sixDaysBefore = new Date(now);
            sixDaysBefore.setDate(sixDaysBefore.getDate() - 6);
            filterText = '6 dias antes';
            filterDate = formatDate(sixDaysBefore);
            break;
        case '7_days_before':
            const sevenDaysBefore = new Date(now);
            sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
            filterText = '7 dias antes';
            filterDate = formatDate(sevenDaysBefore);
            break;
        case 'all':
            filterText = 'Todo o histórico';
            break;
        default:
            filterText = 'Filtro personalizado';
    }

    const displayText = filterDate ? `${filterText} (${filterDate})` : filterText;
    filterDateElement.textContent = displayText;
}


// Função para formatar data como DD/MM/AAAA
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function filterRedundantPoints(positions, minDistance = 0.02) { // 20 metros
    const filtered = [];
    let lastValidPoint = null;

    positions.forEach((point) => {
        if (!lastValidPoint) {
            filtered.push(point);
            lastValidPoint = point;
            return;
        }

        const distance = calculateDistance(
            lastValidPoint.latitude,
            lastValidPoint.longitude,
            point.latitude,
            point.longitude
        );

        if (distance >= minDistance) {
            filtered.push(point);
            lastValidPoint = point;
        }
    });

    return filtered;
}

// Busca os dados da API
async function fetchPosition() {
    try {
        const response = await fetch(`${API_ENDPOINT}&_=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        // Atualiza a UI
        elements.updateTime.textContent = formatarDataBrasilia(data.timestamp);
        elements.accuracy.textContent = data.accuracy ? `${data.accuracy.toFixed(2)} metros` : 'N/A';
        elements.status.textContent = data.status === 'stopped' ? 'inativo' : 'ativo';
        elements.status.className = data.status === 'stopped' ? 'status-offline' : 'status-online';

        updateMapPosition(data);

    } catch (error) {
        console.error('Erro:', error);
        elements.status.textContent = 'offline';
        elements.status.className = 'status-offline';
        elements.updateTime.textContent = 'última tentativa: ' + formatarDataBrasilia(new Date());
    }
}

// Adicione isso no seu script, junto com as outras funções
document.getElementById('info-panel-header').addEventListener('click', function () {
    const panel = document.getElementById('info-panel');
    panel.classList.toggle('collapsed');

    // Redesenha o mapa quando o painel é expandido/recolhido
    setTimeout(() => {
        elements.map.invalidateSize();
    }, 300);
});

// Inicialização - garantir que o painel comece recolhido
window.addEventListener('load', function () {
    document.getElementById('info-panel').classList.add('collapsed');
});

// Evento para carregar histórico quando selecionado
document.getElementById('history-select').addEventListener('change', function () {
    const filter = this.value;
    updateFilterDateDisplay(filter); // Atualiza o display primeiro
    loadHistory(filter); // Depois carrega os dados
});

// Abre Google Maps com a posição atual
document.getElementById('google-maps-btn').addEventListener('click', () => {
    if (elements.currentPosition?.latitude && elements.currentPosition?.longitude) {
        window.open(`https://www.google.com/maps?q=${elements.currentPosition.latitude},${elements.currentPosition.longitude}`, '_blank');
    } else {
        alert('Nenhuma posição válida disponível no momento.');
    }
});

// Inicialização
/*        initMap();
        fetchPosition();
        setInterval(fetchPosition, UPDATE_INTERVAL);
        
        // Carrega todas as posições inicialmente
        loadAllPositions();*/
// Inicialização
initMap();
fetchPosition();
setInterval(fetchPosition, UPDATE_INTERVAL);

// Carrega os últimos 30 minutos inicialmente
loadHistory('30min');
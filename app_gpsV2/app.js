// Configurações
const CONFIG = {
    DEVICE_ID: 'device01',
    UPDATE_INTERVAL: 10000
};

// Banco de dados SQLite
let db;

// Inicializa o banco de dados
async function initDB() {
    db = await window.CapacitorSQLite.createConnection({ 
        database: 'gps_db',
        encrypted: false,
        mode: 'no-encryption',
        version: 1
    });
    
    await db.open();
    
    await db.execute(`
        CREATE TABLE IF NOT EXISTS positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            latitude REAL,
            longitude REAL,
            accuracy REAL,
            status TEXT,
            timestamp TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
    `);
}

// Salva dados localmente
async function savePosition(position) {
    await db.run(
        `INSERT INTO positions 
         (device_id, latitude, longitude, accuracy, status, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            CONFIG.DEVICE_ID,
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
            'active',
            new Date(position.timestamp).toISOString()
        ]
    );
    
    console.log("Dados salvos localmente");
}

// Restante do seu código JavaScript atual...
// (Mantenha todas as funções de UI, startTracking, stopTracking, etc.)
// Apenas substitua a função sendData por esta:

async function sendData(position) {
    try {
        await savePosition(position);
        updateUI(position, true);
        addLog('✅ Dados salvos localmente', 'success');
    } catch (error) {
        updateUI(position, false);
        addLog(`❌ Erro ao salvar: ${error.message}`, 'error');
    }
}
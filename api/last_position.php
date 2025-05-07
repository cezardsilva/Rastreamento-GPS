<?php
// Conexão direta com o banco - sem frescura
$conn = new mysqli('localhost', 'cdsconsu_cds', '@CDias2015', 'cdsconsu_gps_position');

if ($conn->connect_error) {
    die("Erro de conexão: " . $conn->connect_error);
}

// Consulta DIRETA para pegar a ÚLTIMA entrada válida
$sql = "SELECT * FROM gps_positions 
        WHERE device_id = 'device01' 
        AND latitude != 0 
        AND longitude != 0
        ORDER BY created_at DESC 
        LIMIT 1";

$result = $conn->query($sql);

if (!$result || $result->num_rows === 0) {
    // Se não encontrar dados válidos, pega QUALQUER última entrada
    $sql = "SELECT * FROM gps_positions 
            WHERE device_id = 'device01'
            ORDER BY created_at DESC 
            LIMIT 1";
    $result = $conn->query($sql);
}

$data = [
    'latitude' => 0,
    'longitude' => 0,
    'accuracy' => null,
    'status' => 'stopped',
    'timestamp' => date('Y-m-d H:i:s'),
    'created_at' => date('Y-m-d H:i:s') // Adicionado este campo
];

if ($result && $row = $result->fetch_assoc()) {
    $data = [
        'latitude' => (float)$row['latitude'],
        'longitude' => (float)$row['longitude'],
        'accuracy' => $row['accuracy'] ? (float)$row['accuracy'] : null,
        'status' => $row['status'] ?: 'active',
        'timestamp' => $row['created_at'], // Alterado para usar created_at
        'created_at' => $row['created_at'] // Mantido para referência
    ];
}

header('Content-Type: application/json');
echo json_encode($data);
$conn->close();
?>
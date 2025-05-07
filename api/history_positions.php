<?php
header('Content-Type: application/json');

$conn = new mysqli('localhost', 'cdsconsu_cds', '@CDias2015', 'cdsconsu_gps_position');
if ($conn->connect_error) die(json_encode(['error' => "Erro de conexão: " . $conn->connect_error]));

$deviceId = $_GET['deviceId'] ?? 'device01';
$filter = $_GET['filter'] ?? '30min';

$sql = "SELECT latitude, longitude, created_at FROM gps_positions 
        WHERE device_id = ? 
        AND latitude != 0 
        AND longitude != 0";

switch ($filter) {
    case '30min':
        $sql .= " AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)";
        break;
    case '1h':
        $sql .= " AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)";
        break;
    case '3h':
        $sql .= " AND created_at >= DATE_SUB(NOW(), INTERVAL 3 HOUR)";
        break;
    case 'today':
        $sql .= " AND DATE(created_at) = DATE(DATE_SUB(CURDATE(), INTERVAL 0 DAY))";
        break;
    case 'yesterday':
        $sql .= " AND DATE(created_at) = DATE(DATE_SUB(CURDATE(), INTERVAL 1 DAY))";
        break;
    case '2_days_before':
        $sql .= " AND DATE(created_at) = DATE(DATE_SUB(CURDATE(), INTERVAL 2 DAY))";
        break;
    case '3_days_before':
        $sql .= " AND DATE(created_at) = DATE(DATE_SUB(CURDATE(), INTERVAL 3 DAY))";
        break;
    case '4_days_before':
        $sql .= " AND DATE(created_at) = DATE(DATE_SUB(CURDATE(), INTERVAL 4 DAY))";
        break;
    case '5_days_before':
        $sql .= " AND DATE(created_at) = DATE(DATE_SUB(CURDATE(), INTERVAL 5 DAY))";
        break;
    case '6_days_before':
        $sql .= " AND DATE(created_at) = DATE(DATE_SUB(CURDATE(), INTERVAL 6 DAY))";
        break;
    case '7_days_before':
        $sql .= " AND DATE(created_at) = DATE(DATE_SUB(CURDATE(), INTERVAL 7 DAY))";
        break;
    case 'all':
        // Sem filtro de data
        break;
    default:
        die(json_encode(['error' => 'Filtro inválido']));
}

$sql .= " ORDER BY created_at ASC";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $deviceId);
$stmt->execute();
$result = $stmt->get_result();

$positions = [];
while ($row = $result->fetch_assoc()) {
    $positions[] = [
        'latitude' => (float)$row['latitude'],
        'longitude' => (float)$row['longitude'],
        'created_at' => $row['created_at']
    ];
}

echo json_encode($positions);
$conn->close();
?>
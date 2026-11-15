<?php
error_reporting(0);

$host = "localhost";
$user = "root";
$pass = "";
$db   = "db_absen_ambalan";

$conn = new mysqli($host, $user, $pass, $db);

if ($conn->connect_error) {
    header('Content-Type: application/json');
    echo json_encode(["status" => "error", "message" => "Koneksi database gagal: " . $conn->connect_error]);
    exit;
}

$conn->set_charset("utf8mb4");
$action = $_GET['action'] ?? '';

// =========================================================================
// ENDPOINT KHUSUS UNDUH FILE EXCEL (.XLS) LANGSUNG DARI DATABASE MYSQL
// =========================================================================
if ($action === 'export_excel') {
    $pasukan = $_GET['pasukan'] ?? 'SEMUA';
    $status  = $_GET['status'] ?? 'SEMUA';

    $filename = "Laporan_Absen_dan_Surat_Izin_Ambalan_" . date('Y-m-d_H-i') . ".xls";
    header("Content-Type: application/vnd.ms-excel; charset=utf-8");
    header("Content-Disposition: attachment; filename=\"$filename\"");
    header("Pragma: no-cache");
    header("Expires: 0");

    $sql = "SELECT * FROM absensi_pengibaran WHERE 1=1";
    $params = [];
    $types = "";

    if ($pasukan !== 'SEMUA' && !empty($pasukan)) {
        $sql .= " AND pasukan = ?";
        $params[] = $pasukan;
        $types .= "s";
    }
    if ($status !== 'SEMUA' && !empty($status)) {
        $sql .= " AND status_kehadiran = ?";
        $params[] = $status;
        $types .= "s";
    }
    $sql .= " ORDER BY id DESC";

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    echo '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
    echo '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head>';
    echo '<body>';
    echo '<h3>REKAPITULASI ABSENSI PENGIBARAN & SURAT PENGAJUAN IZIN/SAKIT</h3>';
    echo '<p>Dewan Ambalan Pandanaran Srikandi • Dicetak pada: ' . date('d-m-Y H:i') . ' WIB</p>';
    echo '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-family:Arial, sans-serif; font-size:12px;">';
    echo '<thead>
            <tr style="background-color:#DC2626; color:#FFFFFF; font-weight:bold;">
                <th>No</th>
                <th>ID / Kode</th>
                <th>Nama Anggota</th>
                <th>Pasukan</th>
                <th>Tanggal Kegiatan</th>
                <th>Jam Masuk</th>
                <th>Status</th>
                <th>Jenis Pengajuan</th>
                <th>Isi / Alasan Surat Izin</th>
                <th>Info Lokasi / Waktu Kirim</th>
                <th>Lampiran Foto</th>
                <th>Status Verifikasi Giat</th>
            </tr>
          </thead><tbody>';

    $no = 1;
    while ($row = $result->fetch_assoc()) {
        $bgStatus = '#FFFFFF';
        if ($row['status_kehadiran'] === 'Hadir') $bgStatus = '#D1FAE5';
        elseif ($row['status_kehadiran'] === 'Izin') $bgStatus = '#FEF3C7';
        elseif ($row['status_kehadiran'] === 'Sakit') $bgStatus = '#DBEAFE';
        elseif ($row['status_kehadiran'] === 'Alpha') $bgStatus = '#FEE2E2';

        $adaFoto = !empty($row['foto_bukti']) ? 'Terlampir di Sistem' : 'Tidak Ada';

        echo '<tr>';
        echo '<td align="center">' . $no++ . '</td>';
        echo '<td>' . htmlspecialchars($row['id_nis']) . '</td>';
        echo '<td><b>' . htmlspecialchars($row['nama_anggota']) . '</b></td>';
        echo '<td>' . htmlspecialchars($row['pasukan']) . '</td>';
        echo '<td>' . htmlspecialchars($row['tanggal_kegiatan']) . '</td>';
        echo '<td align="center">' . htmlspecialchars($row['jam_hadir']) . '</td>';
        echo '<td align="center" style="background-color:' . $bgStatus . '; font-weight:bold;">' . htmlspecialchars($row['status_kehadiran']) . '</td>';
        echo '<td>' . htmlspecialchars($row['jenis_surat']) . '</td>';
        echo '<td>' . htmlspecialchars($row['keterangan'] ?? '-') . '</td>';
        echo '<td>' . htmlspecialchars($row['koordinat_gps'] ?? '-') . '</td>';
        echo '<td align="center">' . $adaFoto . '</td>';
        echo '<td align="center">' . htmlspecialchars($row['status_verifikasi']) . '</td>';
        echo '</tr>';
    }
    echo '</tbody></table></body></html>';
    $stmt->close();
    $conn->close();
    exit;
}

// =========================================================================
// ENDPOINT JSON API UNTUK DASHBOARD GIAT & DEWAN
// =========================================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$input = json_decode(file_get_contents('php://input'), true) ?? [];

// 1. VALIDASI LOGIN GIAT
if ($action === 'login_giat') {
    $nama = trim($input['nama'] ?? '');
    $pin  = trim($input['pin'] ?? '');
    
    $stmt = $conn->prepare("SELECT id, nama_lengkap, pin_akses FROM giat_whitelist WHERE LOWER(TRIM(nama_lengkap)) = LOWER(?) LIMIT 1");
    $stmt->bind_param("s", $nama);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        if ($row['pin_akses'] === $pin) {
            echo json_encode(["status" => "success", "user" => $row['nama_lengkap']]);
        } else {
            echo json_encode(["status" => "error", "message" => "PIN Keamanan Giat salah!"]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Akses Ditolak! Nama tidak terdaftar dalam 7 nama Giat."]);
    }
    $stmt->close();
}

// 2. SIMPAN ABSENSI HADIR ATAU SURAT PENGAJUAN IZIN / SAKIT
elseif ($action === 'submit_absen') {
    $nama    = trim($input['nama'] ?? '');
    $pasukan = trim($input['pasukan'] ?? '3. Peserta');
    $tanggal = trim($input['tanggal'] ?? date('d M Y'));
    $jam     = trim($input['jam'] ?? '-');
    $status  = trim($input['status'] ?? 'Hadir');
    $ket     = trim($input['keterangan'] ?? '');
    $gps     = trim($input['gps'] ?? '-');
    $foto    = $input['foto'] ?? null;

    if (empty($nama)) {
        echo json_encode(["status" => "error", "message" => "Nama anggota wajib diisi."]);
        exit;
    }

    if (!in_array($status, ['Hadir', 'Izin', 'Sakit', 'Alpha'])) {
        $status = 'Izin';
    }

    $id_nis      = ($status === 'Hadir') ? "DEW-" . rand(100, 999) : "IZN-" . rand(100, 999);
    $jenis_surat = ($status === 'Hadir') ? "Absensi Kamera GPS" : "Surat Pengajuan $status";
    $verifikasi  = ($status === 'Hadir') ? "Disetujui" : "Menunggu";

    $stmt = $conn->prepare("INSERT INTO absensi_pengibaran (nama_anggota, id_nis, pasukan, tanggal_kegiatan, jam_hadir, status_kehadiran, jenis_surat, keterangan, koordinat_gps, foto_bukti, status_verifikasi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssssssssss", $nama, $id_nis, $pasukan, $tanggal, $jam, $status, $jenis_surat, $ket, $gps, $foto, $verifikasi);

    if ($stmt->execute()) {
        echo json_encode([
            "status" => "success",
            "message" => "$jenis_surat atas nama $nama berhasil dikirim ke Database & Dashboard Giat!"
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => "Gagal menyimpan ke database: " . $stmt->error]);
    }
    $stmt->close();
}

// 3. AMBIL SELURUH DATA REKAP & SURAT IZIN UNTUK DASHBOARD GIAT
elseif ($action === 'get_rekap') {
    $pasukan = $_GET['pasukan'] ?? 'SEMUA';
    
    if ($pasukan === 'SEMUA' || empty($pasukan)) {
        $stmt = $conn->prepare("SELECT * FROM absensi_pengibaran ORDER BY id DESC");
    } else {
        $stmt = $conn->prepare("SELECT * FROM absensi_pengibaran WHERE pasukan = ? ORDER BY id DESC");
        $stmt->bind_param("s", $pasukan);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();

    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    echo json_encode(["status" => "success", "data" => $data]);
    $stmt->close();
}

// 4. AMBIL RIWAYAT PRIBADI DEWAN
elseif ($action === 'get_my_history') {
    $nama = trim($_GET['nama'] ?? '');
    $stmt = $conn->prepare("SELECT * FROM absensi_pengibaran WHERE LOWER(TRIM(nama_anggota)) = LOWER(?) ORDER BY id DESC");
    $stmt->bind_param("s", $nama);
    $stmt->execute();
    $result = $stmt->get_result();

    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    echo json_encode(["status" => "success", "data" => $data]);
    $stmt->close();
}

// 5. UPDATE STATUS KEHADIRAN / SETUJUI SURAT IZIN OLEH GIAT
elseif ($action === 'update_status') {
    $id     = intval($input['id'] ?? 0);
    $status = $input['status'] ?? 'Hadir';
    $jam    = ($status === 'Hadir') ? date("H:i") . " WIB" : "-";

    $stmt = $conn->prepare("UPDATE absensi_pengibaran SET status_kehadiran = ?, jam_hadir = ?, status_verifikasi = 'Disetujui' WHERE id = ?");
    $stmt->bind_param("ssi", $status, $jam, $id);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Status diperbarui & diverifikasi Giat."]);
    } else {
        echo json_encode(["status" => "error", "message" => "Gagal memperbarui status."]);
    }
    $stmt->close();
}

$conn->close();
?>

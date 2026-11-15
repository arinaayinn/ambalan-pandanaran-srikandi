<?php
error_reporting(0);
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$host = "localhost";
$user = "root";
$pass = "";
$db   = "db_absen_ambalan";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    header('Content-Type: application/json');
    echo json_encode(["status" => "error", "message" => "Koneksi MySQL Gagal: " . $conn->connect_error]);
    exit;
}
$conn->set_charset("utf8mb4");

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// 1. EKSPOR EXCEL (.XLS)
if ($action === 'export_excel') {
    $pasukan = $_GET['pasukan'] ?? 'SEMUA';
    $status  = $_GET['status'] ?? 'SEMUA';

    header("Content-Type: application/vnd.ms-excel; charset=utf-8");
    header("Content-Disposition: attachment; filename=\"Laporan_Absen_dan_Izin_Ambalan_" . date('Y-m-d_H-i') . ".xls\"");

    $sql = "SELECT * FROM absensi_pengibaran WHERE 1=1";
    $params = [];
    $types = "";

    if ($pasukan !== 'SEMUA' && $pasukan !== '') {
        $sql .= " AND pasukan = ?";
        $params[] = $pasukan;
        $types .= "s";
    }
    if ($status !== 'SEMUA' && $status !== '') {
        $sql .= " AND status_kehadiran = ?";
        $params[] = $status;
        $types .= "s";
    }
    $sql .= " ORDER BY id DESC";

    $stmt = $conn->prepare($sql);
    if (!empty($params)) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $res = $stmt->get_result();

    echo '<table border="1" cellpadding="6" cellspacing="0">
            <tr style="background:#DC2626;color:#FFF;font-weight:bold;">
                <th>No</th><th>Kode</th><th>Nama Anggota</th><th>Pasukan</th>
                <th>Tanggal</th><th>Jam</th><th>Status</th><th>Jenis Pengajuan</th>
                <th>Alasan Surat Izin</th><th>Info/GPS</th><th>Verifikasi</th>
            </tr>';
    $no = 1;
    while ($r = $res->fetch_assoc()) {
        echo "<tr>
                <td>{$no}</td>
                <td>{$r['id_nis']}</td>
                <td><b>" . htmlspecialchars($r['nama_anggota']) . "</b></td>
                <td>" . htmlspecialchars($r['pasukan']) . "</td>
                <td>" . htmlspecialchars($r['tanggal_kegiatan']) . "</td>
                <td>" . htmlspecialchars($r['jam_hadir']) . "</td>
                <td><b>{$r['status_kehadiran']}</b></td>
                <td>" . htmlspecialchars($r['jenis_surat']) . "</td>
                <td>" . htmlspecialchars($r['keterangan'] ?? '-') . "</td>
                <td>" . htmlspecialchars($r['koordinat_gps'] ?? '-') . "</td>
                <td>{$r['status_verifikasi']}</td>
              </tr>";
        $no++;
    }
    echo '</table>';
    exit;
}

header('Content-Type: application/json');
$jsonBody = json_decode(file_get_contents('php://input'), true) ?? [];
$data = !empty($_POST) ? $_POST : $jsonBody;

// 2. LOGIN GIAT
if ($action === 'login_giat') {
    $nama = trim($data['nama'] ?? '');
    $pin  = trim($data['pin'] ?? '');
    $stmt = $conn->prepare("SELECT nama_lengkap, pin_akses FROM giat_whitelist WHERE LOWER(TRIM(nama_lengkap)) = LOWER(?) LIMIT 1");
    $stmt->bind_param("s", $nama);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) {
        if ($row['pin_akses'] === $pin) {
            echo json_encode(["status" => "success", "user" => $row['nama_lengkap']]);
        } else {
            echo json_encode(["status" => "error", "message" => "PIN Giat salah!"]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Nama tidak terdaftar sebagai Giat!"]);
    }
    exit;
}

// 3. SIMPAN ABSENSI HADIR ATAU SURAT IZIN / SAKIT
if ($action === 'submit_absen') {
    $nama    = trim($data['nama'] ?? '');
    $pasukan = trim($data['pasukan'] ?? '3. Peserta');
    $tanggal = trim($data['tanggal'] ?? date('d M Y'));
    $jam     = trim($data['jam'] ?? '-');
    $status  = trim($data['status'] ?? 'Izin');
    $ket     = trim($data['keterangan'] ?? '');
    $gps     = trim($data['gps'] ?? '-');
    $foto    = $data['foto'] ?? null;

    // Jika file gambar diunggah via input file FormData
    if (isset($_FILES['file_surat']) && $_FILES['file_surat']['error'] === UPLOAD_ERR_OK) {
        $tmpName = $_FILES['file_surat']['tmp_name'];
        $mime    = mime_content_type($tmpName) ?: 'image/jpeg';
        $rawImg  = file_get_contents($tmpName);
        $foto    = 'data:' . $mime . ';base64,' . base64_encode($rawImg);
    }

    if ($nama === '') {
        echo json_encode(["status" => "error", "message" => "Nama anggota tidak terbaca. Silakan login ulang."]);
        exit;
    }

    if (!in_array($status, ['Hadir', 'Izin', 'Sakit', 'Alpha'])) $status = 'Izin';

    $id_nis      = ($status === 'Hadir') ? "DEW-" . rand(100, 999) : "IZN-" . rand(100, 999);
    $jenis_surat = ($status === 'Hadir') ? "Absensi Kamera GPS" : "Surat Pengajuan $status";
    $verifikasi  = ($status === 'Hadir') ? "Disetujui" : "Menunggu";

    $stmt = $conn->prepare("INSERT INTO absensi_pengibaran (nama_anggota, id_nis, pasukan, tanggal_kegiatan, jam_hadir, status_kehadiran, jenis_surat, keterangan, koordinat_gps, foto_bukti, status_verifikasi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssssssssss", $nama, $id_nis, $pasukan, $tanggal, $jam, $status, $jenis_surat, $ket, $gps, $foto, $verifikasi);

    if ($stmt->execute()) {
        echo json_encode([
            "status" => "success",
            "message" => "$jenis_surat berhasil masuk ke Database & Dashboard Giat!"
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => "SQL Error: " . $stmt->error]);
    }
    exit;
}

// 4. AMBIL REKAP UNTUK DASHBOARD GIAT
if ($action === 'get_rekap') {
    $pasukan = $_GET['pasukan'] ?? 'SEMUA';
    if ($pasukan === 'SEMUA' || $pasukan === '') {
        $stmt = $conn->prepare("SELECT * FROM absensi_pengibaran ORDER BY id DESC");
    } else {
        $stmt = $conn->prepare("SELECT * FROM absensi_pengibaran WHERE pasukan = ? ORDER BY id DESC");
        $stmt->bind_param("s", $pasukan);
    }
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(["status" => "success", "data" => $rows]);
    exit;
}

// 5. AMBIL RIWAYAT DEWAN
if ($action === 'get_my_history') {
    $nama = trim($_GET['nama'] ?? '');
    $stmt = $conn->prepare("SELECT * FROM absensi_pengibaran WHERE LOWER(TRIM(nama_anggota)) = LOWER(?) ORDER BY id DESC");
    $stmt->bind_param("s", $nama);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(["status" => "success", "data" => $rows]);
    exit;
}

// 6. UPDATE STATUS / SETUJUI SURAT OLEH GIAT
if ($action === 'update_status') {
    $id     = intval($data['id'] ?? 0);
    $status = $data['status'] ?? 'Izin';
    $jam    = ($status === 'Hadir') ? date("H:i") . " WIB" : "-";

    $stmt = $conn->prepare("UPDATE absensi_pengibaran SET status_kehadiran = ?, jam_hadir = ?, status_verifikasi = 'Disetujui' WHERE id = ?");
    $stmt->bind_param("ssi", $status, $jam, $id);
    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Surat / status telah diverifikasi Giat."]);
    } else {
        echo json_encode(["status" => "error", "message" => "Gagal update status."]);
    }
    exit;
}
?>

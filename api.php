<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$host = "localhost";
$user = "root";
$pass = "";
$db   = "db_absen_ambalan";

$conn = new mysqli($host, $user, $pass, $db);

if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "Koneksi database gagal: " . $conn->connect_error]);
    exit;
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

// 1. VALIDASI LOGIN GIAT + PIN KEAMANAN
if ($action === 'login_giat') {
    $nama = trim($input['nama'] ?? '');
    $pin  = trim($input['pin'] ?? '');
    
    $stmt = $conn->prepare("SELECT id, nama_lengkap, pin_akses FROM giat_whitelist WHERE LOWER(TRIM(nama_lengkap)) = LOWER(?) LIMIT 1");
    $stmt->bind_param("s", $nama);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        if ($row['pin_akses'] === $pin) {
            echo json_encode([
                "status" => "success",
                "message" => "Akses Giat Diterima",
                "user" => $row['nama_lengkap']
            ]);
        } else {
            echo json_encode([
                "status" => "error",
                "message" => "PIN Keamanan Giat salah!"
            ]);
        }
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "Akses Ditolak! Nama '$nama' tidak terdaftar dalam daftar Giat."
        ]);
    }
    $stmt->close();
}

// 2. SIMPAN ABSENSI HADIR ATAU PENGAJUAN IZIN/SAKIT DEWAN
elseif ($action === 'submit_absen') {
    $nama    = trim($input['nama'] ?? '');
    $pasukan = trim($input['pasukan'] ?? '');
    $tanggal = trim($input['tanggal'] ?? '');
    $jam     = trim($input['jam'] ?? '-');
    $status  = trim($input['status'] ?? 'Hadir'); // Bisa 'Hadir', 'Izin', atau 'Sakit'
    $ket     = trim($input['keterangan'] ?? 'Hadir pengibaran');
    $gps     = trim($input['gps'] ?? '-');
    $foto    = $input['foto'] ?? null;
    $id_nis  = ($status === 'Hadir') ? "DEW-" . rand(100, 999) : "IZN-" . rand(100, 999);

    // Validasi status yang diizinkan
    if (!in_array($status, ['Hadir', 'Izin', 'Sakit', 'Alpha'])) {
        $status = 'Izin';
    }

    $stmt = $conn->prepare("INSERT INTO absensi_pengibaran (nama_anggota, id_nis, pasukan, tanggal_kegiatan, jam_hadir, status_kehadiran, keterangan, koordinat_gps, foto_bukti) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssssssss", $nama, $id_nis, $pasukan, $tanggal, $jam, $status, $ket, $gps, $foto);

    if ($stmt->execute()) {
        echo json_encode([
            "status" => "success", 
            "message" => "Pengajuan $status berhasil dikirim dan tersimpan di database!"
        ]);
    } else {
        echo json_encode([
            "status" => "error", 
            "message" => "Gagal menyimpan pengajuan: " . $stmt->error
        ]);
    }
    $stmt->close();
}
    
// 3. AMBIL DATA REKAP & STATISTIK GRAFIK
elseif ($action === 'get_rekap') {
    $pasukan = $_GET['pasukan'] ?? '';
    
    if ($pasukan === 'SEMUA') {
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

// 4. UPDATE STATUS KEHADIRAN OLEH GIAT
elseif ($action === 'update_status') {
    $id     = intval($input['id'] ?? 0);
    $status = $input['status'] ?? 'Hadir';
    $jam    = ($status === 'Hadir') ? date("H:i") . " WIB" : "-";

    $stmt = $conn->prepare("UPDATE absensi_pengibaran SET status_kehadiran = ?, jam_hadir = ? WHERE id = ?");
    $stmt->bind_param("ssi", $status, $jam, $id);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Status diperbarui."]);
    } else {
        echo json_encode(["status" => "error", "message" => "Gagal memperbarui status."]);
    }
    $stmt->close();
}

// 5. HAPUS DATA ABSENSI (ADMIN GIAT)
elseif ($action === 'delete_absen') {
    $id = intval($input['id'] ?? 0);
    $stmt = $conn->prepare("DELETE FROM absensi_pengibaran WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Data dihapus."]);
    } else {
        echo json_encode(["status" => "error", "message" => "Gagal menghapus."]);
    }
    $stmt->close();
}

$conn->close();
?>

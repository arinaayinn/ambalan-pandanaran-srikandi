<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// Konfigurasi Koneksi Database (Sesuaikan dengan pengaturan XAMPP/Laragon Anda)
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

// 1. VALIDASI LOGIN GIAT DARI DATABASE
if ($action === 'login_giat') {
    $nama = trim($input['nama'] ?? '');
    
    // Cek kecocokan nama di tabel giat_whitelist (case-insensitive)
    $stmt = $conn->prepare("SELECT id, nama_lengkap FROM giat_whitelist WHERE LOWER(TRIM(nama_lengkap)) = LOWER(?) LIMIT 1");
    $stmt->bind_param("s", $nama);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        echo json_encode([
            "status" => "success",
            "message" => "Akses Giat Diterima",
            "user" => $row['nama_lengkap']
        ]);
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "Akses Ditolak! Nama '$nama' tidak terdaftar dalam daftar Giat yang diizinkan."
        ]);
    }
    $stmt->close();
}

// 2. SIMPAN ABSENSI DEWAN KE DATABASE
elseif ($action === 'submit_absen') {
    $nama = $input['nama'] ?? '';
    $pasukan = $input['pasukan'] ?? '';
    $tanggal = $input['tanggal'] ?? '';
    $jam = $input['jam'] ?? '';
    $gps = $input['gps'] ?? '';
    $foto = $input['foto'] ?? '';
    $id_nis = "DEW-" . rand(100, 999);

    $stmt = $conn->prepare("INSERT INTO absensi_pengibaran (nama_anggota, id_nis, pasukan, tanggal_kegiatan, jam_hadir, status_kehadiran, koordinat_gps, foto_bukti) VALUES (?, ?, ?, ?, ?, 'Hadir', ?, ?)");
    $stmt->bind_param("sssssss", $nama, $id_nis, $pasukan, $tanggal, $jam, $gps, $foto);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Absensi berhasil tersimpan ke database!"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Gagal menyimpan absensi."]);
    }
    $stmt->close();
}

// 3. AMBIL DATA REKAP UNTUK DASHBOARD GIAT
elseif ($action === 'get_rekap') {
    $pasukan = $_GET['pasukan'] ?? '';
    $stmt = $conn->prepare("SELECT * FROM absensi_pengibaran WHERE pasukan = ? ORDER BY id DESC");
    $stmt->bind_param("s", $pasukan);
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
    $id = intval($input['id'] ?? 0);
    $status = $input['status'] ?? 'Hadir';
    $jam = ($status === 'Hadir') ? date("H:i") . " WIB" : "-";

    $stmt = $conn->prepare("UPDATE absensi_pengibaran SET status_kehadiran = ?, jam_hadir = ? WHERE id = ?");
    $stmt->bind_param("ssi", $status, $jam, $id);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Status berhasil diperbarui di database."]);
    } else {
        echo json_encode(["status" => "error", "message" => "Gagal memperbarui status."]);
    }
    $stmt->close();
}

$conn->close();
?>
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// Matikan tampilan error HTML agar respons selalu valid JSON
error_reporting(0);

$host = "localhost";
$user = "root";
$pass = "";
$db   = "db_absen_ambalan";

$conn = new mysqli($host,$user, $pass,$db);

if ($conn->connect_error) {
    echo json_encode([
        "status" => "error",
        "message" => "Gagal terhubung ke database MySQL: " . $conn->connect_error
    ]);
    exit;
}

$conn->set_charset("utf8mb4");

$action = $_GET['action'] ?? '';$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?? [];

// 1. VALIDASI LOGIN GIAT
if ($action === 'login_giat') {
    $nama = trim($input['nama'] ?? '');
    $pin  = trim($input['pin'] ?? '');
    
    $stmt =$conn->prepare("SELECT id, nama_lengkap, pin_akses FROM giat_whitelist WHERE LOWER(TRIM(nama_lengkap)) = LOWER(?) LIMIT 1");
    $stmt->bind_param("s", $nama);$stmt->execute();
    $result =$stmt->get_result();

    if ($row =$result->fetch_assoc()) {
        if ($row['pin_akses'] ===$pin) {
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
            "message" => "Akses Ditolak! Nama '$nama' tidak terdaftar dalam 7 nama Giat resmi."
        ]);
    }
    $stmt->close();
}

// 2. SIMPAN ABSENSI HADIR ATAU SURAT IZIN / SAKIT KE DATABASE
elseif ($action === 'submit_absen') {
    $nama    = trim($input['nama'] ?? '');
    $pasukan = trim($input['pasukan'] ?? '3. Peserta');
    $tanggal = trim($input['tanggal'] ?? date('d M Y'));
    $jam     = trim($input['jam'] ?? '-');
    $status  = trim($input['status'] ?? 'Hadir');
    $ket     = trim($input['keterangan'] ?? '');
    $gps     = trim($input['gps'] ?? '-');
    $foto    =$input['foto'] ?? null;

    if (empty($nama)) {
        echo json_encode(["status" => "error", "message" => "Nama anggota tidak boleh kosong."]);
        exit;
    }

    if (!in_array($status, ['Hadir', 'Izin', 'Sakit', 'Alpha'])) {$status = 'Izin';
    }

    $id_nis = ($status === 'Hadir') ? "DEW-" . rand(100, 999) : "IZN-" . rand(100, 999);

    $stmt =$conn->prepare("INSERT INTO absensi_pengibaran (nama_anggota, id_nis, pasukan, tanggal_kegiatan, jam_hadir, status_kehadiran, keterangan, koordinat_gps, foto_bukti) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    if (!$stmt) {
        echo json_encode(["status" => "error", "message" => "Query error: " . $conn->error]);
        exit;
    }

    $stmt->bind_param("sssssssss", $nama, $id_nis,$pasukan, $tanggal,$jam, $status,$ket, $gps,$foto);

    if ($stmt->execute()) {
        echo json_encode([
            "status" => "success",
            "id" => $stmt->insert_id,
            "message" => "Pengajuan $status atas nama$nama berhasil masuk ke database Giat!"
        ]);
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "Gagal menyimpan ke database: " . $stmt->error
        ]);
    }
    $stmt->close();
}

// 3. AMBIL SELURUH DATA REKAP & SURAT IZIN UNTUK DASHBOARD GIAT
elseif ($action === 'get_rekap') {
    $pasukan =$_GET['pasukan'] ?? 'SEMUA';
    
    if ($pasukan === 'SEMUA' \vert{}\vert{} empty($pasukan)) {
        $stmt =$conn->prepare("SELECT * FROM absensi_pengibaran ORDER BY id DESC");
    } else {
        $stmt =$conn->prepare("SELECT * FROM absensi_pengibaran WHERE pasukan = ? ORDER BY id DESC");
        $stmt->bind_param("s", $pasukan);
    }
    
    $stmt->execute();
    $result =$stmt->get_result();

    $data = [];
    while ($row =$result->fetch_assoc()) {
        $data[] =$row;
    }
    echo json_encode(["status" => "success", "data" => $data]);$stmt->close();
}

// 4. AMBIL RIWAYAT PRIBADI DEWAN DARI DATABASE
elseif ($action === 'get_my_history') {
    $nama = trim($_GET['nama'] ?? '');
    $stmt =$conn->prepare("SELECT * FROM absensi_pengibaran WHERE LOWER(TRIM(nama_anggota)) = LOWER(?) ORDER BY id DESC");
    $stmt->bind_param("s", $nama);$stmt->execute();
    $result =$stmt->get_result();

    $data = [];
    while ($row =$result->fetch_assoc()) {
        $data[] =$row;
    }
    echo json_encode(["status" => "success", "data" => $data]);$stmt->close();
}

// 5. UPDATE STATUS KEHADIRAN OLEH GIAT
elseif ($action === 'update_status') {
    $id     = intval($input['id'] ?? 0);
    $status =$input['status'] ?? 'Hadir';
    $jam    = ($status === 'Hadir') ? date("H:i") . " WIB" : "-";

    $stmt =$conn->prepare("UPDATE absensi_pengibaran SET status_kehadiran = ?, jam_hadir = ? WHERE id = ?");
    $stmt->bind_param("ssi", $status, $jam,$id);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "message" => "Status berhasil diperbarui."]);
    } else {
        echo json_encode(["status" => "error", "message" => "Gagal memperbarui status."]);
    }
    $stmt->close();
}

$conn->close();
?>

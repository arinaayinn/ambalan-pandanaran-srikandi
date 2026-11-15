// --- KONFIGURASI WHITELIST & PIN DEFAULT GIAT ---
const GIAT_WHITELIST = [
    "bagus setya danuartha",
    "keyza callista agatha",
    "azalea salsabila",
    "sabria salvina",
    "faradiba fathin a",
    "melani aulia putri",
    "erneta sauzani putri"
];
const GIAT_DEFAULT_PIN = "ambalan2026";

// --- STATE APLIKASI & SESSION STORAGE ---
let currentUser = {
    name: "",
    role: "",
    pasukan: "1. Petugas Pemimpin Pengibaran",
    avatar: ""
};

let currentGpsCoords = "-7.0051, 110.4381 (Lokasi Sekolah)";

let attendanceData = {
    todayStatus: false,
    todayType: "",
    timeHadir: null,
    history: [
        {
            date: "Jumat, 13 Nov 2026",
            type: "Hadir",
            time: "06:45 WIB",
            gps: "-7.0051, 110.4381",
            keterangan: "Hadir tepat waktu",
            photo: "https://placehold.co/600x450/dc2626/ffffff?text=Bukti+Pengibaran+13+Nov"
        }
    ]
};

// Data cadangan lokal jika dibuka tanpa server PHP
let localRekapData = [
    { id: 1, nama_anggota: "Andika Pratama", id_nis: "DEW-P01", pasukan: "1. Petugas Pemimpin Pengibaran", tanggal_kegiatan: "Jumat, 13 Nov 2026", jam_hadir: "06:45 WIB", status_kehadiran: "Hadir", keterangan: "Hadir tepat waktu", koordinat_gps: "-7.0051, 110.4381", foto_bukti: "https://placehold.co/600x450/dc2626/ffffff?text=Andika+Pratama" },
    { id: 2, nama_anggota: "Siti Rahma", id_nis: "DEW-P02", pasukan: "1. Petugas Pemimpin Pengibaran", tanggal_kegiatan: "Jumat, 13 Nov 2026", jam_hadir: "06:48 WIB", status_kehadiran: "Hadir", keterangan: "Hadir tepat waktu", koordinat_gps: "-7.0052, 110.4380", foto_bukti: "https://placehold.co/600x450/dc2626/ffffff?text=Siti+Rahma" },
    { id: 3, nama_anggota: "Rezky Mahendra", id_nis: "DEW-K01", pasukan: "2. Petugas Pengibaran", tanggal_kegiatan: "Jumat, 13 Nov 2026", jam_hadir: "06:42 WIB", status_kehadiran: "Hadir", keterangan: "Hadir tepat waktu", koordinat_gps: "-7.0050, 110.4382", foto_bukti: "https://placehold.co/600x450/dc2626/ffffff?text=Rezky+Mahendra" },
    { id: 4, nama_anggota: "Joko Santoso", id_nis: "DEW-K03", pasukan: "2. Petugas Pengibaran", tanggal_kegiatan: "Jumat, 13 Nov 2026", jam_hadir: "-", status_kehadiran: "Izin", keterangan: "Izin mengikuti lomba tingkat kota", koordinat_gps: "-", foto_bukti: null },
    { id: 5, nama_anggota: "Mega Wati", id_nis: "DEW-S01", pasukan: "3. Peserta", tanggal_kegiatan: "Jumat, 13 Nov 2026", jam_hadir: "06:35 WIB", status_kehadiran: "Hadir", keterangan: "Hadir tepat waktu", koordinat_gps: "-7.0051, 110.4381", foto_bukti: "https://placehold.co/600x450/dc2626/ffffff?text=Mega+Wati" }
];

let latestFetchedMembers = [];
let mediaStream = null;
let schoolChartInstance = null;
let schoolDonutInstance = null;

// --- INISIALISASI SAAT HALAMAN DIMUAT ---
document.addEventListener('DOMContentLoaded', () => {
    renderCalendarDays();
    restoreSession();
});

// --- PULIHKAN SESSION LOGIN AGAR TIDAK TER-LOGOUT SAAT REFRESH ---
function restoreSession() {
    const savedSession = localStorage.getItem('ambalan_user_session');
    if (savedSession) {
        try {
            currentUser = JSON.parse(savedSession);
            if (currentUser && currentUser.name && currentUser.role) {
                executeLoginSuccess(true);
            }
        } catch (e) {
            localStorage.removeItem('ambalan_user_session');
        }
    }
}

// --- TOAST NOTIFICATION ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const bgCol = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-red-600' : 'bg-slate-900');
    toast.className = `${bgCol} text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-2 transform translate-y-2 opacity-0 transition-all duration-300 pointer-events-auto`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 50);
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// --- LOGIN ROLE TABS ---
function setLoginRole(role) {
    document.getElementById('login-role-input').value = role;

    ['giat', 'dewan'].forEach(r => {
        const btn = document.getElementById(`tab-role-${r}`);
        btn.className = (r === role)
            ? "py-3 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all bg-white text-red-600 shadow-sm flex items-center justify-center gap-2"
            : "py-3 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all text-slate-600 hover:text-slate-900 flex items-center justify-center gap-2";
    });

    const inputName = document.getElementById('login-username');
    const labelName = document.getElementById('login-label-name');
    const hintEl = document.getElementById('login-hint');
    const pinGroup = document.getElementById('group-giat-pin');
    const pasukanGroup = document.getElementById('group-pasukan-select');

    if (role === 'giat') {
        labelName.innerText = "Nama Giat (Terdaftar)";
        inputName.value = "Bagus Setya Danuartha";
        hintEl.innerText = "*Hanya 7 nama Giat resmi yang diizinkan masuk.";
        pinGroup.classList.remove('hidden');
        pasukanGroup.classList.add('hidden');
    } else {
        labelName.innerText = "Nama Lengkap Dewan (Peserta)";
        inputName.value = "Andika Pratama";
        hintEl.innerText = "*Masukkan nama lengkap dan pilih pasukan pengibaran.";
        pinGroup.classList.add('hidden');
        pasukanGroup.classList.remove('hidden');
    }
}

// --- QUICK DEMO 1-KLIK ---
function quickDemoLogin(role) {
    setLoginRole(role);
    if (role === 'giat') {
        currentUser = { name: "Bagus Setya Danuartha", role: "giat", pasukan: "Semua Pasukan", avatar: "BS" };
    } else {
        currentUser = { name: "Andika Pratama", role: "dewan", pasukan: "1. Petugas Pemimpin Pengibaran", avatar: "AP" };
    }
    localStorage.setItem('ambalan_user_session', JSON.stringify(currentUser));
    executeLoginSuccess(false);
}

// --- PROSES LOGIN + VALIDASI PIN ---
async function handleLogin(e) {
    e.preventDefault();
    const role = document.getElementById('login-role-input').value;
    const name = document.getElementById('login-username').value.trim();
    const pin  = document.getElementById('login-pin').value.trim();
    const pasukan = document.getElementById('login-class').value;

    if (!name) {
        showToast("Nama tidak boleh kosong!", "error");
        return;
    }

    if (role === 'giat') {
        let verifiedName = name;
        try {
            const response = await fetch('api.php?action=login_giat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama: name, pin: pin })
            });
            if (!response.ok) throw new Error("Server PHP tidak merespons");
            const result = await response.json();

            if (result.status !== 'success') {
                showToast(result.message, 'error');
                return;
            }
            verifiedName = result.user;
        } catch (error) {
            // Fallback lokal jika dibuka tanpa XAMPP
            const isAuthorized = GIAT_WHITELIST.includes(name.toLowerCase());
            if (!isAuthorized) {
                showToast(`Akses Ditolak! Nama "${name}" tidak terdaftar sebagai Giat.`, 'error');
                return;
            }
            if (pin !== GIAT_DEFAULT_PIN) {
                showToast("PIN Keamanan Giat salah!", "error");
                return;
            }
        }
        currentUser.name = verifiedName;
    } else {
        currentUser.name = name;
    }

    currentUser.role = role;
    currentUser.pasukan = pasukan;
    currentUser.avatar = currentUser.name.substring(0, 2).toUpperCase();

    localStorage.setItem('ambalan_user_session', JSON.stringify(currentUser));
    executeLoginSuccess(false);
}

function executeLoginSuccess(isSilent) {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('app-navbar').classList.remove('hidden');

    document.getElementById('nav-user-name').innerText = currentUser.name;
    document.getElementById('nav-user-avatar').innerText = currentUser.avatar;

    if (currentUser.role === 'dewan') {
        document.getElementById('nav-role-subtitle').innerText = `Dewan (${currentUser.pasukan})`;
    } else {
        document.getElementById('nav-role-subtitle').innerText = `Giat Terverifikasi`;
    }

    switchTab('dashboard');
    if (!isSilent) {
        showToast(`Selamat datang, ${currentUser.name}!`, 'success');
    }
}

function logout() {
    localStorage.removeItem('ambalan_user_session');
    document.getElementById('app-navbar').classList.add('hidden');
    document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-login').classList.remove('hidden');
    showToast('Anda telah keluar dari sesi.', 'info');
}

// --- NAVIGATION TABS ---
function switchTab(tabName) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));

    if (tabName === 'dashboard') {
        if (currentUser.role === 'dewan') {
            document.getElementById('view-dashboard-dewan').classList.remove('hidden');
            renderDewanDashboard();
        } else {
            document.getElementById('view-dashboard-giat').classList.remove('hidden');
            renderGiatTable();
        }
    } else if (tabName === 'tutorial') {
        document.getElementById('view-tutorial').classList.remove('hidden');
    } else if (tabName === 'faq') {
        document.getElementById('view-faq').classList.remove('hidden');
    } else if (tabName === 'settings') {
        document.getElementById('view-settings').classList.remove('hidden');
        document.getElementById('settings-name-input').value = currentUser.name;
    }

    ['dashboard', 'tutorial', 'faq', 'settings'].forEach(t => {
        const btn = document.getElementById(`nav-tab-${t}`);
        if (btn) {
            btn.className = (t === tabName)
                ? "px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 transition-all flex items-center gap-2"
                : "px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center gap-2";
        }
    });
}

function toggleMobileMenu() {
    document.getElementById('mobile-menu').classList.toggle('hidden');
}

// --- DASHBOARD DEWAN ---
function renderDewanDashboard() {
    document.getElementById('dewan-welcome-title').innerText = `Halo, ${currentUser.name}! 👋`;
    document.getElementById('dewan-pasukan-subtitle').innerText = `Pasukan: ${currentUser.pasukan}`;
    document.getElementById('wm-name').innerText = `${currentUser.name} (${currentUser.pasukan})`;

    const badge = document.getElementById('dewan-status-badge-today');
    const timeInfo = document.getElementById('dewan-status-time-today');
    const btnAbsen = document.getElementById('btn-action-absen');
    const btnIzin = document.getElementById('btn-action-izin');

    if (attendanceData.todayStatus) {
        badge.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-300"></i> Status: ${attendanceData.todayType}`;
        timeInfo.innerText = `Tercatat pukul ${attendanceData.timeHadir}`;
        btnAbsen.innerHTML = `<i class="fa-solid fa-check"></i> Sudah Melakukan Absensi`;
        btnAbsen.className = "w-full py-4 px-6 bg-emerald-600 text-white font-bold rounded-2xl shadow-md cursor-default flex items-center justify-center gap-3 text-base";
        btnAbsen.disabled = true;
        btnIzin.disabled = true;
        btnIzin.classList.add('opacity-50', 'cursor-not-allowed');
    }

    const historyList = document.getElementById('dewan-history-list');
    historyList.innerHTML = '';
    attendanceData.history.forEach((item, index) => {
        const badgeCol = item.type === 'Hadir' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50';
        const div = document.createElement('div');
        div.className = "p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4";
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm">
                    <i class="fa-solid fa-calendar-day"></i>
                </div>
                <div>
                    <div class="font-bold text-slate-900 text-sm">${item.date}</div>
                    <div class="text-xs text-slate-500 mt-0.5">
                        <span class="px-2 py-0.5 rounded-md font-bold ${badgeCol}">${item.type}</span> • ${item.time}
                    </div>
                    <div class="text-[11px] text-slate-400 mt-0.5">${item.keterangan || ''}</div>
                </div>
            </div>
            ${item.photo ? `<button onclick="openPhotoPreview('${item.photo}', '${currentUser.name}', '${item.date} • ${item.time}', '${item.gps}')" class="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"><i class="fa-solid fa-image text-red-600"></i> Lihat Foto</button>` : '<span class="text-xs text-slate-400">Tanpa Lampiran</span>'}
        `;
        historyList.appendChild(div);
    });
}

// --- FITUR 1: KAMERA LIVE + GPS ASLI + CANVAS WATERMARK ---
function openAttendanceModal() {
    document.getElementById('modal-camera').classList.remove('hidden');
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const timeStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} • ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;
    document.getElementById('wm-time').innerText = timeStr;

    // Deteksi GPS Perangkat Secara Real-Time
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude.toFixed(5);
                const lon = pos.coords.longitude.toFixed(5);
                currentGpsCoords = `Lat: ${lat}, Long: ${lon} (GPS Terverifikasi)`;
                document.getElementById('wm-gps').innerText = currentGpsCoords;
            },
            () => {
                currentGpsCoords = "Lat: -7.0051, Long: 110.4381 (Area Sekolah)";
                document.getElementById('wm-gps').innerText = currentGpsCoords;
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    }

    startWebcam();
}

function closeCameraModal() {
    document.getElementById('modal-camera').classList.add('hidden');
    stopWebcam();
}

async function startWebcam() {
    const videoElement = document.getElementById('webcam-video');
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        videoElement.srcObject = mediaStream;
    } catch (err) {
        showToast("Kamera tidak terdeteksi, menggunakan mode tangkapan cadangan.", "info");
    }
}

function stopWebcam() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}

// Menangkap Gambar Asli dari Video ke Canvas beserta Watermark
function captureSnapshotWithWatermark() {
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('snapshot-canvas');
    const ctx = canvas.getContext('2d');

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, width, height);
    } else {
        // Fallback background jika tidak ada webcam fisik
        ctx.fillStyle = "#1E293B";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText("ABSENSI PENGIBARAN AMBALAN", 30, height / 2);
    }

    // Gambar Kotak Watermark di Bagian Bawah Foto
    ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
    ctx.fillRect(16, height - 96, width - 32, 80);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(`${currentUser.name} (${currentUser.pasukan})`, 28, height - 68);

    ctx.fillStyle = "#34D399";
    ctx.font = "13px sans-serif";
    ctx.fillText(currentGpsCoords, 28, height - 46);

    ctx.fillStyle = "#FBBF24";
    ctx.fillText(document.getElementById('wm-time').innerText, 28, height - 25);

    return canvas.toDataURL('image/jpeg', 0.8);
}

async function captureAndSubmitAttendance() {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

    const capturedBase64Image = captureSnapshotWithWatermark();

    try {
        await fetch('api.php?action=submit_absen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nama: currentUser.name,
                pasukan: currentUser.pasukan,
                tanggal: dateStr,
                jam: timeStr,
                status: "Hadir",
                keterangan: "Hadir pengibaran (Terverifikasi Kamera & GPS)",
                gps: currentGpsCoords,
                foto: capturedBase64Image
            })
        });
    } catch (e) {
        localRekapData.unshift({
            id: Date.now(),
            nama_anggota: currentUser.name,
            id_nis: "DEW-LIVE",
            pasukan: currentUser.pasukan,
            tanggal_kegiatan: dateStr,
            jam_hadir: timeStr,
            status_kehadiran: "Hadir",
            keterangan: "Hadir pengibaran",
            koordinat_gps: currentGpsCoords,
            foto_bukti: capturedBase64Image
        });
    }

    attendanceData.todayStatus = true;
    attendanceData.todayType = "Hadir";
    attendanceData.timeHadir = timeStr;
    attendanceData.history.unshift({
        date: dateStr,
        type: "Hadir",
        time: timeStr,
        gps: currentGpsCoords,
        keterangan: "Hadir pengibaran",
        photo: capturedBase64Image
    });

    showToast("Absen Hadir dengan Bukti Foto GPS Berhasil!", "success");
    closeCameraModal();
    renderDewanDashboard();
}

// --- FITUR 2: PENGAJUAN IZIN / SAKIT MANDIRI OLEH DEWAN ---
function openIzinModal() {
    document.getElementById('modal-izin').classList.remove('hidden');
}

function closeIzinModal() {
    document.getElementById('modal-izin').classList.add('hidden');
}

function submitIzinForm(e) {
    e.preventDefault();
    const izinType = document.getElementById('izin-type-select').value;
    const reason = document.getElementById('izin-reason-input').value.trim();
    const fileInput = document.getElementById('izin-file-input');

    const processSubmission = async (base64File) => {
        const now = new Date();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;

        try {
            await fetch('api.php?action=submit_absen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nama: currentUser.name,
                    pasukan: currentUser.pasukan,
                    tanggal: dateStr,
                    jam: "-",
                    status: izinType,
                    keterangan: reason,
                    gps: "Pengajuan Mandiri",
                    foto: base64File
                })
            });
        } catch (err) {
            localRekapData.unshift({
                id: Date.now(),
                nama_anggota: currentUser.name,
                id_nis: "DEW-IZIN",
                pasukan: currentUser.pasukan,
                tanggal_kegiatan: dateStr,
                jam_hadir: "-",
                status_kehadiran: izinType,
                keterangan: reason,
                koordinat_gps: "Pengajuan Mandiri",
                foto_bukti: base64File
            });
        }

        attendanceData.todayStatus = true;
        attendanceData.todayType = izinType;
        attendanceData.timeHadir = timeStr;
        attendanceData.history.unshift({
            date: dateStr,
            type: izinType,
            time: timeStr,
            gps: "Pengajuan Mandiri",
            keterangan: reason,
            photo: base64File
        });

        showToast(`Pengajuan ${izinType} berhasil dikirim ke Giat!`, "success");
        closeIzinModal();
        renderDewanDashboard();
    };

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => processSubmission(ev.target.result);
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        processSubmission(null);
    }
}

// --- FITUR 3: MODAL PREVIEW BUKTI FOTO ASLI ---
function openPhotoPreview(photoUrl, name, dateTime, gps) {
    document.getElementById('preview-photo-img').src = photoUrl;
    document.getElementById('preview-photo-title').innerText = `Bukti Kehadiran: ${name}`;
    document.getElementById('preview-photo-subtitle').innerText = dateTime;
    document.getElementById('preview-photo-gps').innerHTML = `<i class="fa-solid fa-location-dot text-red-600"></i> ${gps || 'GPS Terverifikasi'}`;
    document.getElementById('modal-photo-preview').classList.remove('hidden');
}

function closePhotoPreview() {
    document.getElementById('modal-photo-preview').classList.add('hidden');
}

// --- CALENDAR GENERATOR ---
function renderCalendarDays() {
    const container = document.getElementById('dewan-calendar-days');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= 30; i++) {
        const dayEl = document.createElement('div');
        let bgCol = "bg-slate-50 text-slate-400";
        let dotCol = "";

        if ([6, 13, 20, 27].includes(i)) {
            if (i <= 13) {
                bgCol = "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200";
                dotCol = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5 inline-block"></span>';
            } else {
                bgCol = "bg-blue-50 text-blue-800 font-bold border border-blue-200";
                dotCol = '<span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-0.5 inline-block"></span>';
            }
        }
        dayEl.className = `aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-semibold ${bgCol}`;
        dayEl.innerHTML = `<span>${i}</span>${dotCol}`;
        container.appendChild(dayEl);
    }
}

// --- DASHBOARD GIAT: FILTER, SEARCH, TABEL & GRAFIK DINAMIS ---
async function renderGiatTable() {
    const selectedPasukan = document.getElementById('filter-pasukan-select').value;
    const selectedStatus  = document.getElementById('filter-status-select').value;
    const searchKeyword   = document.getElementById('search-member-input').value.toLowerCase().trim();

    let rawMembers = [];

    try {
        const res = await fetch(`api.php?action=get_rekap&pasukan=${encodeURIComponent(selectedPasukan)}`);
        const json = await res.json();
        if (json.status === 'success') {
            rawMembers = json.data;
        }
    } catch (e) {
        rawMembers = (selectedPasukan === 'SEMUA')
            ? localRekapData
            : localRekapData.filter(item => item.pasukan === selectedPasukan);
    }

    // Terapkan Filter Status & Pencarian Nama
    const filteredMembers = rawMembers.filter(m => {
        const matchStatus = (selectedStatus === 'SEMUA') || (m.status_kehadiran === selectedStatus);
        const matchName = !searchKeyword || m.nama_anggota.toLowerCase().includes(searchKeyword);
        return matchStatus && matchName;
    });

    latestFetchedMembers = filteredMembers;

    const tbody = document.getElementById('giat-tbody');
    tbody.innerHTML = '';

    let hadirCount = 0;
    let izinSakitCount = 0;
    let alphaCount = 0;

    filteredMembers.forEach((m) => {
        const status = m.status_kehadiran;
        if (status === 'Hadir') hadirCount++;
        else if (status === 'Izin' || status === 'Sakit') izinSakitCount++;
        else alphaCount++;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-all border-b border-slate-100";
        tr.innerHTML = `
            <td class="p-4">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold shrink-0">${m.nama_anggota.substring(0,2).toUpperCase()}</div>
                    <div>
                        <div class="font-bold text-slate-900">${m.nama_anggota}</div>
                        <div class="text-[11px] text-slate-500">${m.pasukan}</div>
                    </div>
                </div>
            </td>
            <td class="p-4">
                <div class="text-xs font-semibold text-slate-800">${m.tanggal_kegiatan}</div>
                <div class="text-[11px] text-slate-500">Pukul: ${m.jam_hadir}</div>
            </td>
            <td class="p-4">
                <div class="text-xs text-slate-700 font-medium">${m.keterangan || '-'}</div>
                <div class="text-[10px] text-slate-400 font-mono mt-0.5">${m.koordinat_gps || '-'}</div>
            </td>
            <td class="p-4">
                ${m.foto_bukti ? `<button onclick="openPhotoPreview('${m.foto_bukti}', '${m.nama_anggota}', '${m.tanggal_kegiatan} (${m.jam_hadir})', '${m.koordinat_gps}')" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-100 flex items-center gap-1.5"><i class="fa-solid fa-image text-red-600"></i> Lihat Foto</button>` : '<span class="text-xs text-slate-400">Tidak ada</span>'}
            </td>
            <td class="p-4 text-center">
                <div class="inline-flex rounded-xl p-1 bg-slate-100 gap-1">
                    <button onclick="changeMemberStatus(${m.id}, 'Hadir')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${status === 'Hadir' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">Hadir</button>
                    <button onclick="changeMemberStatus(${m.id}, 'Izin')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${status === 'Izin' || status === 'Sakit' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">Izin</button>
                    <button onclick="changeMemberStatus(${m.id}, 'Alpha')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${status === 'Alpha' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">Alpha</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('table-count-label').innerText = `Menampilkan ${filteredMembers.length} data`;
    document.getElementById('stat-giat-hadir').innerText = `${hadirCount} Anggota`;
    document.getElementById('stat-giat-izin').innerText = `${izinSakitCount} Anggota`;
    document.getElementById('stat-giat-alpha').innerText = `${alphaCount} Anggota`;
    const total = filteredMembers.length;
    const pct = total > 0 ? Math.round((hadirCount / total) * 100) : 0;
    document.getElementById('stat-giat-persen').innerText = `${pct}%`;

    updateDynamicCharts(rawMembers, hadirCount, izinSakitCount, alphaCount);
}

async function changeMemberStatus(dbId, newStatus) {
    try {
        await fetch('api.php?action=update_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: dbId, status: newStatus })
        });
    } catch (e) {
        const target = localRekapData.find(item => item.id === dbId);
        if (target) {
            target.status_kehadiran = newStatus;
            target.jam_hadir = (newStatus === 'Hadir') ? "06:50 WIB" : "-";
        }
    }
    renderGiatTable();
    showToast(`Status berhasil diubah menjadi ${newStatus}`, 'success');
}

// --- FITUR 4: GRAFIK DINAMIS DARI DATA NYATA ---
function updateDynamicCharts(allMembers, hadir, izinSakit, alpha) {
    const pasukan1 = allMembers.filter(m => m.pasukan === "1. Petugas Pemimpin Pengibaran" && m.status_kehadiran === "Hadir").length;
    const pasukan2 = allMembers.filter(m => m.pasukan === "2. Petugas Pengibaran" && m.status_kehadiran === "Hadir").length;
    const pasukan3 = allMembers.filter(m => m.pasukan === "3. Peserta" && m.status_kehadiran === "Hadir").length;

    const ctxBar = document.getElementById('schoolAttendanceChart');
    if (ctxBar && typeof Chart !== 'undefined') {
        if (schoolChartInstance) schoolChartInstance.destroy();
        schoolChartInstance = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['1. Pemimpin Pengibaran', '2. Petugas Pengibaran', '3. Peserta'],
                datasets: [{
                    label: 'Jumlah Hadir',
                    data: [pasukan1, pasukan2, pasukan3],
                    backgroundColor: ['#DC2626', '#2563EB', '#10B981'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    const ctxDonut = document.getElementById('schoolDonutChart');
    if (ctxDonut && typeof Chart !== 'undefined') {
        if (schoolDonutInstance) schoolDonutInstance.destroy();
        schoolDonutInstance = new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
                labels: ['Hadir', 'Izin/Sakit', 'Alpha'],
                datasets: [{
                    data: [hadir, izinSakit, alpha],
                    backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

// --- FITUR 5: UNDUH EXCEL (.CSV) SUNGGUHAN ---
function exportToCSV() {
    if (!latestFetchedMembers || latestFetchedMembers.length === 0) {
        showToast("Tidak ada data untuk diekspor.", "error");
        return;
    }

    let csvContent = "No,Nama Anggota,ID/NIS,Pasukan,Tanggal Kegiatan,Jam Hadir,Status,Keterangan,Koordinat GPS\n";
    latestFetchedMembers.forEach((m, index) => {
        const row = [
            index + 1,
            `"${m.nama_anggota}"`,
            `"${m.id_nis}"`,
            `"${m.pasukan}"`,
            `"${m.tanggal_kegiatan}"`,
            `"${m.jam_hadir}"`,
            `"${m.status_kehadiran}"`,
            `"${(m.keterangan || '-').replace(/"/g, '""')}"`,
            `"${m.koordinat_gps || '-'}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Rekap_Absen_Pengibaran_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("File Excel (.CSV) berhasil diunduh!", "success");
}

function printRekapGiat() {
    window.print();
}

function toggleFaq(id) {
    document.getElementById(`faq-content-${id}`).classList.toggle('hidden');
    document.getElementById(`faq-icon-${id}`).classList.toggle('rotate-180');
}

function saveSettings(e) {
    e.preventDefault();
    const newName = document.getElementById('settings-name-input').value.trim();
    if (!newName) return;
    currentUser.name = newName;
    currentUser.avatar = newName.substring(0, 2).toUpperCase();
    localStorage.setItem('ambalan_user_session', JSON.stringify(currentUser));
    document.getElementById('nav-user-name').innerText = newName;
    document.getElementById('nav-user-avatar').innerText = currentUser.avatar;
    showToast("Profil berhasil diperbarui!", "success");
}

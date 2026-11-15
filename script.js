// --- DAFTAR 7 NAMA GIAT YANG DIIZINKAN ---
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

// --- STATE APLIKASI ---
let currentUser = {
    name: "",
    role: "",
    pasukan: "1. Petugas Pemimpin Pengibaran",
    avatar: ""
};

let currentGpsCoords = "Lat: -7.0051, Long: 110.4381 (Area Sekolah)";
let currentDataMap = {}; // Menyimpan data Base64 foto agar aman dari error kutip pada onclick
let latestFetchedMembers = [];
let mediaStream = null;
let schoolChartInstance = null;
let schoolDonutInstance = null;

// --- INISIALISASI ---
document.addEventListener('DOMContentLoaded', () => {
    renderCalendarDays();
    restoreSession();
});

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
    }, 4000);
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

// --- PROSES LOGIN ---
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

// --- DASHBOARD DEWAN & RIWAYAT DARI DATABASE ---
function renderDewanDashboard() {
    document.getElementById('dewan-welcome-title').innerText = `Halo, ${currentUser.name}! 👋`;
    document.getElementById('dewan-pasukan-subtitle').innerText = `Pasukan: ${currentUser.pasukan}`;
    document.getElementById('wm-name').innerText = `${currentUser.name} (${currentUser.pasukan})`;
    loadMyDewanHistory();
}

async function loadMyDewanHistory() {
    const historyList = document.getElementById('dewan-history-list');
    historyList.innerHTML = `<div class="text-xs text-slate-400 text-center py-6"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Memuat riwayat dari database...</div>`;

    try {
        const res = await fetch(`api.php?action=get_my_history&nama=${encodeURIComponent(currentUser.name)}`);
        const json = await res.json();
        if (json.status === 'success') {
            renderDewanHistoryItems(json.data);
        }
    } catch (e) {
        historyList.innerHTML = `<div class="text-xs text-red-500 text-center py-6">Gagal terhubung ke server PHP. Pastikan dibuka via http://localhost/</div>`;
    }
}

function renderDewanHistoryItems(items) {
    const historyList = document.getElementById('dewan-history-list');
    historyList.innerHTML = '';

    if (!items || items.length === 0) {
        historyList.innerHTML = `<div class="text-xs text-slate-400 text-center py-6">Belum ada riwayat absensi atau pengajuan surat izin.</div>`;
        return;
    }

    // Update badge hari ini berdasarkan data terbaru
    const latest = items[0];
    const badge = document.getElementById('dewan-status-badge-today');
    const timeInfo = document.getElementById('dewan-status-time-today');
    badge.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-300"></i> Terakhir: ${latest.status_kehadiran}`;
    timeInfo.innerText = `${latest.tanggal_kegiatan} (${latest.jam_hadir})`;

    items.forEach((item) => {
        currentDataMap[item.id] = item;
        const status = item.status_kehadiran;
        const badgeCol = status === 'Hadir' ? 'text-emerald-600 bg-emerald-50' : (status === 'Sakit' ? 'text-blue-600 bg-blue-50' : 'text-amber-600 bg-amber-50');
        
        const div = document.createElement('div');
        div.className = "p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4";
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm shrink-0">
                    <i class="fa-solid ${status === 'Hadir' ? 'fa-camera' : 'fa-file-lines'}"></i>
                </div>
                <div>
                    <div class="font-bold text-slate-900 text-sm">${item.tanggal_kegiatan}</div>
                    <div class="text-xs text-slate-500 mt-0.5">
                        <span class="px-2 py-0.5 rounded-md font-bold ${badgeCol}">${status}</span> • ${item.jam_hadir}
                    </div>
                    <div class="text-[11px] text-slate-500 mt-0.5">${item.keterangan || ''}</div>
                </div>
            </div>
            ${item.foto_bukti ? `<button type="button" onclick="openPhotoPreviewById(${item.id})" class="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 shrink-0"><i class="fa-solid fa-image text-red-600"></i> Lihat Surat/Foto</button>` : '<span class="text-xs text-slate-400 shrink-0">Tanpa Lampiran</span>'}
        `;
        historyList.appendChild(div);
    });
}

// --- KAMERA LIVE + GPS + CANVAS WATERMARK ---
function openAttendanceModal() {
    document.getElementById('modal-camera').classList.remove('hidden');
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const timeStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} • ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;
    document.getElementById('wm-time').innerText = timeStr;

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
        showToast("Kamera fisik tidak tersedia, menggunakan mode cadangan.", "info");
    }
}

function stopWebcam() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}

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
        ctx.fillStyle = "#1E293B";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText("ABSENSI PENGIBARAN AMBALAN", 30, height / 2);
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(16, height - 96, width - 32, 80);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(`${currentUser.name} (${currentUser.pasukan})`, 28, height - 68);

    ctx.fillStyle = "#34D399";
    ctx.font = "13px sans-serif";
    ctx.fillText(currentGpsCoords, 28, height - 46);

    ctx.fillStyle = "#FBBF24";
    ctx.fillText(document.getElementById('wm-time').innerText, 28, height - 25);

    return canvas.toDataURL('image/jpeg', 0.75);
}

async function captureAndSubmitAttendance() {
    const btn = document.getElementById('btn-capture-submit');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

    const capturedBase64Image = captureSnapshotWithWatermark();

    try {
        const res = await fetch('api.php?action=submit_absen', {
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

        const json = await res.json();
        if (json.status === 'success') {
            showToast(json.message, "success");
            closeCameraModal();
            loadMyDewanHistory();
        } else {
            showToast("Gagal menyimpan: " + json.message, "error");
        }
    } catch (e) {
        showToast("Error koneksi! Pastikan membuka lewat http://localhost/absen-ambalan/index.html", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-camera"></i> Jepret & Kirim`;
    }
}

// --- PENGIRIMAN SURAT IZIN / SAKIT LANGSUNG KE DATABASE GIAT ---
function openIzinModal() {
    document.getElementById('form-pengajuan-izin').reset();
    clearIzinAttachment();
    document.getElementById('modal-izin').classList.remove('hidden');
}

function closeIzinModal() {
    document.getElementById('modal-izin').classList.add('hidden');
}

function previewIzinAttachment(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('izin-attachment-preview-img').src = e.target.result;
        document.getElementById('izin-attachment-preview-box').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function clearIzinAttachment() {
    const fileInput = document.getElementById('izin-file-input');
    if (fileInput) fileInput.value = '';
    document.getElementById('izin-attachment-preview-img').src = '';
    document.getElementById('izin-attachment-preview-box').classList.add('hidden');
}

function compressImageFile(file, maxWidth = 800) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function submitIzinForm(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-izin');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengirim ke Database...`;

    const selectedRadio = document.querySelector('input[name="izin-status-radio"]:checked');
    const statusIzin = selectedRadio ? selectedRadio.value : 'Izin';
    const alasan = document.getElementById('izin-reason-input').value.trim();
    const fileInput = document.getElementById('izin-file-input');

    let lampiranBase64 = null;
    if (fileInput.files && fileInput.files[0]) {
        lampiranBase64 = await compressImageFile(fileInput.files[0]);
    }

    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;

    try {
        const response = await fetch('api.php?action=submit_absen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nama: currentUser.name,
                pasukan: currentUser.pasukan,
                tanggal: dateStr,
                jam: "-",
                status: statusIzin,
                keterangan: alasan,
                gps: "Surat Izin Mandiri (" + timeStr + ")",
                foto: lampiranBase64
            })
        });

        const resJson = await response.json();
        if (resJson.status === 'success') {
            showToast(resJson.message, "success");
            closeIzinModal();
            loadMyDewanHistory();
        } else {
            showToast("Gagal masuk ke database: " + resJson.message, "error");
        }
    } catch (err) {
        showToast("Koneksi PHP gagal! Buka halaman melalui http://localhost/absen-ambalan/index.html", "error");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim ke Database Giat`;
    }
}

// --- MODAL PREVIEW FOTO / SURAT ---
function openPhotoPreviewById(id) {
    const item = currentDataMap[id];
    if (!item || !item.foto_bukti) {
        showToast("Tidak ada lampiran foto pada data ini.", "info");
        return;
    }
    document.getElementById('preview-photo-img').src = item.foto_bukti;
    document.getElementById('preview-photo-title').innerText = `Lampiran ${item.status_kehadiran}: ${item.nama_anggota}`;
    document.getElementById('preview-photo-subtitle').innerText = `${item.tanggal_kegiatan} • ${item.pasukan}`;
    document.getElementById('preview-photo-gps').innerHTML = `<i class="fa-solid fa-circle-info text-red-600"></i> ${item.keterangan || item.koordinat_gps || '-'}`;
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

// --- DASHBOARD GIAT: AMBIL LANGSUNG DARI DATABASE MYSQL ---
async function renderGiatTable() {
    const selectedPasukan = document.getElementById('filter-pasukan-select').value;
    const selectedStatus  = document.getElementById('filter-status-select').value;
    const searchKeyword   = document.getElementById('search-member-input').value.toLowerCase().trim();

    const tbody = document.getElementById('giat-tbody');
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 text-xs"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Memuat data dari database phpMyAdmin...</td></tr>`;

    let rawMembers = [];

    try {
        const res = await fetch(`api.php?action=get_rekap&pasukan=${encodeURIComponent(selectedPasukan)}`);
        const json = await res.json();
        if (json.status === 'success') {
            rawMembers = json.data;
        } else {
            showToast(json.message, "error");
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500 text-xs font-bold">Gagal mengambil data dari database. Pastikan XAMPP Apache & MySQL aktif dan dibuka via http://localhost/absen-ambalan/index.html</td></tr>`;
        return;
    }

    const filteredMembers = rawMembers.filter(m => {
        const matchStatus = (selectedStatus === 'SEMUA') || (m.status_kehadiran === selectedStatus);
        const matchName = !searchKeyword || m.nama_anggota.toLowerCase().includes(searchKeyword);
        return matchStatus && matchName;
    });

    latestFetchedMembers = filteredMembers;
    tbody.innerHTML = '';

    if (filteredMembers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 text-xs">Tidak ada data kehadiran atau surat izin yang cocok dengan filter.</td></tr>`;
    }

    let hadirCount = 0;
    let izinSakitCount = 0;
    let alphaCount = 0;

    filteredMembers.forEach((m) => {
        currentDataMap[m.id] = m;
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
                <div class="text-xs text-slate-800 font-semibold">${m.keterangan || '-'}</div>
                <div class="text-[10px] text-slate-400 font-mono mt-0.5">${m.koordinat_gps || '-'}</div>
            </td>
            <td class="p-4">
                ${m.foto_bukti ? `<button type="button" onclick="openPhotoPreviewById(${m.id})" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-100 flex items-center gap-1.5"><i class="fa-solid fa-file-image text-red-600"></i> Lihat Surat/Foto</button>` : '<span class="text-xs text-slate-400">Tidak ada</span>'}
            </td>
            <td class="p-4 text-center">
                <div class="inline-flex rounded-xl p-1 bg-slate-100 gap-1">
                    <button type="button" onclick="changeMemberStatus(${m.id}, 'Hadir')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${status === 'Hadir' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">Hadir</button>
                    <button type="button" onclick="changeMemberStatus(${m.id}, 'Izin')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${status === 'Izin' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">Izin</button>
                    <button type="button" onclick="changeMemberStatus(${m.id}, 'Sakit')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${status === 'Sakit' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">Sakit</button>
                    <button type="button" onclick="changeMemberStatus(${m.id}, 'Alpha')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${status === 'Alpha' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">Alpha</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('table-count-label').innerText = `Menampilkan ${filteredMembers.length} data dari database`;
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
        const res = await fetch('api.php?action=update_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: dbId, status: newStatus })
        });
        const json = await res.json();
        if (json.status === 'success') {
            renderGiatTable();
            showToast(`Status berhasil diubah menjadi ${newStatus}`, 'success');
        }
    } catch (e) {
        showToast("Gagal memperbarui status ke database.", "error");
    }
}

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

// --- EKSPOR EXCEL (.CSV) & PRINT ---
function exportToCSV() {
    if (!latestFetchedMembers || latestFetchedMembers.length === 0) {
        showToast("Tidak ada data untuk diekspor.", "error");
        return;
    }

    let csvContent = "No,Nama Anggota,ID/NIS,Pasukan,Tanggal Kegiatan,Jam Hadir,Status,Alasan/Keterangan,Koordinat GPS\n";
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

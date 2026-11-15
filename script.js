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

let currentUser = { name: "", role: "", pasukan: "1. Petugas Pemimpin Pengibaran", avatar: "" };
let currentGpsCoords = "Lat: -7.0051, Long: 110.4381 (Area Sekolah)";
let currentDataMap = {};
let mediaStream = null;

document.addEventListener('DOMContentLoaded', () => {
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

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const bgCol = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-red-600' : 'bg-slate-900');
    toast.className = `${bgCol} text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-2 transition-all duration-300 pointer-events-auto`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- LOGIN ---
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
    currentUser = (role === 'giat')
        ? { name: "Bagus Setya Danuartha", role: "giat", pasukan: "Semua Pasukan", avatar: "BS" }
        : { name: "Andika Pratama", role: "dewan", pasukan: "1. Petugas Pemimpin Pengibaran", avatar: "AP" };
    localStorage.setItem('ambalan_user_session', JSON.stringify(currentUser));
    executeLoginSuccess(false);
}

async function handleLogin(e) {
    e.preventDefault();
    const role = document.getElementById('login-role-input').value;
    const name = document.getElementById('login-username').value.trim();
    const pin  = document.getElementById('login-pin').value.trim();
    const pasukan = document.getElementById('login-class').value;

    if (!name) return showToast("Nama wajib diisi!", "error");

    if (role === 'giat') {
        let verifiedName = name;
        try {
            const response = await fetch('api.php?action=login_giat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama: name, pin: pin })
            });
            const result = await response.json();
            if (result.status !== 'success') return showToast(result.message, 'error');
            verifiedName = result.user;
        } catch (error) {
            if (!GIAT_WHITELIST.includes(name.toLowerCase()) || pin !== GIAT_DEFAULT_PIN) {
                return showToast("Nama Giat tidak terdaftar atau PIN salah!", "error");
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
    document.getElementById('nav-role-subtitle').innerText = (currentUser.role === 'dewan') ? `Dewan (${currentUser.pasukan})` : `Giat Terverifikasi`;

    document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
    if (currentUser.role === 'dewan') {
        document.getElementById('view-dashboard-dewan').classList.remove('hidden');
        document.getElementById('dewan-welcome-title').innerText = `Halo, ${currentUser.name}! 👋`;
        document.getElementById('dewan-pasukan-subtitle').innerText = `Pasukan: ${currentUser.pasukan}`;
        document.getElementById('wm-name').innerText = `${currentUser.name} (${currentUser.pasukan})`;
        loadMyDewanHistory();
    } else {
        document.getElementById('view-dashboard-giat').classList.remove('hidden');
        renderGiatTable();
    }
    if (!isSilent) showToast(`Selamat datang, ${currentUser.name}!`, 'success');
}

function logout() {
    localStorage.removeItem('ambalan_user_session');
    document.getElementById('app-navbar').classList.add('hidden');
    document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-login').classList.remove('hidden');
}

// --- RIWAYAT DEWAN ---
async function loadMyDewanHistory() {
    const historyList = document.getElementById('dewan-history-list');
    try {
        const res = await fetch(`api.php?action=get_my_history&nama=${encodeURIComponent(currentUser.name)}`);
        const json = await res.json();
        historyList.innerHTML = '';

        if (!json.data || json.data.length === 0) {
            historyList.innerHTML = `<div class="text-xs text-slate-400 text-center py-6">Belum ada riwayat absensi atau surat pengajuan izin.</div>`;
            return;
        }

        const latest = json.data[0];
        document.getElementById('dewan-status-badge-today').innerText = `${latest.status_kehadiran} (${latest.status_verifikasi})`;
        document.getElementById('dewan-status-time-today').innerText = `${latest.tanggal_kegiatan}`;

        json.data.forEach((item) => {
            currentDataMap[item.id] = item;
            const badgeCol = item.status_kehadiran === 'Hadir' ? 'text-emerald-700 bg-emerald-100' : 'text-amber-800 bg-amber-100';
            const div = document.createElement('div');
            div.className = "p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4";
            div.innerHTML = `
                <div>
                    <div class="font-bold text-slate-900 text-sm">${item.jenis_surat} — ${item.tanggal_kegiatan}</div>
                    <div class="text-xs text-slate-600 mt-1">
                        <span class="px-2 py-0.5 rounded font-bold ${badgeCol}">${item.status_kehadiran}</span>
                        <span class="ml-2 font-semibold text-slate-700">Verifikasi Giat: ${item.status_verifikasi}</span>
                    </div>
                    <div class="text-xs text-slate-500 mt-1">Alasan: ${item.keterangan || '-'}</div>
                </div>
                ${item.foto_bukti ? `<button type="button" onclick="openPhotoPreviewById(${item.id})" class="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-100 shrink-0"><i class="fa-solid fa-image text-red-600 mr-1"></i> Lihat Lampiran</button>` : ''}
            `;
            historyList.appendChild(div);
        });
    } catch (e) {
        historyList.innerHTML = `<div class="text-xs text-red-500 text-center py-4">Gagal terhubung ke database PHP.</div>`;
    }
}

// --- KAMERA ABSEN HADIR ---
function openAttendanceModal() {
    document.getElementById('modal-camera').classList.remove('hidden');
    const now = new Date();
    document.getElementById('wm-time').innerText = now.toLocaleString('id-ID');

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                currentGpsCoords = `Lat: ${pos.coords.latitude.toFixed(5)}, Long: ${pos.coords.longitude.toFixed(5)}`;
                document.getElementById('wm-gps').innerText = currentGpsCoords;
            },
            () => { document.getElementById('wm-gps').innerText = currentGpsCoords; }
        );
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(stream => { mediaStream = stream; document.getElementById('webcam-video').srcObject = stream; })
        .catch(() => {});
}

function closeCameraModal() {
    document.getElementById('modal-camera').classList.add('hidden');
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
}

async function captureAndSubmitAttendance() {
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('snapshot-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = "#1E293B";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("ABSENSI PENGIBARAN AMBALAN", 30, 240);
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;

    const res = await fetch('api.php?action=submit_absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nama: currentUser.name,
            pasukan: currentUser.pasukan,
            tanggal: dateStr,
            jam: timeStr,
            status: "Hadir",
            keterangan: "Hadir pengibaran (Kamera & GPS)",
            gps: currentGpsCoords,
            foto: canvas.toDataURL('image/jpeg', 0.7)
        })
    });
    const json = await res.json();
    if (json.status === 'success') {
        showToast(json.message, "success");
        closeCameraModal();
        loadMyDewanHistory();
    } else {
        showToast(json.message, "error");
    }
}

// --- KIRIM SURAT PENGAJUAN IZIN / SAKIT ---
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
    reader.onload = (e) => {
        document.getElementById('izin-attachment-preview-img').src = e.target.result;
        document.getElementById('izin-attachment-preview-box').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function clearIzinAttachment() {
    document.getElementById('izin-file-input').value = '';
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
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function submitIzinForm(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-izin');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...`;

    const statusIzin = document.querySelector('input[name="izin-status-radio"]:checked').value;
    const alasan = document.getElementById('izin-reason-input').value.trim();
    const fileInput = document.getElementById('izin-file-input');

    let lampiranBase64 = null;
    if (fileInput.files && fileInput.files[0]) {
        lampiranBase64 = await compressImageFile(fileInput.files[0]);
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
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
                gps: "Surat Pengajuan Mandiri (" + timeStr + ")",
                foto: lampiranBase64
            })
        });
        const json = await response.json();
        if (json.status === 'success') {
            showToast(json.message, "success");
            closeIzinModal();
            loadMyDewanHistory();
        } else {
            showToast(json.message, "error");
        }
    } catch (err) {
        showToast("Gagal mengirim surat ke database. Pastikan server XAMPP menyala.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Surat ke Giat`;
    }
}

// --- DASHBOARD GIAT: KOTAK MASUK SURAT IZIN + TABEL + EKSPOR EXCEL ---
async function renderGiatTable() {
    const selectedPasukan = document.getElementById('filter-pasukan-select').value;
    const selectedStatus  = document.getElementById('filter-status-select').value;
    const searchKeyword   = document.getElementById('search-member-input').value.toLowerCase().trim();

    const tbody = document.getElementById('giat-tbody');
    const inboxContainer = document.getElementById('giat-surat-izin-list');

    try {
        const res = await fetch(`api.php?action=get_rekap&pasukan=${encodeURIComponent(selectedPasukan)}`);
        const json = await res.json();
        const rawMembers = json.data || [];

        // 1. Render Kotak Masuk Khusus Surat Izin / Sakit
        const suratIzinList = rawMembers.filter(m => m.status_kehadiran === 'Izin' || m.status_kehadiran === 'Sakit');
        document.getElementById('badge-jumlah-surat').innerText = `${suratIzinList.length} Surat Masuk`;
        inboxContainer.innerHTML = '';

        if (suratIzinList.length === 0) {
            inboxContainer.innerHTML = `<div class="col-span-full text-xs text-amber-800 py-2">Belum ada surat pengajuan izin/sakit yang masuk.</div>`;
        } else {
            suratIzinList.forEach(s => {
                currentDataMap[s.id] = s;
                const card = document.createElement('div');
                card.className = "bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between gap-3";
                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start gap-2">
                            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${s.status_kehadiran === 'Sakit' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}">
                                Surat ${s.status_kehadiran}
                            </span>
                            <span class="text-[11px] font-bold ${s.status_verifikasi === 'Disetujui' ? 'text-emerald-600' : 'text-red-500'}">
                                ${s.status_verifikasi}
                            </span>
                        </div>
                        <div class="font-bold text-slate-900 text-sm mt-2">${s.nama_anggota}</div>
                        <div class="text-[11px] text-slate-500">${s.pasukan} • ${s.tanggal_kegiatan}</div>
                        <div class="mt-2 p-2.5 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
                            "${s.keterangan || '-'}"
                        </div>
                    </div>
                    <div class="flex gap-2 pt-1">
                        ${s.foto_bukti ? `<button type="button" onclick="openPhotoPreviewById(${s.id})" class="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs"><i class="fa-solid fa-image text-red-600 mr-1"></i> Lihat Surat</button>` : ''}
                        <button type="button" onclick="changeMemberStatus(${s.id}, '${s.status_kehadiran}')" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs">
                            <i class="fa-solid fa-check mr-1"></i> Terima Surat
                        </button>
                    </div>
                `;
                inboxContainer.appendChild(card);
            });
        }

        // 2. Filter Tabel Utama
        const filteredMembers = rawMembers.filter(m => {
            const matchStatus = (selectedStatus === 'SEMUA') || (m.status_kehadiran === selectedStatus);
            const matchName = !searchKeyword || m.nama_anggota.toLowerCase().includes(searchKeyword);
            return matchStatus && matchName;
        });

        tbody.innerHTML = '';
        let hadirCount = 0, izinSakitCount = 0, alphaCount = 0;

        filteredMembers.forEach((m) => {
            currentDataMap[m.id] = m;
            const status = m.status_kehadiran;
            if (status === 'Hadir') hadirCount++;
            else if (status === 'Izin' || status === 'Sakit') izinSakitCount++;
            else alphaCount++;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 border-b border-slate-100";
            tr.innerHTML = `
                <td class="p-4">
                    <div class="font-bold text-slate-900">${m.nama_anggota}</div>
                    <div class="text-[11px] text-slate-500">${m.pasukan} (${m.id_nis})</div>
                </td>
                <td class="p-4">
                    <div class="text-xs font-semibold text-slate-800">${m.tanggal_kegiatan}</div>
                    <div class="text-[11px] text-slate-500">Jam: ${m.jam_hadir}</div>
                </td>
                <td class="p-4">
                    <span class="text-[11px] font-bold text-slate-700 block">${m.jenis_surat}</span>
                    <span class="text-xs text-slate-600">${m.keterangan || '-'}</span>
                </td>
                <td class="p-4">
                    ${m.foto_bukti ? `<button type="button" onclick="openPhotoPreviewById(${m.id})" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-100"><i class="fa-solid fa-file-image text-red-600 mr-1"></i> Lihat Lampiran</button>` : '<span class="text-xs text-slate-400">Tidak ada</span>'}
                </td>
                <td class="p-4 text-center">
                    <div class="inline-flex rounded-xl p-1 bg-slate-100 gap-1">
                        <button type="button" onclick="changeMemberStatus(${m.id}, 'Hadir')" class="px-2.5 py-1 text-xs font-bold rounded-lg ${status === 'Hadir' ? 'bg-emerald-600 text-white' : 'text-slate-600'}">Hadir</button>
                        <button type="button" onclick="changeMemberStatus(${m.id}, 'Izin')" class="px-2.5 py-1 text-xs font-bold rounded-lg ${status === 'Izin' ? 'bg-amber-500 text-white' : 'text-slate-600'}">Izin</button>
                        <button type="button" onclick="changeMemberStatus(${m.id}, 'Sakit')" class="px-2.5 py-1 text-xs font-bold rounded-lg ${status === 'Sakit' ? 'bg-blue-600 text-white' : 'text-slate-600'}">Sakit</button>
                        <button type="button" onclick="changeMemberStatus(${m.id}, 'Alpha')" class="px-2.5 py-1 text-xs font-bold rounded-lg ${status === 'Alpha' ? 'bg-red-600 text-white' : 'text-slate-600'}">Alpha</button>
                    </div>
                    <div class="text-[10px] font-bold mt-1 ${m.status_verifikasi === 'Disetujui' ? 'text-emerald-600' : 'text-amber-600'}">
                        ${m.status_verifikasi}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('table-count-label').innerText = `Menampilkan ${filteredMembers.length} data dari database`;
        document.getElementById('stat-giat-hadir').innerText = `${hadirCount} Anggota`;
        document.getElementById('stat-giat-izin').innerText = `${izinSakitCount} Surat`;
        document.getElementById('stat-giat-alpha').innerText = `${alphaCount} Anggota`;
        const pct = filteredMembers.length > 0 ? Math.round((hadirCount / filteredMembers.length) * 100) : 0;
        document.getElementById('stat-giat-persen').innerText = `${pct}%`;

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500 text-xs font-bold">Gagal mengambil data dari database. Pastikan dibuka via http://localhost/absen-ambalan/index.html</td></tr>`;
    }
}

async function changeMemberStatus(dbId, newStatus) {
    const res = await fetch('api.php?action=update_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dbId, status: newStatus })
    });
    const json = await res.json();
    if (json.status === 'success') {
        renderGiatTable();
        showToast(json.message, 'success');
    }
}

// --- UNDUH EXCEL LANGSUNG DARI DATABASE MYSQL ---
function exportDatabaseToExcel() {
    const selectedPasukan = document.getElementById('filter-pasukan-select').value;
    const selectedStatus  = document.getElementById('filter-status-select').value;
    const url = `api.php?action=export_excel&pasukan=${encodeURIComponent(selectedPasukan)}&status=${encodeURIComponent(selectedStatus)}`;
    window.location.href = url;
    showToast("Mengunduh laporan Excel (.XLS) dari database...", "success");
}

// --- PREVIEW LAMPIRAN FOTO / SURAT ---
function openPhotoPreviewById(id) {
    const item = currentDataMap[id];
    if (!item || !item.foto_bukti) return;
    document.getElementById('preview-photo-img').src = item.foto_bukti;
    document.getElementById('preview-photo-title').innerText = `${item.jenis_surat} — ${item.nama_anggota}`;
    document.getElementById('preview-photo-subtitle').innerText = `${item.pasukan} • ${item.tanggal_kegiatan}`;
    document.getElementById('preview-photo-gps').innerText = `Alasan / Info: ${item.keterangan || item.koordinat_gps || '-'}`;
    document.getElementById('modal-photo-preview').classList.remove('hidden');
}

function closePhotoPreview() {
    document.getElementById('modal-photo-preview').classList.add('hidden');
}

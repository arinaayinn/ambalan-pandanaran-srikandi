let currentUser = { name: "", role: "", pasukan: "1. Petugas Pemimpin Pengibaran" };
let currentGpsCoords = "Lat: -7.0051, Long: 110.4381";
let currentDataMap = {};
let mediaStream = null;

function showToast(msg, type = 'success') {
    const box = document.getElementById('toast-container');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'} text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-bold pointer-events-auto`;
    el.innerText = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// Helper untuk membuka/menutup modal (mengatur flex & hidden dengan tepat)
function showModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.classList.remove('hidden');
        m.classList.add('flex');
    }
}
function hideModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.classList.add('hidden');
        m.classList.remove('flex');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tab Login Role
    document.getElementById('tab-role-giat').addEventListener('click', () => setLoginRole('giat'));
    document.getElementById('tab-role-dewan').addEventListener('click', () => setLoginRole('dewan'));

    // 2. Form Login & Quick Login
    document.getElementById('form-login').addEventListener('submit', handleLogin);
    document.getElementById('btn-quick-giat').addEventListener('click', () => {
        currentUser = { name: "Bagus Setya Danuartha", role: "giat", pasukan: "SEMUA" };
        localStorage.setItem('ambalan_user_session', JSON.stringify(currentUser));
        enterDashboard();
    });
    document.getElementById('btn-quick-dewan').addEventListener('click', () => {
        currentUser = { name: "Andika Pratama", role: "dewan", pasukan: "1. Petugas Pemimpin Pengibaran" };
        localStorage.setItem('ambalan_user_session', JSON.stringify(currentUser));
        enterDashboard();
    });
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('ambalan_user_session');
        document.getElementById('app-navbar').classList.add('hidden');
        document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
        document.getElementById('view-login').classList.remove('hidden');
    });

    // 3. TOMBOL & FORMULIR IZIN (DIJAMIN BISA DITEKAN)
    document.getElementById('btn-open-izin').addEventListener('click', () => {
        document.getElementById('form-pengajuan-izin').reset();
        showModal('modal-izin');
    });
    document.getElementById('btn-close-izin').addEventListener('click', () => hideModal('modal-izin'));
    document.getElementById('btn-cancel-izin').addEventListener('click', () => hideModal('modal-izin'));
    document.getElementById('form-pengajuan-izin').addEventListener('submit', handleIzinSubmit);

    // 4. Tombol Kamera Hadir
    document.getElementById('btn-open-camera').addEventListener('click', openCameraModal);
    document.getElementById('btn-close-camera').addEventListener('click', closeCameraModal);
    document.getElementById('btn-cancel-camera').addEventListener('click', closeCameraModal);
    document.getElementById('btn-capture-submit').addEventListener('click', captureAndSubmitAttendance);

    // 5. Tombol Refresh & Ekspor Excel Giat
    document.getElementById('btn-refresh-dewan').addEventListener('click', loadMyDewanHistory);
    document.getElementById('btn-refresh-giat').addEventListener('click', renderGiatTable);
    document.getElementById('btn-export-excel').addEventListener('click', () => {
        const p = document.getElementById('filter-pasukan-select').value;
        const s = document.getElementById('filter-status-select').value;
        window.location.href = `api.php?action=export_excel&pasukan=${encodeURIComponent(p)}&status=${encodeURIComponent(s)}`;
    });

    // 6. Filter Giat & Modal Preview
    document.getElementById('filter-pasukan-select').addEventListener('change', renderGiatTable);
    document.getElementById('filter-status-select').addEventListener('change', renderGiatTable);
    document.getElementById('search-member-input').addEventListener('keyup', renderGiatTable);
    document.getElementById('btn-close-preview').addEventListener('click', () => hideModal('modal-photo-preview'));

    // Cek Sesi Tersimpan
    const saved = localStorage.getItem('ambalan_user_session');
    if (saved) {
        currentUser = JSON.parse(saved);
        enterDashboard();
    }
});

function setLoginRole(role) {
    document.getElementById('login-role-input').value = role;
    const isGiat = (role === 'giat');
    document.getElementById('tab-role-giat').className = isGiat ? "py-3 px-4 text-sm font-bold rounded-xl bg-white text-red-600 shadow-sm" : "py-3 px-4 text-sm font-bold rounded-xl text-slate-600";
    document.getElementById('tab-role-dewan').className = !isGiat ? "py-3 px-4 text-sm font-bold rounded-xl bg-white text-red-600 shadow-sm" : "py-3 px-4 text-sm font-bold rounded-xl text-slate-600";
    document.getElementById('group-giat-pin').classList.toggle('hidden', !isGiat);
    document.getElementById('group-pasukan-select').classList.toggle('hidden', isGiat);
    document.getElementById('login-label-name').innerText = isGiat ? "Nama Giat (Terdaftar)" : "Nama Lengkap Dewan";
    document.getElementById('login-username').value = isGiat ? "Bagus Setya Danuartha" : "Andika Pratama";
}

async function handleLogin(e) {
    e.preventDefault();
    const role = document.getElementById('login-role-input').value;
    const nama = document.getElementById('login-username').value.trim();
    const pin  = document.getElementById('login-pin').value.trim();
    const pasukan = document.getElementById('login-class').value;

    if (role === 'giat') {
        try {
            const fd = new FormData();
            fd.append('nama', nama);
            fd.append('pin', pin);
            const res = await fetch('api.php?action=login_giat', { method: 'POST', body: fd });
            const json = await res.json();
            if (json.status !== 'success') return showToast(json.message, 'error');
            currentUser = { name: json.user, role: 'giat', pasukan: 'SEMUA' };
        } catch (err) {
            return showToast("Gagal terhubung ke api.php. Pastikan dibuka lewat http://localhost/", "error");
        }
    } else {
        currentUser = { name: nama, role: 'dewan', pasukan: pasukan };
    }

    localStorage.setItem('ambalan_user_session', JSON.stringify(currentUser));
    enterDashboard();
}

function enterDashboard() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('app-navbar').classList.remove('hidden');
    document.getElementById('nav-user-name').innerText = currentUser.name;
    document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));

    if (currentUser.role === 'dewan') {
        document.getElementById('view-dashboard-dewan').classList.remove('hidden');
        document.getElementById('dewan-welcome-title').innerText = `Halo, ${currentUser.name}!`;
        document.getElementById('dewan-pasukan-subtitle').innerText = `Pasukan: ${currentUser.pasukan}`;
        loadMyDewanHistory();
    } else {
        document.getElementById('view-dashboard-giat').classList.remove('hidden');
        renderGiatTable();
    }
}

// --- KIRIM FORMULIR IZIN KE DATABASE & GIAT ---
async function handleIzinSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-izin');
    btn.disabled = true;
    btn.innerText = "Mengirim ke Database...";

    const statusIzin = document.getElementById('izin-status-select').value;
    const alasan = document.getElementById('izin-reason-input').value.trim();
    const fileInput = document.getElementById('izin-file-input');

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;

    const formData = new FormData();
    formData.append('nama', currentUser.name);
    formData.append('pasukan', currentUser.pasukan);
    formData.append('tanggal', dateStr);
    formData.append('jam', '-');
    formData.append('status', statusIzin);
    formData.append('keterangan', alasan);
    formData.append('gps', `Surat Izin Mandiri (${timeStr})`);

    if (fileInput.files && fileInput.files[0]) {
        formData.append('file_surat', fileInput.files[0]);
    }

    try {
        const res = await fetch('api.php?action=submit_absen', {
            method: 'POST',
            body: formData
        });
        const json = await res.json();

        if (json.status === 'success') {
            showToast(json.message, 'success');
            hideModal('modal-izin');
            loadMyDewanHistory();
        } else {
            showToast("Gagal: " + json.message, 'error');
        }
    } catch (err) {
        showToast("Error Koneksi! Pastikan URL browser diawali http://localhost/", 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane mr-1"></i> Kirim Surat Izin`;
    }
}

// --- RIWAYAT DEWAN ---
async function loadMyDewanHistory() {
    const list = document.getElementById('dewan-history-list');
    try {
        const res = await fetch(`api.php?action=get_my_history&nama=${encodeURIComponent(currentUser.name)}`);
        const json = await res.json();
        list.innerHTML = '';

        if (!json.data || json.data.length === 0) {
            list.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Belum ada riwayat absensi atau surat izin.</p>`;
            return;
        }

        document.getElementById('dewan-status-badge-today').innerText = `${json.data[0].status_kehadiran} (${json.data[0].status_verifikasi})`;

        json.data.forEach(item => {
            currentDataMap[item.id] = item;
            const div = document.createElement('div');
            div.className = "p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center gap-3";
            div.innerHTML = `
                <div>
                    <div class="font-bold text-sm text-slate-900">${item.jenis_surat} — ${item.tanggal_kegiatan}</div>
                    <div class="text-xs text-slate-600 mt-1">Status: <b>${item.status_kehadiran}</b> • Verifikasi Giat: <b>${item.status_verifikasi}</b></div>
                    <div class="text-xs text-slate-500 mt-0.5">Alasan: ${item.keterangan || '-'}</div>
                </div>
                ${item.foto_bukti ? `<button type="button" onclick="openPreview(${item.id})" class="px-3 py-2 bg-white border rounded-xl text-xs font-bold cursor-pointer">Lihat Lampiran</button>` : ''}
            `;
            list.appendChild(div);
        });
    } catch (e) {
        list.innerHTML = `<p class="text-xs text-red-500 text-center py-4">Gagal terhubung ke database PHP.</p>`;
    }
}

// --- KAMERA HADIR ---
function openCameraModal() {
    showModal('modal-camera');
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(pos => {
            currentGpsCoords = `Lat: ${pos.coords.latitude.toFixed(5)}, Long: ${pos.coords.longitude.toFixed(5)}`;
            document.getElementById('wm-gps').innerText = currentGpsCoords;
        });
    }
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(s => { mediaStream = s; document.getElementById('webcam-video').srcObject = s; })
        .catch(() => {});
}

function closeCameraModal() {
    hideModal('modal-camera');
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
}

async function captureAndSubmitAttendance() {
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('snapshot-canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (video.readyState >= 2) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    else { ctx.fillStyle = "#1e293b"; ctx.fillRect(0, 0, canvas.width, canvas.height); }

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;

    const fd = new FormData();
    fd.append('nama', currentUser.name);
    fd.append('pasukan', currentUser.pasukan);
    fd.append('tanggal', dateStr);
    fd.append('jam', timeStr);
    fd.append('status', 'Hadir');
    fd.append('keterangan', 'Hadir pengibaran (Kamera GPS)');
    fd.append('gps', currentGpsCoords);
    fd.append('foto', canvas.toDataURL('image/jpeg', 0.7));

    const res = await fetch('api.php?action=submit_absen', { method: 'POST', body: fd });
    const json = await res.json();
    if (json.status === 'success') {
        showToast(json.message, 'success');
        closeCameraModal();
        loadMyDewanHistory();
    } else {
        showToast(json.message, 'error');
    }
}

// --- DASHBOARD GIAT ---
async function renderGiatTable() {
    const pasukan = document.getElementById('filter-pasukan-select').value;
    const statusFilter = document.getElementById('filter-status-select').value;
    const search = document.getElementById('search-member-input').value.toLowerCase().trim();

    const tbody = document.getElementById('giat-tbody');
    const inbox = document.getElementById('giat-surat-izin-list');

    try {
        const res = await fetch(`api.php?action=get_rekap&pasukan=${encodeURIComponent(pasukan)}`);
        const json = await res.json();
        const allData = json.data || [];

        // Kotak Masuk Surat Izin
        const suratList = allData.filter(d => d.status_kehadiran === 'Izin' || d.status_kehadiran === 'Sakit');
        document.getElementById('badge-jumlah-surat').innerText = `${suratList.length} Surat Masuk`;
        inbox.innerHTML = suratList.length === 0
            ? `<p class="text-xs text-amber-800 col-span-full">Belum ada surat izin/sakit masuk.</p>`
            : '';

        suratList.forEach(s => {
            currentDataMap[s.id] = s;
            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between gap-3";
            card.innerHTML = `
                <div>
                    <div class="flex justify-between text-xs font-bold">
                        <span class="text-amber-700">${s.jenis_surat}</span>
                        <span class="${s.status_verifikasi === 'Disetujui' ? 'text-emerald-600' : 'text-red-500'}">${s.status_verifikasi}</span>
                    </div>
                    <div class="font-bold text-slate-900 text-sm mt-1">${s.nama_anggota}</div>
                    <div class="text-[11px] text-slate-500">${s.pasukan} • ${s.tanggal_kegiatan}</div>
                    <div class="mt-2 p-2.5 bg-slate-50 rounded-xl text-xs text-slate-700">"${s.keterangan || '-'}"</div>
                </div>
                <div class="flex gap-2">
                    ${s.foto_bukti ? `<button type="button" onclick="openPreview(${s.id})" class="flex-1 py-2 bg-slate-100 font-bold rounded-xl text-xs cursor-pointer">Lihat Surat</button>` : ''}
                    <button type="button" onclick="verifyStatus(${s.id}, '${s.status_kehadiran}')" class="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs cursor-pointer">Terima Surat</button>
                </div>
            `;
            inbox.appendChild(card);
        });

        // Tabel Utama
        const filtered = allData.filter(m => {
            const matchS = (statusFilter === 'SEMUA') || (m.status_kehadiran === statusFilter);
            const matchN = !search || m.nama_anggota.toLowerCase().includes(search);
            return matchS && matchN;
        });

        document.getElementById('table-count-label').innerText = `${filtered.length} data dari database`;
        tbody.innerHTML = '';

        filtered.forEach(m => {
            currentDataMap[m.id] = m;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-4"><div class="font-bold text-slate-900">${m.nama_anggota}</div><div class="text-xs text-slate-500">${m.pasukan}</div></td>
                <td class="p-4 text-xs"><div>${m.tanggal_kegiatan}</div><div class="text-slate-500">${m.jam_hadir}</div></td>
                <td class="p-4 text-xs"><div class="font-bold">${m.jenis_surat}</div><div class="text-slate-600">${m.keterangan || '-'}</div></td>
                <td class="p-4">${m.foto_bukti ? `<button type="button" onclick="openPreview(${m.id})" class="px-3 py-1.5 border rounded-xl text-xs font-bold cursor-pointer">Lihat Lampiran</button>` : '-'}</td>
                <td class="p-4 text-center">
                    <div class="inline-flex bg-slate-100 p-1 rounded-xl gap-1">
                        ${['Hadir','Izin','Sakit','Alpha'].map(st => `
                            <button type="button" onclick="verifyStatus(${m.id}, '${st}')" class="px-2 py-1 text-xs font-bold rounded-lg cursor-pointer ${m.status_kehadiran === st ? 'bg-red-600 text-white' : 'text-slate-600'}">${st}</button>
                        `).join('')}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500 text-xs font-bold">Gagal mengambil data dari database. Pastikan dibuka via http://localhost/</td></tr>`;
    }
}

async function verifyStatus(id, status) {
    const fd = new FormData();
    fd.append('id', id);
    fd.append('status', status);
    const res = await fetch('api.php?action=update_status', { method: 'POST', body: fd });
    const json = await res.json();
    if (json.status === 'success') {
        showToast(json.message, 'success');
        renderGiatTable();
    }
}

function openPreview(id) {
    const item = currentDataMap[id];
    if (!item || !item.foto_bukti) return;
    document.getElementById('preview-photo-img').src = item.foto_bukti;
    document.getElementById('preview-photo-title').innerText = `${item.jenis_surat} — ${item.nama_anggota}`;
    document.getElementById('preview-photo-desc').innerText = `Alasan: ${item.keterangan || '-'}`;
    showModal('modal-photo-preview');
}

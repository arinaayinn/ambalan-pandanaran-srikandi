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

// --- GLOBAL APP STATE ---
let currentUser = {
    name: "Bagus Setya Danuartha",
    role: "giat",
    pasukan: "1. Petugas Pemimpin Pengibaran",
    idNum: "GIAT-01",
    avatar: "BS"
};

let attendanceData = {
    todayStatus: false,
    timeHadir: null,
    photoUrl: null,
    history: [
        { date: "Jumat, 13 Nov 2026", type: "Absen Hadir Pengibaran", status: "Hadir", time: "06:45 WIB", photo: "https://placehold.co/400x300/dc2626/ffffff?text=Jumat+13+Nov" }
    ]
};

let pasukanMembersData = {
    "1. Petugas Pemimpin Pengibaran": [
        { id: 1, name: "Andika Pratama", id_nis: "DEW-P01", jam_hadir: "06:45 WIB", status_kehadiran: "Hadir", foto_bukti: "https://placehold.co/400x300/dc2626/ffffff?text=Andika" },
        { id: 2, name: "Siti Rahma", id_nis: "DEW-P02", jam_hadir: "06:48 WIB", status_kehadiran: "Hadir", foto_bukti: "https://placehold.co/400x300/dc2626/ffffff?text=Siti" }
    ],
    "2. Petugas Pengibaran": [
        { id: 3, name: "Rezky Mahendra", id_nis: "DEW-K01", jam_hadir: "06:42 WIB", status_kehadiran: "Hadir", foto_bukti: "https://placehold.co/400x300/dc2626/ffffff?text=Rezky" },
        { id: 4, name: "Dewi Lestari", id_nis: "DEW-K02", jam_hadir: "06:52 WIB", status_kehadiran: "Hadir", foto_bukti: "https://placehold.co/400x300/dc2626/ffffff?text=Dewi" },
        { id: 5, name: "Joko Santoso", id_nis: "DEW-K03", jam_hadir: "-", status_kehadiran: "Izin", foto_bukti: null }
    ],
    "3. Peserta": [
        { id: 6, name: "Mega Wati", id_nis: "DEW-S01", jam_hadir: "06:35 WIB", status_kehadiran: "Hadir", foto_bukti: "https://placehold.co/400x300/dc2626/ffffff?text=Mega" }
    ]
};

let mediaStream = null;
let schoolChartInstance = null;
let schoolDonutInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    renderCalendarDays();
});

// --- TOAST NOTIFICATION ---
function showToast(message, type = 'success') {
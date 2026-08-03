/**
 * JAKALELANA B2B Package Builder - App Logic (Live API Version)
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbxlfvaNmMErW72FNekV0iVBm7J-tti_jidPnMNggQEqpaaFve_ud2lZsEHtDdRbkB-l1Q/exec';

// --- State Management ---
const state = {
    user: JSON.parse(localStorage.getItem('jkl_user')) || null,
    vendors: {
        transport: [],
        hotel: [],
        resto: [],
        ticket: [],
        other: []
    },
    packages: [],
    ticketMeta: [] // Untuk rekomendasi auto-fill kategori & deskripsi
};

// Helper Format Tanggal
function getTodayDate() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    let str = String(dateStr);
    if (str.includes('/')) return str;
    try {
        const d = new Date(str);
        if (isNaN(d.getTime())) return str;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch (e) {
        return str;
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();

    // Deteksi URL yang lebih fleksibel (mendukung Clean URLs Cloudflare)
    if (path.includes('admin')) {
        if (!checkAuth('admin')) return;
        initAdmin();
    } else if (path.includes('vendor')) {
        if (!checkAuth('vendor')) return;
        initVendor();
    } else {
        // Jika bukan admin dan vendor (root, index, dsb), jalankan Login
        initLogin();
    }

    // Common Listeners
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('jkl_user');
            window.location.href = '/'; // Mengembalikan pengguna ke root domain (halaman login)
        });
    }
});

// --- API Helper ---
async function apiPost(action, data = {}) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, ...data }),
            redirect: 'follow', // Pastikan mengikuti redirect dari GAS
            credentials: 'omit' // Mencegah bug 404 jika user login >1 akun Google
        });

        // Cek jika response bukan JSON (misal kena blokir atau error HTML)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            console.error("API tidak mengembalikan JSON. Response:", await response.text());
            return { success: false, message: "Terjadi kesalahan server (Response bukan JSON). Cek Deployment API Google Apps Script Anda." };
        }

        return await response.json();
    } catch (error) {
        console.error("Fetch API Error:", error);
        return { success: false, message: "Koneksi ke server gagal. " + error.message };
    }
}

async function apiGet(action, params = {}) {
    try {
        const url = new URL(API_URL);
        url.searchParams.append('action', action);
        for (const key in params) {
            url.searchParams.append(key, params[key]);
        }
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            credentials: 'omit'
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            console.error("API tidak mengembalikan JSON. Response:", await response.text());
            return { success: false, message: "Terjadi kesalahan server (Response bukan JSON). Cek Deployment API Google Apps Script Anda." };
        }

        return await response.json();
    } catch (error) {
        console.error("Fetch API Error:", error);
        return { success: false, message: "Koneksi ke server gagal. " + error.message };
    }
}

// --- Auth Protection ---
function checkAuth(requiredRole) {
    if (!state.user) {
        window.location.href = 'index.html';
        return false;
    }
    if (state.user.role !== requiredRole) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// --- Page: Login ---
function initLogin() {
    if (state.user) {
        window.location.href = state.user.role === 'admin' ? 'admin.html' : 'vendor.html';
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('loginBtn');
            const userInp = document.getElementById('username').value;
            const passInp = document.getElementById('password').value;
            const errBox = document.getElementById('loginError');

            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Memuat...';
            btn.disabled = true;
            errBox.classList.add('hidden');

            try {
                const res = await apiPost('login', { username: userInp, password: passInp });

                if (res.success && res.data) {
                    localStorage.setItem('jkl_user', JSON.stringify(res.data));
                    window.location.href = res.data.role === 'admin' ? 'admin.html' : 'vendor.html';
                } else {
                    errBox.classList.remove('hidden');
                    errBox.querySelector('span').textContent = res.message || 'Kredensial tidak valid';
                }
            } catch (err) {
                console.error(err);
                errBox.classList.remove('hidden');
                errBox.querySelector('span').textContent = 'Terjadi kesalahan koneksi. Cek jaringan atau URL API.';
            } finally {
                btn.innerHTML = '<span>Masuk Sekarang</span><i class="ph ph-arrow-right"></i>';
                btn.disabled = false;
            }
        });
    }
}

// --- Page: Admin ---
function initAdmin() {
    document.getElementById('userNameDisplay').textContent = state.user.name;

    // Navigation (Admin)
    document.querySelectorAll('.sidebar-nav .nav-item[data-target]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            const target = item.getAttribute('data-target');
            const targetView = document.getElementById('view-' + target);

            // FIX: Cegah JS Error jika elemen view/target tidak ada di HTML
            if (!targetView) return;

            document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.view-section').forEach(v => {
                v.style.display = 'none';
                v.classList.remove('active');
            });

            targetView.style.display = 'block';

            const titleEl = document.getElementById('pageTitle');
            if (titleEl) titleEl.textContent = item.textContent.trim();

            // FIX: Auto close mobile sidebar & hapus overlay gelap
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                if (sidebar) sidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
            }
        });
    });

    // Tunggu data vendor dan paket dimuat agar fallback pencarian ID log berfungsi
    Promise.all([
        loadLiveVendorData(),
        loadPackagesData()
    ]).then(() => {
        loadLogsData();
        // Mulai polling real-time di background setelah inisialisasi selesai
        startDataPolling();
    });

    document.getElementById('pkgMepo').addEventListener('input', populateBuilderSelects);
    document.getElementById('pkgDest').addEventListener('input', populateBuilderSelects);
    document.getElementById('pkgDest').addEventListener('input', autoFillBaliCosts);

    // Auto-fill Hotel Pax based on Vendor Data
    document.getElementById('pkgHotel').addEventListener('change', (e) => {
        const hid = e.target.value;
        const paxInput = document.getElementById('pkgHotelPaxPerRoom');
        if (!hid) {
            paxInput.value = '';
            return;
        }
        const h = state.vendors.hotel.find(x => x.ID === hid);
        if (h && h.Pax_Per_Room) {
            paxInput.value = h.Pax_Per_Room;
        }
    });

    const calcBtn = document.getElementById('calculateBtn');
    calcBtn.addEventListener('click', calculatePackageCost);

    const saveBtn = document.getElementById('savePackageBtn');
    saveBtn.addEventListener('click', savePackageData);

    // Ticket checkboxes used instead of addTicketBtn

    // Vendor Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderAdminVendorTable(btn.getAttribute('data-cat'));
        });
    });
}

// --- Removed Deep Compare Logic ---
function formatPrice(val) {
    return 'Rp ' + parseInt(val || 0).toLocaleString('id-ID');
}

let lastVendorHash = "";
async function loadLiveVendorData(isPolling = false) {
    try {
        const res = await apiGet('getVendors', {
            category: 'all',
            role: state.user.role,
            username: state.user.username
        });
        if (res.success) {
            const newHash = JSON.stringify(res.data);
            if (isPolling && lastVendorHash && newHash !== lastVendorHash) {
                // Reload UI Data automatically
                state.vendors = res.data;
                populateBuilderSelects();
                const activeTab = document.querySelector('.tab-btn.active');
                const cat = activeTab ? activeTab.getAttribute('data-cat') : 'transport';
                if (typeof renderAdminVendorTable === 'function') renderAdminVendorTable(cat);
                if (typeof renderVendorTable === 'function') renderVendorTable(cat);
            } else if (!isPolling) {
                state.vendors = res.data;
                populateBuilderSelects();
                if (typeof renderAdminVendorTable === 'function') renderAdminVendorTable('transport');
                if (typeof renderVendorTable === 'function') renderVendorTable('transport');
                if (document.getElementById('vendorLoading')) document.getElementById('vendorLoading').style.display = 'none';
            }
            lastVendorHash = newHash;
        }
    } catch (e) {
        if (!isPolling) {
            console.error("Gagal memuat data", e);
            if (document.getElementById('vendorLoading')) {
                document.getElementById('vendorLoading').innerHTML = '<span style="color:var(--danger)">Gagal memuat data dari server</span>';
            }
        }
    }
}

async function loadPackagesData(isPolling = false) {
    try {
        const res = await apiGet('getPackages');
        if (res.success) {
            state.packages = res.data || [];
            if (typeof renderAdminPackageTable === 'function') renderAdminPackageTable();
        }
    } catch (e) {
        if (!isPolling) console.error("Gagal memuat paket", e);
    }
}

// Start auto-polling every 30 seconds
const notifSound = new Audio('assets/notification.mp3');
let lastLogCount = 0;

function getActionDataFromLog(log) {
    const aksiLower = log.Aksi.toLowerCase();
    
    // 1. Cek jika ini adalah aksi Paket
    if (aksiLower.includes('paket')) {
        // Contoh detail baru: "Merubah paket: Paket Hemat Bali (PKG-001)"
        // Ekstrak ID (contoh: PKG-001)
        const idMatch = log.Detail.match(/\((PKG-\d+)\)/i);
        if (idMatch && idMatch[1]) {
            return { type: 'package', id: idMatch[1].trim() };
        }
        
        // Fallback pencarian nama lama jika log dibuat sebelum fitur log ID ditambahkan
        let nameMatch = log.Detail.match(/(?:Merubah paket|Menambahkan paket baru|Menghapus paket):?\s+(.+?)(?=:|$)/i);
        if (nameMatch && nameMatch[1]) {
            // Karena nama paket lama kadang masih menempel dengan "(PKG-xxx)", bersihkan
            const name = nameMatch[1].replace(/\(PKG-\d+\)/i, '').trim().toLowerCase();
            if (state.packages) {
                const pkgObj = state.packages.find(p => p.Package_Name && p.Package_Name.toLowerCase() === name);
                if (pkgObj) {
                    return { type: 'package', id: pkgObj.ID };
                }
            }
        }
        
        return { type: 'package', id: null };
    }

    // 2. Cek jika ini adalah aksi Vendor
    let cat = '';
    if (aksiLower.includes('transport')) cat = 'transport';
    else if (aksiLower.includes('hotel')) cat = 'hotel';
    else if (aksiLower.includes('resto')) cat = 'resto';
    else if (aksiLower.includes('ticket')) cat = 'ticket';
    else if (aksiLower.includes('other') || aksiLower.includes('jasa lainnya')) cat = 'other';
    
    if (cat) {
        // Karena backend sekarang mencatat ID, e.g. "Merubah GGrand Lembang (Twin) (H-HTL-001): ..."
        // Cari pola ID resmi seperti H-HTL-001, T-TRS-001, dll
        const idMatch = log.Detail.match(/\(([A-Z]+-[A-Z]+-\d+)\)/i);
        if (idMatch && idMatch[1]) {
            return { type: 'vendor', cat: cat, id: idMatch[1].trim() };
        }
        
        // Fallback pencarian nama lama jika log dibuat sebelum fitur log ID ditambahkan
        // Ini akan menangkap semua teks setelah "Merubah" dan sebelum ":" 
        let nameMatch = log.Detail.match(/(?:Merubah|Menambahkan layanan baru:|Menghapus layanan:)\s+(.+?)(?=:|$)/i);
        if (nameMatch && nameMatch[1]) {
            let name = nameMatch[1].trim().toLowerCase();
            if (state.vendors && state.vendors[cat]) {
                const vendorObj = state.vendors[cat].find(v => v.Name && v.Name.toLowerCase() === name);
                if (vendorObj) {
                    return { type: 'vendor', cat: cat, id: vendorObj.ID };
                }
            }
        }
        
        // Fallback: pindah ke tab kategori terkait meski tidak nemu spesifik barisnya
        return { type: 'vendor', cat: cat, id: null };
    }
    
    return null;
}

async function loadLogsData(isPolling = false) {
    if (!state.user || state.user.role !== 'admin') return;
    try {
        const res = await apiGet('getLogs');
        if (res.success) {
            const logs = res.data || [];

            // Check for new logs
            if (isPolling && lastLogCount > 0 && logs.length > lastLogCount) {
                const newCount = logs.length - lastLogCount;
                const newLogs = logs.slice(0, newCount); // since backend returns reversed (newest first)

                newLogs.forEach(log => {
                    const actionData = getActionDataFromLog(log);
                    addNotification(`🔔 <b>${log.Aktor}</b> melakukan <i>${log.Aksi}</i>: ${log.Detail}`, true, actionData);
                });

                // Play sound
                notifSound.play().catch(e => console.error("Auto-play sound prevented:", e));
            } else if (!isPolling && logs.length > 0) {
                // Initial load: show latest 5 logs in dropdown
                const recentLogs = logs.slice(0, 5);
                recentLogs.reverse().forEach(log => {
                    const actionData = getActionDataFromLog(log);
                    addNotification(`🔔 <b>${log.Aktor}</b> melakukan <i>${log.Aksi}</i>: ${log.Detail}`, true, actionData);
                });
                // Sembunyikan badge red dot karena ini hanya histori
                const badge = document.getElementById('notifBadge');
                if (badge) badge.style.display = 'none';
            }

            lastLogCount = logs.length;
            renderAdminLogsTable(logs);
        }
    } catch (e) {
        console.error("Gagal memuat logs", e);
    }
}

function formatLogTime(isoString) {
    try {
        const d = new Date(isoString);
        if (isNaN(d)) return isoString;
        const opts = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        return d.toLocaleDateString('id-ID', opts).replace(',', ' •');
    } catch (e) {
        return isoString;
    }
}

function renderAdminLogsTable(logs) {
    const tbody = document.querySelector('#adminLogsTable tbody');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center">Belum ada aktivitas.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(l => `<tr>
        <td><span style="color:var(--text-muted);font-size:0.8rem">${formatLogTime(l.Waktu)}</span></td>
        <td><strong>${l.Aktor}</strong></td>
        <td><span class="badge" style="background:var(--accent-primary);color:var(--bg-primary);padding:2px 8px;border-radius:12px;font-size:0.75rem;">${l.Aksi}</span></td>
        <td>${l.Detail}</td>
    </tr>`).join('');
}

// --- Data Polling Architecture ---
let isPollingLogs = false;
async function pollLogsRealtime() {
    if (state && state.user && state.user.role === 'admin' && !isPollingLogs) {
        isPollingLogs = true;
        await loadLogsData(true);
        isPollingLogs = false;
    }
    setTimeout(pollLogsRealtime, 5000);
}

function startDataPolling() {
    // Polling cepat (5 detik) untuk logs (real-time feeling) khusus admin
    if (state && state.user && state.user.role === 'admin') {
        setTimeout(pollLogsRealtime, 5000);
    }
    
    // Polling standar (30 detik) untuk data vendor & paket
    setInterval(() => {
        if (state && state.user) {
            loadLiveVendorData(true);
            if (state.user.role === 'admin') {
                if (typeof loadPackagesData === 'function') loadPackagesData(true);
            }
        }
    }, 30000);
}

function renderAdminPackageTable() {
    const tbody = document.querySelector('#adminPackageTable tbody');
    if (!tbody) return;
    if (state.packages.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Belum ada paket yang tersimpan.</td></tr>`;
        return;
    }

    tbody.innerHTML = state.packages.map(p => `<tr id="package-row-${p.ID}">
        <td><span style="font-size:0.8rem; color:var(--text-muted)">${p.ID}</span></td>
        <td><strong>${p.Package_Name}</strong></td>
        <td>${p.Total_Pax}</td>
        <td>Rp ${parseInt(p.Total_Real_Cost || 0).toLocaleString('id-ID')}</td>
        <td>Rp ${parseInt(p.Selling_Price || 0).toLocaleString('id-ID')}</td>
        <td style="color:var(--success)">Rp ${parseInt(p.Total_Profit || 0).toLocaleString('id-ID')}</td>
        <td>
            <button class="btn-icon" onclick="deletePackage('${p.ID}')" title="Hapus Paket"><i class="ph ph-trash" style="color:var(--danger)"></i></button>
        </td>
    </tr>`).join('');
}

window.deletePackage = async function (id) {
    if (!confirm('Yakin ingin menghapus paket ini?')) return;
    try {
        const res = await apiPost('deletePackage', { id: id });
        if (res.success) {
            alert('Paket berhasil dihapus');
            loadPackagesData();
        } else {
            alert('Gagal: ' + res.message);
        }
    } catch (e) {
        alert('Kesalahan jaringan');
    }
}

function getRouteCities(mepo, dest) {
    if (!mepo && !dest) return [];
    const m = mepo.toLowerCase().trim();
    const d = dest.toLowerCase().trim();

    // Default cities are just mepo and dest
    let cities = [];
    if (m) cities.push(m);
    if (d) cities.push(d);

    // Static Routes Dictionary (Jatim - Bali common routes)
    if ((m === 'sidoarjo' || m === 'surabaya') && d === 'bali') {
        cities.push('pasuruan', 'probolinggo', 'situbondo', 'banyuwangi', 'ketapang', 'gilimanuk');
    } else if ((m === 'sidoarjo' || m === 'surabaya') && d === 'jogja') {
        cities.push('mojokerto', 'jombang', 'ngawi', 'madiun', 'solo');
    } else if ((m === 'sidoarjo' || m === 'surabaya') && d === 'malang') {
        cities.push('pasuruan', 'lawang', 'singosari');
    }

    return [...new Set(cities)]; // Return unique cities
}

function filterByRegion(arr, regions) {
    if (!regions || regions.length === 0) return arr;
    return arr.filter(item => {
        if (!item.Location) return false;
        const loc = item.Location.toLowerCase();
        if (loc === 'semua' || loc === 'all') return true;
        return regions.some(r => loc.includes(r));
    });
}

function autoFillBaliCosts() {
    const dest = document.getElementById('pkgDest').value.toLowerCase().trim();
    const crossInput = document.getElementById('pkgCrossCost');

    if (dest.includes('bali')) {
        if (crossInput) crossInput.value = 1800000;
    } else {
        if (crossInput) crossInput.value = 0;
    }
}

function populateBuilderSelects() {
    const mepo = document.getElementById('pkgMepo').value.trim();
    const dest = document.getElementById('pkgDest').value.trim();

    const routeCities = getRouteCities(mepo, dest);

    // Transport uses Mepo
    const transportData = filterByRegion(state.vendors.transport || [], mepo ? [mepo.toLowerCase()] : []);
    const selTransport = document.getElementById('pkgTransport');
    selTransport.innerHTML = '<option value="">Pilih Armada Transportasi</option>' + transportData.map(t => `<option value="${t.ID}">${t.Name} (${t.Vendor_Name}) - Rp ${parseInt(t.Price_Per_Day).toLocaleString('id-ID')}/hari</option>`).join('');

    // Hotel uses Dest
    const hotelData = filterByRegion(state.vendors.hotel || [], dest ? [dest.toLowerCase()] : []);
    const selHotel = document.getElementById('pkgHotel');
    selHotel.innerHTML = '<option value="">Tanpa Menginap</option>' + hotelData.map(h => `<option value="${h.ID}">${h.Name} (${h.Vendor_Name}) - Rp ${parseInt(h.Price_Per_Room).toLocaleString('id-ID')}/kamar</option>`).join('');

    // Resto uses Route Cities (Mepo, Dest, and in-between)
    const mealData = filterByRegion(state.vendors.resto || [], routeCities);
    const selMeal = document.getElementById('pkgMeal');
    selMeal.innerHTML = '<option value="">Tanpa Konsumsi</option>' + mealData.map(r => `<option value="${r.ID}">${r.Name} (${r.Vendor_Name}) - Rp ${parseInt(r.Price_Per_Pax).toLocaleString('id-ID')}/orang</option>`).join('');

    // Update Ticket Checkboxes
    const ticketData = filterByRegion(state.vendors.ticket || [], dest ? [dest.toLowerCase()] : []);
    const ticketContainer = document.getElementById('pkgTicketCheckboxes');
    if (ticketContainer) {
        // Group by Name, keep lowest price
        const grouped = {};
        ticketData.forEach(t => {
            const name = t.Name.trim();
            const price = parseInt(t.Price_Per_Pax);
            if (!grouped[name] || price < parseInt(grouped[name].Price_Per_Pax)) {
                grouped[name] = t;
            }
        });
        ticketContainer.innerHTML = Object.values(grouped).map(t => `
            <label class="checkbox-item" data-name="${(t.Name || '').toLowerCase()}">
                <input type="checkbox" class="ticket-checkbox" value="${t.ID}" data-price="${t.Price_Per_Pax}">
                ${t.Name} - Harga Termurah: Rp ${parseInt(t.Price_Per_Pax).toLocaleString('id-ID')}
            </label>
        `).join('');
    }

    // Other Services (Guide, Banner, dll)
    const otherData = filterByRegion(state.vendors.other || [], routeCities);
    const otherContainer = document.getElementById('pkgOtherCheckboxes');
    if (otherContainer) {
        otherContainer.innerHTML = otherData.map(o => `
            <label class="checkbox-item" data-name="${(o.Name || '').toLowerCase()}">
                <input type="checkbox" class="other-checkbox" value="${o.ID}" data-price="${o.Price}" data-unit="${o.Unit}">
                ${o.Name} - Rp ${parseInt(o.Price).toLocaleString('id-ID')} / ${o.Unit}
            </label>
        `).join('');
    }
}

window.filterPkgOther = function () {
    const term = document.getElementById('pkgOtherSearch').value.toLowerCase();
    const items = document.querySelectorAll('#pkgOtherCheckboxes .checkbox-item');
    items.forEach(item => {
        const text = item.getAttribute('data-name') || '';
        if (text.includes(term)) item.style.display = 'block';
        else item.style.display = 'none';
    });
}

window.filterPkgTicket = function () {
    const term = document.getElementById('pkgTicketSearch').value.toLowerCase();
    const items = document.querySelectorAll('#pkgTicketCheckboxes .checkbox-item');
    items.forEach(item => {
        const text = item.getAttribute('data-name') || '';
        if (text.includes(term)) item.style.display = 'block';
        else item.style.display = 'none';
    });
}

let lastCalculatedPackage = {};

function calculatePackageCost() {
    const pax = parseInt(document.getElementById('pkgPax').value) || 0;
    if (pax === 0) return alert('Jumlah peserta harus lebih dari 0');

    let totalCost = 0;
    let totalCashback = 0;

    // Transport
    const tid = document.getElementById('pkgTransport').value;
    const tdays = parseInt(document.getElementById('pkgTransportDays').value) || 0;

    let transportCost = 0;
    if (tid) {
        const t = state.vendors.transport.find(x => x.ID === tid);
        if (t) {
            transportCost = parseInt(t.Price_Per_Day) * tdays;
            totalCashback += (parseInt(t.Cashback) || 0) * tdays;
        }
    }
    totalCost += transportCost;

    // Accommodation
    const hid = document.getElementById('pkgHotel').value;
    const hpax = parseInt(document.getElementById('pkgHotelPaxPerRoom').value) || 2;
    const hnights = parseInt(document.getElementById('pkgHotelNights').value) || 0;
    let hotelCost = 0;
    if (hid) {
        const h = state.vendors.hotel.find(x => x.ID === hid);
        if (h) {
            const rooms = Math.ceil(pax / hpax);
            hotelCost = rooms * parseInt(h.Price_Per_Room) * hnights;
            totalCashback += (parseInt(h.Cashback) || 0) * rooms * hnights;
        }
    }
    totalCost += hotelCost;

    // Meals
    const mid = document.getElementById('pkgMeal').value;
    let mtimesInput = document.getElementById('pkgMealTimes');
    // Auto calculate if empty
    if (!mtimesInput.value) {
        mtimesInput.value = tdays > 0 ? (tdays * 3) : 3;
    }
    const mtimes = parseInt(mtimesInput.value) || 0;

    let mealCost = 0;
    if (mid) {
        const m = state.vendors.resto.find(x => x.ID === mid);
        if (m) {
            mealCost = parseInt(m.Price_Per_Pax) * mtimes * pax;
            totalCashback += (parseInt(m.Cashback) || 0) * pax * mtimes;
        }
    }
    totalCost += mealCost;

    // Tickets
    let ticketCost = 0;
    let selectedTicketIds = [];
    document.querySelectorAll('.ticket-checkbox:checked').forEach(cb => {
        const ticketId = cb.value;
        const t = state.vendors.ticket.find(x => x.ID === ticketId);
        const price = parseInt(cb.getAttribute('data-price')) || 0;
        ticketCost += price * pax;
        if (t) totalCashback += (parseInt(t.Cashback) || 0) * pax;
        selectedTicketIds.push(ticketId);
    });
    totalCost += ticketCost;

    // Other Vendors Cost
    let otherCost = 0;
    let selectedOtherIds = [];
    document.querySelectorAll('.other-checkbox:checked').forEach(cb => {
        const ticketId = cb.value;
        const t = state.vendors.other.find(x => x.ID === ticketId);
        const price = parseInt(cb.getAttribute('data-price')) || 0;
        const unit = cb.getAttribute('data-unit') || '';
        let itemCost = 0;
        let cbAmt = 0;
        const uLower = unit.toLowerCase();
        if (uLower.includes('pax') || uLower.includes('orang')) {
            itemCost = price * pax;
            cbAmt = (t ? parseInt(t.Cashback) || 0 : 0) * pax;
        } else if (uLower.includes('hari') || uLower.includes('day')) {
            itemCost = price * (tdays || 1); // minimal 1 hari jika tidak ada transport
            cbAmt = (t ? parseInt(t.Cashback) || 0 : 0) * (tdays || 1);
        } else {
            // Per Trip atau lainnya
            itemCost = price;
            cbAmt = t ? parseInt(t.Cashback) || 0 : 0;
        }
        otherCost += itemCost;
        totalCashback += cbAmt;
        selectedOtherIds.push(ticketId);
    });
    totalCost += otherCost;

    // Dynamic Costs
    const snackCost = parseInt(document.getElementById('pkgSnackCost').value) || 0;
    const tollCost = parseInt(document.getElementById('pkgTollCost').value) || 0;
    const crossCost = parseInt(document.getElementById('pkgCrossCost').value) || 0;

    const crossAndToll = tollCost + crossCost;
    totalCost += snackCost + crossAndToll;

    const costPerPax = totalCost / pax;

    // Dynamic Margin Logic
    let dynamicMargin = defaultMargin;
    let marginLabel = `(Default ${defaultMargin}%)`;
    if (pax <= 10 && pax > 0) {
        dynamicMargin = 20;
        marginLabel = `(Private: 20%)`;
    } else if (pax <= 30) {
        dynamicMargin = 15;
        marginLabel = `(Rombongan Sedang: 15%)`;
    } else if (pax > 30) {
        dynamicMargin = 12;
        marginLabel = `(Rombongan Besar: 12%)`;
    }

    // Show margin label in UI
    const marginLabelEl = document.getElementById('marginLabelDisplay');
    if (marginLabelEl) {
        marginLabelEl.textContent = `💡 Rekomendasi Sistem ${marginLabel}`;
    }

    // Recommendation Logic (HPP + dynamic margin, rounded up to nearest 5000)
    const targetPrice = costPerPax * (1 + (dynamicMargin / 100));
    const recommendedPrice = Math.ceil(targetPrice / 5000) * 5000;

    let sellingPriceInput = document.getElementById('pkgSellingPrice');
    let sellingPrice = parseInt(sellingPriceInput.value);
    // Auto fill selling price if it's default/too low compared to cost
    if (!sellingPrice || sellingPrice <= costPerPax) {
        sellingPrice = recommendedPrice;
        sellingPriceInput.value = recommendedPrice;
    }
    // Unlock input
    sellingPriceInput.readOnly = false;
    sellingPriceInput.style.background = 'var(--bg-glass)';

    const totalRevenue = sellingPrice * pax;
    // Total Profit includes the hidden cashback
    const totalProfit = totalRevenue - totalCost + totalCashback;
    const profitPerPax = totalProfit / pax;

    // Update UI
    document.getElementById('resTotalReal').textContent = `Rp ${totalCost.toLocaleString('id-ID')}`;
    document.getElementById('resCostPerPax').textContent = `Rp ${Math.round(costPerPax).toLocaleString('id-ID')}`;
    document.getElementById('resRecPrice').textContent = `Rp ${recommendedPrice.toLocaleString('id-ID')}`;
    document.getElementById('resTotalProfit').textContent = `Rp ${totalProfit.toLocaleString('id-ID')}`;
    document.getElementById('resProfitPerPax').textContent = `Rp ${Math.round(profitPerPax).toLocaleString('id-ID')}`;

    // Update Details
    document.getElementById('detTransport').textContent = `Rp ${transportCost.toLocaleString('id-ID')}`;
    document.getElementById('detTicket').textContent = `Rp ${ticketCost.toLocaleString('id-ID')}`;
    document.getElementById('detHotel').textContent = `Rp ${hotelCost.toLocaleString('id-ID')}`;
    document.getElementById('detMeal').textContent = `Rp ${mealCost.toLocaleString('id-ID')}`;
    document.getElementById('detOther').textContent = `Rp ${otherCost.toLocaleString('id-ID')}`;
    document.getElementById('detSnack').textContent = `Rp ${snackCost.toLocaleString('id-ID')}`;
    document.getElementById('detCross').textContent = `Rp ${crossAndToll.toLocaleString('id-ID')}`;
    document.getElementById('detTotal').textContent = `Rp ${totalCost.toLocaleString('id-ID')}`;
    document.getElementById('detCashback').textContent = `Rp ${totalCashback.toLocaleString('id-ID')}`;

    document.getElementById('calculationResult').classList.remove('hidden');

    lastCalculatedPackage = {
        Package_Name: document.getElementById('pkgName').value || 'Tanpa Nama',
        Total_Pax: pax,
        Transport_ID: tid,
        Transport_Days: tdays,
        Transport_Cost: transportCost,
        Hotel_ID: hid,
        Hotel_Nights: hnights,
        Hotel_Cost: hotelCost,
        Meal_ID: mid,
        Meal_Times: mtimes,
        Meal_Cost: mealCost,
        Ticket_IDs: selectedTicketIds.join(','),
        Ticket_Cost: ticketCost,
        Other_IDs: selectedOtherIds.join(','),
        Other_Cost: otherCost,
        Total_Real_Cost: totalCost,
        Cost_Per_Pax: Math.round(costPerPax),
        Selling_Price: sellingPrice,
        Total_Profit: totalProfit,
        Profit_Per_Pax: Math.round(profitPerPax)
    };
}

async function savePackageData() {
    const btn = document.getElementById('savePackageBtn');
    btn.innerHTML = 'Menyimpan...';
    btn.disabled = true;
    try {
        const res = await apiPost('savePackage', { data: lastCalculatedPackage });
        if (res.success) {
            alert("Paket berhasil disimpan ke Google Sheets!");
            loadPackagesData();
        } else {
            alert("Terjadi kesalahan: " + res.message);
        }
    } catch (e) {
        alert("Gagal menghubungi server!");
    }
    btn.innerHTML = 'Simpan Paket ke Database Master';
    btn.disabled = false;
}


function renderAdminVendorTable(category) {
    const thead = document.querySelector('#adminVendorTable thead');
    const tbody = document.querySelector('#adminVendorTable tbody');
    const items = state.vendors[category] || [];

    const getContactCols = (v) => `
        <td><strong>${v.Vendor_Name || '-'}</strong><br><small>${v.Vendor_PIC || '-'}</small></td>
        <td><small>${v.Vendor_Phone || '-'}</small><br><small style="color:var(--text-muted)">${v.Vendor_Address || '-'}</small></td>
    `;

    if (category === 'transport') {
        thead.innerHTML = `<tr><th>Kode Layanan</th><th>Nama Instansi / PIC</th><th>Kontak</th><th>Nama Kendaraan & Kapasitas</th><th>Harga Sewa / Hari</th></tr>`;
        tbody.innerHTML = items.map(v => `<tr id="vendor-row-${v.ID}">
            <td><span style="color:var(--text-muted);font-size:0.8rem">${v.ID}</span></td>
            ${getContactCols(v)}
            <td>${v.Name}<br><small>${v.Capacity} Kursi • ${v.Facilities}</small></td>
            <td>Rp ${parseInt(v.Price_Per_Day).toLocaleString('id-ID')}</td>
        </tr>`).join('');
    } else if (category === 'hotel') {
        thead.innerHTML = `<tr><th>Kode Layanan</th><th>Nama Instansi / PIC</th><th>Kontak</th><th>Tipe Kamar & Kapasitas</th><th>Harga / Malam</th></tr>`;
        tbody.innerHTML = items.map(v => `<tr id="vendor-row-${v.ID}">
            <td><span style="color:var(--text-muted);font-size:0.8rem">${v.ID}</span></td>
            ${getContactCols(v)}
            <td>${v.Name}<br><small>${v.Pax_Per_Room} Orang per Kamar • ${v.Facilities}</small></td>
            <td>Rp ${parseInt(v.Price_Per_Room).toLocaleString('id-ID')}</td>
        </tr>`).join('');
    } else if (category === 'resto') {
        thead.innerHTML = `<tr><th>Kode Layanan</th><th>Nama Instansi / PIC</th><th>Kontak</th><th>Nama Paket Menu</th><th>Harga / Orang</th></tr>`;
        tbody.innerHTML = items.map(v => `<tr id="vendor-row-${v.ID}">
            <td><span style="color:var(--text-muted);font-size:0.8rem">${v.ID}</span></td>
            ${getContactCols(v)}
            <td>${v.Name}<br><small>${v.Description || '-'}</small></td>
            <td>Rp ${parseInt(v.Price_Per_Pax).toLocaleString('id-ID')}</td>
        </tr>`).join('');
    } else if (category === 'ticket') {
        thead.innerHTML = `<tr><th>Kode Layanan</th><th>Nama Tempat Wisata</th><th>Lokasi</th><th>Harga Tiket Masuk</th></tr>`;
        tbody.innerHTML = items.map(v => `<tr id="vendor-row-${v.ID}">
            <td><span style="color:var(--text-muted);font-size:0.8rem">${v.ID}</span></td>
            <td>${v.Name}</td>
            <td>${v.Location || '-'}</td>
            <td>Rp ${parseInt(v.Price_Per_Pax).toLocaleString('id-ID')}</td>
        </tr>`).join('');
    } else if (category === 'other') {
        thead.innerHTML = `<tr><th>Kode Layanan</th><th>Nama Vendor / PIC</th><th>Kontak</th><th>Jenis Jasa</th><th>Harga</th><th>Satuan</th></tr>`;
        tbody.innerHTML = items.map(v => `<tr id="vendor-row-${v.ID}">
            <td><span style="color:var(--text-muted);font-size:0.8rem">${v.ID}</span></td>
            ${getContactCols(v)}
            <td>${v.Name}<br><small>${v.Service_Type || '-'}</small></td>
            <td>Rp ${parseInt(v.Price).toLocaleString('id-ID')}</td>
            <td>${v.Unit || '-'}</td>
        </tr>`).join('');
    }
}

// --- Page: Vendor ---
function initVendor() {
    document.getElementById('userNameDisplay').textContent = state.user.name;
    document.getElementById('userCategoryDisplay').textContent = "Mitra " + state.user.category.toUpperCase();

    const cat = state.user.category;
    const thead = document.querySelector('#vendorTable thead');

    const theadHTML = {
        'transport': `<tr><th>Kode</th><th>Nama Kendaraan / Bus</th><th>Kapasitas</th><th>Fasilitas</th><th>Harga Sewa</th><th>Update Terakhir</th><th>Aksi</th></tr>`,
        'hotel': `<tr><th>Kode</th><th>Tipe Kamar</th><th>Kapasitas (Orang)</th><th>Harga (Per Malam)</th><th>Update Terakhir</th><th>Aksi</th></tr>`,
        'resto': `<tr><th>Kode</th><th>Nama Paket Menu</th><th>Deskripsi/Menu</th><th>Harga (Per Orang)</th><th>Update Terakhir</th><th>Aksi</th></tr>`,
        'ticket': `<tr><th>Kode</th><th>Nama Tempat Wisata</th><th>Kategori</th><th>Lokasi</th><th>Harga Tiket Masuk</th><th>Update Terakhir</th><th>Aksi</th></tr>`
    };
    thead.innerHTML = theadHTML[cat] || `<tr><th>Kode</th><th>Nama Layanan</th><th>Harga</th><th>Aksi</th></tr>`;

    loadVendorDataLive(cat);

    // Fetch Ticket Meta jika vendor adalah tiket
    if (cat === 'ticket') {
        apiGet('getPublicTicketsMeta').then(res => {
            if (res.success && res.data) {
                state.ticketMeta = res.data;
            }
        }).catch(err => console.log('Gagal memuat rekomendasi tiket:', err));
    }
    // Modal logic

    const modal = document.getElementById('addItemModal');
    document.getElementById('addNewListingBtn').addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Formulir Layanan Baru';
        document.getElementById('deleteItemModalBtn').style.display = 'none';
        buildVendorForm(cat);

        // FIX: Reset isi formulir agar tidak nyangkut sisa data edit sebelumnya
        const formEl = document.getElementById('vendorAddItemForm');
        if (formEl) formEl.reset();

        const newId = generateId(cat, state.user.name, state.vendors[cat] || []);
        document.getElementById('vId').value = newId;
        modal.classList.remove('hidden');
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('cancelModalBtn').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('saveItemBtn').addEventListener('click', () => saveVendorItemLive(cat));
    document.getElementById('deleteItemModalBtn').addEventListener('click', () => deleteItemFromModal());

    // Navigation Vendor
    document.querySelectorAll('.sidebar-nav .nav-item[data-target]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            const target = item.getAttribute('data-target');
            const targetView = document.getElementById('view-' + target);

            // FIX: Cegah JS Error jika elemen view/target tidak ada di HTML
            if (!targetView) return;

            document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.view-section').forEach(v => {
                v.style.display = 'none';
                v.classList.remove('active');
            });

            targetView.style.display = 'block';

            const titleEl = document.getElementById('pageTitle');
            if (titleEl) titleEl.textContent = item.textContent.trim();
        });
    });


    initProfileView();
}

function getDriveImageUrl(url) {
    if (!url) return '';
    const match = url.match(/id=([^&]+)/);
    if (match) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w500`;
    }
    return url;
}

function formatPhoneDisplay(phone) {
    if (!phone) return '-';
    let p = phone.toString();
    if (p.startsWith("'")) return p.substring(1);
    return p;
}

function initProfileView() {
    const safeImgUrl = getDriveImageUrl(state.user.logo);
    const safePhone = formatPhoneDisplay(state.user.phone);

    // Tampilkan data ke dashboard utama (Summary Card)
    document.getElementById('summaryName').textContent = state.user.name || 'Nama Instansi';
    document.getElementById('summaryPIC').textContent = state.user.pic || '-';
    document.getElementById('summaryPhone').textContent = safePhone;
    document.getElementById('summaryUsername').textContent = state.user.username || '-';
    document.getElementById('summaryAddress').textContent = state.user.address || '-';
    if (safeImgUrl) {
        document.getElementById('summaryLogo').src = safeImgUrl;
    }

    // Tampilkan data ke form
    document.getElementById('profName').value = state.user.name || '';
    document.getElementById('profPIC').value = state.user.pic || '';
    document.getElementById('profPhone').value = safePhone === '-' ? '' : safePhone;
    document.getElementById('profAddress').value = state.user.address || '';

    // Tampilkan logo jika ada
    if (safeImgUrl) {
        document.getElementById('profileLogoImg').src = safeImgUrl;
        document.getElementById('sidebarVendorLogo').src = safeImgUrl;
        document.getElementById('sidebarVendorLogo').style.display = 'block';
        document.getElementById('sidebarVendorIcon').style.display = 'none';
    }

    let selectedLogoBase64 = null;
    let selectedLogoMime = null;
    let selectedLogoExt = null;

    document.getElementById('profileLogoInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert("Ukuran file maksimal 2MB!");
                e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = function (evt) {
                selectedLogoBase64 = evt.target.result;
                selectedLogoMime = file.type;
                selectedLogoExt = file.name.split('.').pop();
                document.getElementById('profileLogoImg').src = selectedLogoBase64;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('vendorProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveProfileBtn');
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyimpan...';
        btn.disabled = true;

        const payload = {
            name: document.getElementById('profName').value,
            pic: document.getElementById('profPIC').value,
            phone: document.getElementById('profPhone').value,
            address: document.getElementById('profAddress').value,
        };

        if (selectedLogoBase64) {
            payload.logoBase64 = selectedLogoBase64;
            payload.logoMimeType = selectedLogoMime;
            payload.logoExt = selectedLogoExt;
        }

        try {
            const res = await apiPost('updateProfile', {
                username: state.user.username,
                profileData: payload
            });

            if (res.success) {
                alert('Profil berhasil diperbarui!');
                state.user = res.data;
                localStorage.setItem('jkl_user', JSON.stringify(res.data));

                // Update sidebar UI & Summary Card
                const safeNewImgUrl = getDriveImageUrl(state.user.logo);
                const safeNewPhone = formatPhoneDisplay(state.user.phone);

                document.getElementById('userNameDisplay').textContent = state.user.name;
                document.getElementById('summaryName').textContent = state.user.name;
                document.getElementById('summaryPIC').textContent = state.user.pic;
                document.getElementById('summaryPhone').textContent = safeNewPhone;
                document.getElementById('summaryAddress').textContent = state.user.address;

                if (safeNewImgUrl) {
                    document.getElementById('summaryLogo').src = safeNewImgUrl;
                    document.getElementById('sidebarVendorLogo').src = safeNewImgUrl;
                    document.getElementById('sidebarVendorLogo').style.display = 'block';
                    document.getElementById('sidebarVendorIcon').style.display = 'none';
                }

                // Refresh tabel layanan di belakang layar jika ada perubahan ID akibat pergantian nama
                loadVendorDataLive(state.user.category);

            } else {
                alert('Gagal: ' + res.message);
            }
        } catch (err) {
            alert('Kesalahan jaringan: ' + err.toString());
        } finally {
            btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Simpan Perubahan Profil';
            btn.disabled = false;
        }
    });
}

async function loadVendorDataLive(category) {
    try {
        const res = await apiGet('getVendors', {
            category: category,
            role: state.user.role,
            username: state.user.username
        });
        if (res.success) {
            document.getElementById('vendorLoading').style.display = 'none';
            const tbody = document.querySelector('#vendorTable tbody');
            const items = res.data || [];
            state.vendors[category] = items; // Simpan ke state agar editItem bisa mencari datanya

            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Anda belum memiliki layanan yang ditambahkan.</td></tr>`;
                return;
            }

            tbody.innerHTML = items.map(v => {
                let midCols = '';
                if (category === 'transport') {
                    midCols = `<td>${v.Capacity}</td><td>${v.Facilities || '-'}</td><td>Rp ${parseInt(v.Price_Per_Day).toLocaleString('id-ID')}</td>`;
                } else if (category === 'hotel') {
                    midCols = `<td>${v.Pax_Per_Room}</td><td>Rp ${parseInt(v.Price_Per_Room).toLocaleString('id-ID')}</td>`;
                } else if (category === 'resto') {
                    midCols = `<td>${v.Description || '-'}</td><td>Rp ${parseInt(v.Price_Per_Pax).toLocaleString('id-ID')}</td>`;
                } else if (category === 'ticket') {
                    midCols = `<td><span class="badge" style="background:var(--accent-primary);color:var(--bg-primary);padding:2px 8px;border-radius:12px;font-size:0.75rem;">${v.Category || '-'}</span></td><td>${v.Location || '-'}</td><td>Rp ${parseInt(v.Price_Per_Pax).toLocaleString('id-ID')}</td>`;
                }
                return `<tr id="vendor-row-${v.ID}">
                    <td>${v.ID}</td>
                    <td>${v.Name}</td>
                    ${midCols}
                    <td><span style="font-size:0.8rem; color:var(--text-muted)">${formatDateDisplay(v.Update_Date)}</span></td>
                    <td><button class="btn-icon" onclick="editItem('${v.ID}')" title="Edit Data"><i class="ph ph-pencil-simple" style="color:var(--accent-primary)"></i></button></td>
                </tr>`;
            }).join('');
        }
    } catch (e) {
        document.getElementById('vendorLoading').innerHTML = '<span style="color:var(--danger)">Gagal memuat data. Silakan coba lagi.</span>';
    }
}

// Global scope to allow onclick from HTML string
window.editItem = function (id) {
    const cat = state.user.category;
    const items = state.vendors[cat] || [];
    const item = items.find(x => x.ID === id);
    if (!item) return;

    document.getElementById('modalTitle').textContent = 'Edit Layanan';
    document.getElementById('deleteItemModalBtn').style.display = 'block';

    // Simpan id untuk proses hapus
    document.getElementById('deleteItemModalBtn').setAttribute('data-id', id);

    buildVendorForm(cat);
    document.getElementById('vId').value = item.ID;
    document.getElementById('vName').value = item.Name || '';
    if (cat === 'transport') {
        document.getElementById('vCap').value = item.Capacity || '';
        document.getElementById('vPrice').value = item.Price_Per_Day || '';
        document.getElementById('vFac').value = item.Facilities || '';
        if (document.getElementById('vLoc')) document.getElementById('vLoc').value = item.Location || '';
    } else if (cat === 'hotel') {
        document.getElementById('vPax').value = item.Pax_Per_Room || '';
        document.getElementById('vPrice').value = item.Price_Per_Room || '';
        document.getElementById('vFac').value = item.Facilities || '';
        if (document.getElementById('vLoc')) document.getElementById('vLoc').value = item.Location || '';
    } else if (cat === 'resto') {
        document.getElementById('vPrice').value = item.Price_Per_Pax || '';
        document.getElementById('vDesc').value = item.Description || '';
        if (document.getElementById('vLoc')) document.getElementById('vLoc').value = item.Location || '';
    } else if (cat === 'ticket') {
        document.getElementById('vPrice').value = item.Price_Per_Pax || '';
        document.getElementById('vLoc').value = item.Location || '';
        document.getElementById('vCat').value = item.Category || '';
        document.getElementById('vDesc').value = item.Description || '';

        // Picu logika auto-fill & lock untuk tiket eksisting
        setTimeout(() => {
            const vNameInput = document.getElementById('vName');
            if (vNameInput) vNameInput.dispatchEvent(new Event('input'));
        }, 50);
    }

    document.getElementById('addItemModal').classList.remove('hidden');
}

async function deleteItemFromModal() {
    const id = document.getElementById('deleteItemModalBtn').getAttribute('data-id');
    if (!confirm('Apakah Anda yakin ingin menghapus layanan ini?')) return;

    document.getElementById('deleteItemModalBtn').innerHTML = 'Menghapus...';
    try {
        const res = await apiPost('deleteVendorData', {
            category: state.user.category,
            id: id,
            username: state.user.username
        });
        if (res.success) {
            alert('Data berhasil dihapus');
            document.getElementById('addItemModal').classList.add('hidden');
            loadVendorDataLive(state.user.category);
        } else {
            alert('Gagal menghapus: ' + res.message);
        }
    } catch (e) {
        alert('Terjadi kesalahan jaringan');
    }
    document.getElementById('deleteItemModalBtn').innerHTML = '<i class="ph ph-trash"></i> Hapus';
}

function generateId(category, vendorName, items) {
    let catCode = category === 'transport' ? 'T' : category === 'hotel' ? 'H' : category === 'resto' ? 'R' : category === 'ticket' ? 'TK' : 'X';

    // Ambil 3 huruf konsonan pertama dari nama vendor
    let consonants = vendorName.replace(/[^a-zA-Z]/g, '').replace(/[aeiouAEIOU]/g, '').toUpperCase();
    let vendorCode = consonants.substring(0, 3);
    if (vendorCode.length < 3) {
        // Jika konsonan kurang dari 3, ambil huruf apa saja
        vendorCode = vendorName.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 3);
    }

    let maxSeq = 0;
    if (items && items.length > 0) {
        items.forEach(item => {
            let parts = item.ID.split('-');
            if (parts.length === 3) {
                let num = parseInt(parts[2]);
                if (!isNaN(num) && num > maxSeq) {
                    maxSeq = num;
                }
            }
        });
    }

    let seq = String(maxSeq + 1).padStart(3, '0');
    return `${catCode}-${vendorCode}-${seq}`;
}

function buildVendorForm(cat) {
    const form = document.getElementById('vendorAddItemForm');
    if (cat === 'transport') {
        form.innerHTML = `
            <div class="form-group"><label>Kode Unik Layanan</label><input type="text" id="vId" readonly style="background:rgba(0,0,0,0.1);cursor:not-allowed;"></div>
            <div class="form-group full-width"><label>Tipe Kendaraan / Bus</label><input type="text" id="vName" required placeholder="Contoh: JetBus 5 SHD"></div>
            <div class="form-group"><label>Kapasitas Kursi (Orang)</label><input type="number" id="vCap" required></div>
            <div class="form-group full-width"><label>Lokasi Kota / Daerah (Mepo)</label><input type="text" id="vLoc" placeholder="Contoh: Malang"></div>
            <div class="form-group"><label>Harga Sewa Per Hari (Rp)</label><input type="number" id="vPrice" required></div>
            <div class="form-group full-width"><label>Fasilitas Unggulan</label><input type="text" id="vFac" placeholder="Contoh: AC, Reclining Seat, USB Charger, Toilet"></div>
        `;
    } else if (cat === 'hotel') {
        form.innerHTML = `
            <div class="form-group"><label>Kode Unik Kamar</label><input type="text" id="vId" readonly style="background:rgba(0,0,0,0.1);cursor:not-allowed;"></div>
            <div class="form-group full-width"><label>Nama Tipe Kamar</label><input type="text" id="vName" required placeholder="Contoh: Kamar Deluxe Twin"></div>
            <div class="form-group"><label>Kapasitas (Orang per Kamar)</label><input type="number" id="vPax" required></div>
            <div class="form-group full-width"><label>Lokasi Kota / Daerah</label><input type="text" id="vLoc" placeholder="Contoh: Batu"></div>
            <div class="form-group"><label>Harga Per Malam (Rp)</label><input type="number" id="vPrice" required></div>
            <div class="form-group full-width"><label>Fasilitas Tambahan</label><input type="text" id="vFac" placeholder="Contoh: Sarapan, WiFi, Kolam Renang"></div>
        `;
    } else if (cat === 'resto') {
        form.innerHTML = `
            <div class="form-group"><label>Kode Unik Paket</label><input type="text" id="vId" readonly style="background:rgba(0,0,0,0.1);cursor:not-allowed;"></div>
            <div class="form-group full-width"><label>Nama Paket Makanan</label><input type="text" id="vName" required placeholder="Contoh: Nasi Kotak Premium"></div>
            <div class="form-group full-width"><label>Lokasi Kota / Daerah (Mepo)</label><input type="text" id="vLoc" placeholder="Contoh: Probolinggo"></div>
            <div class="form-group"><label>Harga Per Orang (Rp)</label><input type="number" id="vPrice" required></div>
            <div class="form-group full-width"><label>Rincian Menu Lauk</label><input type="text" id="vDesc" placeholder="Contoh: Nasi Putih, Rendang, Sayur Nangka, Kerupuk, Buah"></div>
        `;
    } else if (cat === 'ticket') {
        form.innerHTML = `
            <div class="form-group"><label>Kode Unik Layanan</label><input type="text" id="vId" readonly style="background:rgba(0,0,0,0.1);cursor:not-allowed;"></div>
            <div class="form-group full-width">
                <label>Nama Tempat Wisata / Tiket</label>
                <input type="text" id="vName" required placeholder="Contoh: Jatim Park 1" list="ticketNamesList">
                <datalist id="ticketNamesList"></datalist>
            </div>
            <div class="form-group">
                <label>Kategori Wisata</label>
                <input type="text" id="vCat" required list="ticketCategoriesList" placeholder="Pilih atau Ketik">
                <datalist id="ticketCategoriesList"></datalist>
            </div>
            <div class="form-group"><label>Harga Tiket Masuk (Rp)</label>
                <input type="number" id="vPrice" required>
                <p id="priceHint" style="font-size:0.8rem; color:var(--accent-primary); margin-top:0.25rem; display:none;"></p>
            </div>
            <div class="form-group full-width"><label>Lokasi Kota / Daerah</label><input type="text" id="vLoc" placeholder="Contoh: Batu, Malang"></div>
            <div class="form-group full-width">
                <label>Deskripsi / Highlight Wisata</label>
                <textarea id="vDesc" rows="3" placeholder="Contoh: Taman hiburan keluarga dengan wahana edukasi"></textarea>
            </div>
        `;

        // Setup Auto-fill & Datalist
        const nameList = document.getElementById('ticketNamesList');
        const catList = document.getElementById('ticketCategoriesList');

        if (state.ticketMeta && state.ticketMeta.length > 0) {
            const uniqueCats = [...new Set(state.ticketMeta.map(t => t.Category).filter(Boolean))];
            catList.innerHTML = uniqueCats.map(c => `<option value="${c}">`).join('');

            const uniqueNames = [...new Set(state.ticketMeta.map(t => t.Name).filter(Boolean))];
            nameList.innerHTML = uniqueNames.map(n => `<option value="${n}">`).join('');

            // Auto-fill logika dengan Lock & Harga Referensi
            document.getElementById('vName').addEventListener('input', (e) => {
                const typedName = e.target.value.toLowerCase().trim();
                const matches = state.ticketMeta.filter(t => t.Name && t.Name.toLowerCase().trim() === typedName);

                const catInput = document.getElementById('vCat');
                const descInput = document.getElementById('vDesc');
                const locInput = document.getElementById('vLoc');
                const priceHint = document.getElementById('priceHint');

                if (typedName === '') {
                    // Kosongkan dan buka kunci jika dihapus
                    catInput.value = '';
                    descInput.value = '';
                    locInput.value = '';
                    catInput.readOnly = false;
                    descInput.readOnly = false;
                    locInput.readOnly = false;
                    catInput.style.background = '';
                    descInput.style.background = '';
                    locInput.style.background = '';
                    priceHint.style.display = 'none';
                    return;
                }

                if (matches.length > 0) {
                    // Sort berdasarkan Update_Date terbaru (dd/MM/yyyy)
                    matches.sort((a, b) => {
                        if (!a.Update_Date) return -1;
                        if (!b.Update_Date) return 1;
                        const [da, ma, ya] = a.Update_Date.split('/');
                        const [db, mb, yb] = b.Update_Date.split('/');
                        return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
                    });

                    const bestMatch = matches[matches.length - 1]; // Data terupdate

                    catInput.value = bestMatch.Category || '';
                    descInput.value = bestMatch.Description || '';
                    locInput.value = bestMatch.Location || '';

                    // Kunci input agar konsisten
                    catInput.readOnly = true;
                    descInput.readOnly = true;
                    locInput.readOnly = true;
                    const lockedStyle = 'rgba(0,0,0,0.1)';
                    catInput.style.background = lockedStyle;
                    descInput.style.background = lockedStyle;
                    locInput.style.background = lockedStyle;

                    // Cari harga terendah dari semua match
                    let lowestPrice = Infinity;
                    matches.forEach(m => {
                        const p = parseInt(m.Price);
                        if (!isNaN(p) && p < lowestPrice) lowestPrice = p;
                    });

                    if (lowestPrice !== Infinity) {
                        priceHint.innerHTML = `<i class="ph ph-info"></i> Harga referensi pasar: Rp ${lowestPrice.toLocaleString('id-ID')}`;
                        priceHint.style.display = 'block';
                    } else {
                        priceHint.style.display = 'none';
                    }
                } else {
                    // Buka kunci jika nama baru / tidak ditemukan di database
                    catInput.readOnly = false;
                    descInput.readOnly = false;
                    locInput.readOnly = false;
                    catInput.style.background = '';
                    descInput.style.background = '';
                    locInput.style.background = '';
                }
            });
        }
    } else if (cat === 'other') {
        form.innerHTML = `
            <div class="form-group"><label>Kode Unik Layanan</label><input type="text" id="vId" readonly style="background:rgba(0,0,0,0.1);cursor:not-allowed;"></div>
            <div class="form-group full-width"><label>Nama Layanan Tambahan</label><input type="text" id="vName" required placeholder="Contoh: Banner Cetak, Dokumentasi, Tour Guide"></div>
            <div class="form-group"><label>Jenis / Kategori Layanan</label><input type="text" id="vCat" required placeholder="Contoh: Cetak Banner 3x1"></div>
            <div class="form-group"><label>Lokasi (Opsional)</label><input type="text" id="vLoc" placeholder="Contoh: Malang"></div>
            <div class="form-group"><label>Harga (Rp)</label><input type="number" id="vPrice" required></div>
            <div class="form-group"><label>Satuan Harga</label><input type="text" id="vUnit" required placeholder="Contoh: Per Pax, Per Hari, Per Grup"></div>
        `;
    }
}

async function saveVendorItemLive(cat) {
    const btn = document.getElementById('saveItemBtn');
    const todayStr = getTodayDate();

    let data = {
        ID: document.getElementById('vId').value,
        Username_Vendor: state.user.username,
        Name: document.getElementById('vName').value,
        Update_Date: todayStr
    };

    if (cat === 'transport') {
        data.Capacity = document.getElementById('vCap').value;
        data.Facilities = document.getElementById('vFac').value;
        data.Price_Per_Day = document.getElementById('vPrice').value;
        data.Location = document.getElementById('vLoc').value;
    } else if (cat === 'hotel') {
        data.Pax_Per_Room = document.getElementById('vPax').value;
        data.Facilities = document.getElementById('vFac').value;
        data.Price_Per_Room = document.getElementById('vPrice').value;
        data.Location = document.getElementById('vLoc').value;
    } else if (cat === 'resto') {
        data.Description = document.getElementById('vDesc').value;
        data.Price_Per_Pax = document.getElementById('vPrice').value;
        data.Location = document.getElementById('vLoc').value;
    } else if (cat === 'ticket') {
        data.Location = document.getElementById('vLoc').value;
        data.Category = document.getElementById('vCat').value;
        data.Description = document.getElementById('vDesc').value;
        data.Price_Per_Pax = document.getElementById('vPrice').value;
    } else if (cat === 'other') {
        data.Service_Type = document.getElementById('vCat').value;
        data.Location = document.getElementById('vLoc').value;
        data.Price = document.getElementById('vPrice').value;
        data.Unit = document.getElementById('vUnit').value;
    }

    btn.innerHTML = 'Menyimpan...';
    btn.disabled = true;
    try {
        const res = await apiPost('saveVendorData', { category: cat, data: data });
        if (res.success) {
            alert("Data layanan berhasil disimpan!");
            document.getElementById('addItemModal').classList.add('hidden');
            loadVendorDataLive(cat);
        } else {
            alert("Gagal menyimpan: " + res.message);
        }
    } catch (e) {
        alert("Gagal terhubung ke server!");
    }
    btn.innerHTML = 'Simpan ke Database';
    btn.disabled = false;
}

// --- Notification & Settings ---
window.toggleNotif = function () {
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = 'none';
}

window.addNotification = function (msg, isSuccess = true, actionData = null) {
    const list = document.getElementById('notifList');
    if (!list) return; // not initialized or not in admin page

    // Hilangkan teks 'Belum ada notifikasi' jika ada
    if (list.innerHTML.includes('Belum ada notifikasi')) {
        list.innerHTML = '';
    }

    const icon = isSuccess ? '<i class="ph ph-check-circle" style="color:var(--success)"></i>' : '<i class="ph ph-info" style="color:var(--primary)"></i>';
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '0.5rem';
    div.style.padding = '0.5rem';
    div.style.background = 'rgba(255,255,255,0.05)';
    div.style.borderRadius = '6px';
    div.style.transition = 'background 0.3s ease';

    if (actionData) {
        div.style.cursor = 'pointer';
        div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.1)';
        div.onmouseout = () => div.style.background = 'rgba(255,255,255,0.05)';
        div.onclick = () => {
            if (actionData.type === 'vendor') {
                highlightVendor(actionData.cat, actionData.id);
            } else if (actionData.type === 'package') {
                highlightPackage(actionData.id);
            }
        };
        div.innerHTML = `${icon} <span style="flex:1;">${msg}</span> <i class="ph ph-arrow-up-right" style="color:var(--accent-primary); align-self:center;"></i>`;
    } else {
        div.innerHTML = `${icon} <span style="flex:1;">${msg}</span>`;
    }

    list.insertBefore(div, list.firstChild);

    // Munculkan red dot pada icon lonceng
    const badge = document.getElementById('notifBadge');
    if (badge) {
        badge.style.display = 'block';
    }
}

window.highlightVendor = function (cat, id) {
    // 1. Pindah ke view Data Mitra
    const navItem = document.querySelector('.sidebar-nav .nav-item[data-target="vendors"]');
    if (navItem) navItem.click();

    // 2. Pindah ke tab kategori yang sesuai
    const tabBtn = document.querySelector(`.tab-btn[data-cat="${cat}"]`);
    if (tabBtn) tabBtn.click();

    // 3. Tutup dropdown notifikasi
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) dropdown.classList.add('hidden');

    // 4. Gulir dan highlight baris
    if (id) {
        setTimeout(() => {
            const row = document.getElementById(`vendor-row-${id}`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Warnai baris (terapkan ke td agar tidak tertutup style CSS lain)
                Array.from(row.children).forEach(td => {
                    td.style.transition = 'background-color 0.5s ease';
                    td.style.backgroundColor = 'rgba(6, 182, 212, 0.3)';
                });
                setTimeout(() => {
                    Array.from(row.children).forEach(td => {
                        td.style.backgroundColor = '';
                    });
                }, 2500);
            }
        }, 300);
    }
}

window.highlightPackage = function(id) {
    // 1. Pindah ke view Kalkulator Paket
    const navItem = document.querySelector('.sidebar-nav .nav-item[data-target="packages"]');
    if (navItem) navItem.click();

    // 2. Tutup dropdown notifikasi
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) dropdown.classList.add('hidden');

    // 3. Gulir dan highlight baris
    if (id) {
        setTimeout(() => {
            const row = document.getElementById(`package-row-${id}`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Warnai baris (terapkan ke td agar tidak tertutup style CSS lain)
                Array.from(row.children).forEach(td => {
                    td.style.transition = 'background-color 0.5s ease';
                    td.style.backgroundColor = 'rgba(6, 182, 212, 0.3)';
                });
                setTimeout(() => {
                    Array.from(row.children).forEach(td => {
                        td.style.backgroundColor = '';
                    });
                }, 2500);
            }
        }, 300);
    }
}

let defaultMargin = 20;

window.openSettingsModal = function () {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('hidden');
}
window.closeSettingsModal = function () {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('hidden');
}
window.saveSettings = function () {
    const m = parseInt(document.getElementById('settingMargin').value) || 20;
    defaultMargin = m;
    closeSettingsModal();
    addNotification(`Pengaturan disimpan (Margin ${m}%)`, true);
}
window.syncData = function () {
    addNotification('Memulai sinkronisasi data...', false);
    loadLiveVendorData().then(() => {
        addNotification('Data tersinkronisasi.', true);
    });
    closeSettingsModal();
}

// --- Mobile Sidebar Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function toggleSidebar() {
        if (sidebar) sidebar.classList.toggle('active');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (sidebar && sidebar.classList.contains('active')) {
                toggleSidebar();
            }
        });
    });
});
// --- Global Click Outside Listener ---
document.addEventListener('click', function(e) {
    // 1. Close Notification Dropdown
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        const isClickInside = dropdown.contains(e.target);
        const isClickOnToggle = e.target.closest('[onclick="toggleNotif()"]');
        if (!isClickInside && !isClickOnToggle) {
            dropdown.classList.add('hidden');
        }
    }
    
    // 2. Close Modals on click outside
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
    }
});

/* ============================================================
   Financial Tracker - app.js
   Struktur:
     1. ROUTER       — hash-based client-side routing
     2. DATABASE     — IndexedDB helpers
     3. UTILITY      — format, date, toast
     4. CATEGORIES   — data master kategori
     5. RENDER       — fungsi render UI
     6. HANDLERS     — event handlers form & button
     7. INIT         — inisialisasi aplikasi
   ============================================================ */

/* ============================================================
   1. ROUTER
   ============================================================ */
const Router = (() => {
    const routes = {};          // { pageName: handlerFn }
    let currentPage = null;

    /** Daftarkan route */
    function register(page, handler) {
        routes[page] = handler;
    }

    /** Navigasi ke halaman tertentu */
    function navigate(page) {
        // Default ke 'dashboard' jika page tidak dikenal
        if (!routes[page]) page = 'dashboard';
        if (currentPage === page) return;

        currentPage = page;
        window.location.hash = page;

        // Sembunyikan semua section, tampilkan yang aktif
        document.querySelectorAll('.page-section').forEach(el => {
            el.classList.remove('active');
        });
        const target = document.getElementById(`page-${page}`);
        if (target) target.classList.add('active');

        // Update active state nav links
        document.querySelectorAll('.nav-link, .footer-link').forEach(link => {
            const linkPage = link.getAttribute('data-page');
            link.classList.toggle('active', linkPage === page);
        });

        // Scroll ke atas
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Jalankan handler page jika ada
        if (typeof routes[page] === 'function') {
            routes[page]();
        }
    }

    /** Baca hash saat load / hashchange */
    function resolve() {
        const hash = window.location.hash.replace('#', '').trim();
        navigate(hash || 'dashboard');
    }

    /** Pasang event listener */
    function init() {
        // Klik nav link
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-page]');
            if (!link) return;
            e.preventDefault();
            navigate(link.getAttribute('data-page'));
        });

        // Hash change (back/forward browser)
        window.addEventListener('hashchange', resolve);

        // Load pertama
        resolve();
    }

    return { register, navigate, init };
})();

/* ============================================================
   2. DATABASE (IndexedDB)
   ============================================================ */
const DB = (() => {
    const DB_NAME    = 'FinancialTrackerDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'transactions';
    let db = null;

    function open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains(STORE_NAME)) {
                    const store = d.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('type',     'type',     { unique: false });
                    store.createIndex('date',     'date',     { unique: false });
                    store.createIndex('category', 'category', { unique: false });
                }
            };
            req.onsuccess = (e) => { db = e.target.result; resolve(db); };
            req.onerror   = (e) => reject(e.target.error);
        });
    }

    function getAll() {
        return new Promise((resolve, reject) => {
            const tx    = db.transaction(STORE_NAME, 'readonly');
            const req   = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror   = () => reject(req.error);
        });
    }

    function add(obj) {
        return new Promise((resolve, reject) => {
            const tx  = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).add(obj);
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
    }

    function remove(id) {
        return new Promise((resolve, reject) => {
            const tx  = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).delete(id);
            req.onsuccess = () => resolve();
            req.onerror   = () => reject(req.error);
        });
    }

    function clearAll() {
        return new Promise((resolve, reject) => {
            const tx  = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).clear();
            req.onsuccess = () => resolve();
            req.onerror   = () => reject(req.error);
        });
    }

    return { open, getAll, add, remove, clearAll };
})();

/* ============================================================
   3. UTILITY
   ============================================================ */
const Utils = (() => {
    function formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    }

    function formatNumber(n) {
        return new Intl.NumberFormat('id-ID').format(n || 0);
    }

    function todayStr() {
        return new Date().toISOString().slice(0, 10);
    }

    function weekAgoStr() {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return d.toISOString().slice(0, 10);
    }

    function monthStartStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    }

    function monthLabel(dateStr) {
        // '2025-06-12' → 'Jun 2025'
        const d = new Date(dateStr + '-01');
        return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    }

    // ── Toast ──
    let _toastTimer = null;
    function showToast(msg, type = 'success') {
        const el = document.getElementById('toast');
        const icons = {
            success: 'bi bi-check-circle-fill',
            error:   'bi bi-x-circle-fill',
            info:    'bi bi-info-circle-fill'
        };
        el.className = `toast ${type}`;
        el.innerHTML = `<i class="${icons[type] || icons.info}"></i> ${msg}`;
        el.classList.add('show');
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
    }

    // ── DB Badge ──
    function setDBBadge(ok, count) {
        const badge = document.getElementById('db-badge');
        const dot   = document.getElementById('db-dot');
        const label = document.getElementById('db-label');
        if (ok) {
            badge.className = 'db-badge connected';
            dot.style.background = '#00c98d';
            label.textContent = `Database aktif · ${count} data`;
        } else {
            badge.className = 'db-badge error';
            dot.style.background = '#ff4d6d';
            label.textContent = 'Database error';
        }
    }

    return { formatDate, formatNumber, todayStr, weekAgoStr, monthStartStr, monthLabel, showToast, setDBBadge };
})();

/* ============================================================
   4. CATEGORIES
   ============================================================ */
const CATEGORIES = {
    income:  ['Gaji', 'Freelance', 'Bonus', 'Bisnis', 'Investasi', 'Transfer Masuk', 'Lainnya'],
    expense: ['Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan Listrik/Air',
              'Internet & Pulsa', 'Kesehatan', 'Hiburan', 'Pendidikan', 'Cicilan', 'Sewa', 'Lainnya']
};

const CHART_COLORS = ['#5b4eff','#ff4d6d','#00c98d','#f59e0b','#0ea5e9','#a855f7','#6b7280'];

/* ============================================================
   5. RENDER
   ============================================================ */
const Render = (() => {

    /** Baris transaksi di tabel */
    function transactionRow(t) {
        const isIncome = t.type === 'income';
        return `
        <div class="tx-row">
            <div class="w-full md:w-[14%] text-gray-400 text-xs mb-1 md:mb-0">${Utils.formatDate(t.date)}</div>
            <div class="w-full md:w-[30%] mb-1 md:mb-0">
                <div class="font-semibold text-gray-700 text-sm truncate">${t.description || '—'}</div>
            </div>
            <div class="w-full md:w-[18%] mb-1 md:mb-0">
                <span class="tx-cat-badge">${t.category || 'Lainnya'}</span>
            </div>
            <div class="w-full md:w-[16%] mb-1 md:mb-0">
                <span class="tx-badge ${isIncome ? 'income' : 'expense'}">
                    <i class="bi bi-arrow-${isIncome ? 'down' : 'up'}-circle"></i>
                    ${isIncome ? 'Masuk' : 'Keluar'}
                </span>
            </div>
            <div class="w-full md:w-[16%] mb-1 md:mb-0">
                <span class="tx-amount ${isIncome ? 'income' : 'expense'}">
                    ${isIncome ? '+' : '−'} Rp ${Utils.formatNumber(t.amount)}
                </span>
            </div>
            <div class="w-full md:w-[6%] flex justify-end">
                <button class="btn-delete" onclick="App.deleteTransaction(${t.id})" title="Hapus">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>`;
    }

    /** Bar chart kategori generik */
    function categoryChart(containerId, transactions, type) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const filtered = transactions.filter(t => t.type === type);
        if (!filtered.length) {
            const icon = type === 'expense' ? 'bi-bar-chart' : 'bi-bar-chart';
            container.innerHTML = `<div class="empty-chart">
                <i class="bi ${icon}"></i>
                <p>Data akan muncul setelah ada ${type === 'expense' ? 'pengeluaran' : 'pemasukan'}</p>
            </div>`;
            return;
        }

        const byCategory = {};
        filtered.forEach(t => {
            byCategory[t.category || 'Lainnya'] = (byCategory[t.category || 'Lainnya'] || 0) + t.amount;
        });

        const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const maxVal = sorted[0][1];

        container.innerHTML = sorted.map(([cat, amt], i) => `
            <div class="chart-bar-wrap">
                <div class="chart-bar-label">
                    <span>${cat}</span>
                    <span>Rp ${Utils.formatNumber(amt)}</span>
                </div>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill" style="width:${Math.round((amt/maxVal)*100)}%;background:${CHART_COLORS[i % CHART_COLORS.length]}"></div>
                </div>
            </div>
        `).join('');
    }

    /** 5 transaksi terbaru (mini card) */
    function recentTransactions(containerId, transactions) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const recent = [...transactions].reverse().slice(0, 5);
        if (!recent.length) {
            container.innerHTML = `<div class="empty-chart">
                <i class="bi bi-clock-history"></i>
                <p>Belum ada transaksi terbaru</p>
            </div>`;
            return;
        }

        container.innerHTML = recent.map(t => `
            <div class="recent-item">
                <div class="flex-1 min-w-0">
                    <div class="recent-label truncate">${t.description || '—'}</div>
                    <div class="recent-meta">${Utils.formatDate(t.date)} · ${t.category || 'Lainnya'}</div>
                </div>
                <div class="recent-amount ${t.type === 'income' ? 'text-green-500' : 'text-red-500'} ml-3">
                    ${t.type === 'income' ? '+' : '−'} Rp ${Utils.formatNumber(t.amount)}
                </div>
            </div>
        `).join('');
    }

    /** Ringkasan per bulan */
    function monthlySummary(containerId, transactions) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!transactions.length) {
            container.innerHTML = `<div class="empty-chart">
                <i class="bi bi-calendar3"></i>
                <p>Data bulanan akan muncul di sini</p>
            </div>`;
            return;
        }

        // Group by YYYY-MM
        const monthMap = {};
        transactions.forEach(t => {
            const ym = t.date.slice(0, 7);
            if (!monthMap[ym]) monthMap[ym] = { in: 0, out: 0 };
            monthMap[ym][t.type === 'income' ? 'in' : 'out'] += t.amount;
        });

        const sorted = Object.entries(monthMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);

        container.innerHTML = `
            <div class="overflow-x-auto">
                <table style="width:100%;border-collapse:collapse;font-size:0.83rem;">
                    <thead>
                        <tr style="border-bottom:1.5px solid #f0f2f8;">
                            <th style="text-align:left;padding:8px 10px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;font-weight:700;">Bulan</th>
                            <th style="text-align:right;padding:8px 10px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;color:#00b37d;font-weight:700;">Pemasukan</th>
                            <th style="text-align:right;padding:8px 10px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;color:#ff4d6d;font-weight:700;">Pengeluaran</th>
                            <th style="text-align:right;padding:8px 10px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;color:#5b4eff;font-weight:700;">Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(([ym, v]) => {
                            const bal = v.in - v.out;
                            return `<tr style="border-bottom:1px solid #f8f9fd;" onmouseover="this.style.background='#f8f9fd'" onmouseout="this.style.background=''">
                                <td style="padding:10px 10px;font-weight:600;color:#374151;">${Utils.monthLabel(ym)}</td>
                                <td style="text-align:right;padding:10px 10px;color:#00b37d;font-weight:600;">+Rp ${Utils.formatNumber(v.in)}</td>
                                <td style="text-align:right;padding:10px 10px;color:#ff4d6d;font-weight:600;">−Rp ${Utils.formatNumber(v.out)}</td>
                                <td style="text-align:right;padding:10px 10px;font-weight:800;font-family:'Syne',sans-serif;color:${bal >= 0 ? '#5b4eff' : '#ff4d6d'};">
                                    ${bal >= 0 ? '+' : '−'}Rp ${Utils.formatNumber(Math.abs(bal))}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    /** Summary cards (balance, income, expense) */
    function summaryCards(all) {
        const totalIncome  = all.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const totalExpense = all.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const totalBalance = totalIncome - totalExpense;

        const balEl = document.getElementById('total-balance');
        if (balEl) {
            balEl.textContent  = `Rp ${Utils.formatNumber(totalBalance)}`;
            balEl.style.color  = totalBalance < 0 ? '#ff4d6d' : '#1a1d2e';
        }
        const incEl = document.getElementById('total-income');
        if (incEl) incEl.textContent = `Rp ${Utils.formatNumber(totalIncome)}`;

        const expEl = document.getElementById('total-expense');
        if (expEl) expEl.textContent = `Rp ${Utils.formatNumber(totalExpense)}`;
    }

    return { transactionRow, categoryChart, recentTransactions, monthlySummary, summaryCards };
})();

/* ============================================================
   6. FILTER
   ============================================================ */
function applyFilter(all) {
    const type   = document.getElementById('filter-type')?.value   || 'all';
    const period = document.getElementById('filter-period')?.value || 'all';
    const today  = Utils.todayStr();
    const week   = Utils.weekAgoStr();
    const month  = Utils.monthStartStr();

    return all.filter(t => {
        if (type !== 'all' && t.type !== type)   return false;
        if (period === 'today' && t.date !== today) return false;
        if (period === 'week'  && t.date < week)    return false;
        if (period === 'month' && t.date < month)   return false;
        return true;
    });
}

/* ============================================================
   7. APP — Central controller
   ============================================================ */
const App = (() => {

    async function refreshAll() {
        const all      = await DB.getAll();
        const filtered = applyFilter(all);

        // Summary cards
        Render.summaryCards(all);

        // Transaction list
        const listEl  = document.getElementById('transaction-list');
        const emptyEl = document.getElementById('empty-state');
        if (listEl) {
            const sorted = [...filtered].reverse();
            if (sorted.length) {
                listEl.innerHTML      = sorted.map(Render.transactionRow).join('');
                if (emptyEl) emptyEl.style.display = 'none';
            } else {
                listEl.innerHTML = '';
                if (emptyEl) emptyEl.style.display = 'block';
            }
        }

        const txCount = document.getElementById('tx-count');
        if (txCount) {
            txCount.textContent = `${all.length} transaksi tersimpan`
                + (filtered.length !== all.length ? ` · ${filtered.length} ditampilkan` : '');
        }

        Utils.setDBBadge(true, all.length);

        // Dashboard charts
        Render.categoryChart('dash-expense-chart', all, 'expense');
        Render.recentTransactions('dash-recent', all);

        // Statistics charts
        Render.categoryChart('expense-chart', all, 'expense');
        Render.categoryChart('income-chart',  all, 'income');
        Render.monthlySummary('monthly-summary', all);
    }

    async function deleteTransaction(id) {
        if (!confirm('Hapus transaksi ini?')) return;
        try {
            await DB.remove(id);
            Utils.showToast('Transaksi dihapus', 'info');
            await refreshAll();
        } catch {
            Utils.showToast('Gagal menghapus transaksi', 'error');
        }
    }

    async function exportExcel() {
        const all = await DB.getAll();
        if (!all.length) { Utils.showToast('Tidak ada data untuk diekspor', 'error'); return; }

        Utils.showToast('Menyiapkan file Excel...', 'info');
        const WB = XLSX.utils.book_new();
        const sorted = [...all].sort((a, b) => a.date.localeCompare(b.date));

        // Sheet 1: Detail
        const detail = [
            ['ID', 'Tanggal', 'Jenis', 'Kategori', 'Deskripsi', 'Nominal (Rp)'],
            ...sorted.map(t => [t.id, t.date,
                t.type === 'income' ? 'Uang Masuk' : 'Uang Keluar',
                t.category || 'Lainnya', t.description || '', t.amount])
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(detail);
        ws1['!cols'] = [{wch:6},{wch:14},{wch:14},{wch:22},{wch:30},{wch:18}];
        XLSX.utils.book_append_sheet(WB, ws1, 'Detail Transaksi');

        // Sheet 2: Ringkasan Harian
        const dayMap = {};
        sorted.forEach(t => {
            if (!dayMap[t.date]) dayMap[t.date] = { in: 0, out: 0 };
            dayMap[t.date][t.type === 'income' ? 'in' : 'out'] += t.amount;
        });
        const ws2 = XLSX.utils.aoa_to_sheet([
            ['Tanggal', 'Total Pemasukan (Rp)', 'Total Pengeluaran (Rp)', 'Saldo Harian (Rp)'],
            ...Object.entries(dayMap).map(([d, v]) => [d, v.in, v.out, v.in - v.out])
        ]);
        ws2['!cols'] = [{wch:14},{wch:22},{wch:24},{wch:20}];
        XLSX.utils.book_append_sheet(WB, ws2, 'Ringkasan Harian');

        // Sheet 3: Per Kategori
        const catMap = {};
        sorted.forEach(t => {
            const k = `${t.category || 'Lainnya'}__${t.type}`;
            catMap[k] = (catMap[k] || 0) + t.amount;
        });
        const ws3 = XLSX.utils.aoa_to_sheet([
            ['Kategori', 'Jenis', 'Total (Rp)'],
            ...Object.entries(catMap).map(([k, v]) => {
                const [cat, type] = k.split('__');
                return [cat, type === 'income' ? 'Pemasukan' : 'Pengeluaran', v];
            })
        ]);
        ws3['!cols'] = [{wch:24},{wch:14},{wch:18}];
        XLSX.utils.book_append_sheet(WB, ws3, 'Per Kategori');

        // Sheet 4: Rekap
        const totalIn  = sorted.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const totalOut = sorted.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const dates    = sorted.map(t => t.date);
        const ws4 = XLSX.utils.aoa_to_sheet([
            ['Rekap Keseluruhan', ''],
            ['Total Transaksi',   sorted.length],
            ['Total Pemasukan',   totalIn],
            ['Total Pengeluaran', totalOut],
            ['Saldo Bersih',      totalIn - totalOut],
            ['Periode', dates.length ? `${dates[0]} s/d ${dates[dates.length - 1]}` : '—'],
            ['Diekspor pada', new Date().toLocaleString('id-ID')]
        ]);
        ws4['!cols'] = [{wch:22},{wch:28}];
        XLSX.utils.book_append_sheet(WB, ws4, 'Rekap');

        XLSX.writeFile(WB, `financial-tracker-${Utils.todayStr()}.xlsx`);
        Utils.showToast('File Excel berhasil diunduh!');
    }

    function bindEvents() {
        // Populate categories on type change
        const typeEl = document.getElementById('type');
        if (typeEl) {
            typeEl.addEventListener('change', () => populateCategories(typeEl.value));
        }

        // Form submit
        document.getElementById('transaction-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type        = document.getElementById('type').value;
            const amount      = parseFloat(document.getElementById('amount').value);
            const description = document.getElementById('description').value.trim();
            const category    = document.getElementById('category').value || 'Lainnya';
            const date        = document.getElementById('date').value || Utils.todayStr();

            if (!amount || amount <= 0) { Utils.showToast('Nominal harus lebih dari 0', 'error'); return; }
            if (!description)           { Utils.showToast('Deskripsi harus diisi', 'error'); return; }

            try {
                await DB.add({ type, amount, description, category, date, createdAt: Date.now() });
                document.getElementById('amount').value      = '';
                document.getElementById('description').value = '';
                document.getElementById('category').value    = '';
                document.getElementById('date').value        = Utils.todayStr();
                Utils.showToast(`Transaksi "${description}" berhasil disimpan`);
                await refreshAll();
            } catch {
                Utils.showToast('Gagal menyimpan transaksi', 'error');
            }
        });

        // Clear all
        document.getElementById('clear-all-btn')?.addEventListener('click', async () => {
            const all = await DB.getAll();
            if (!all.length) { Utils.showToast('Tidak ada data untuk dihapus', 'info'); return; }
            if (!confirm(`Hapus semua ${all.length} transaksi? Tindakan ini tidak dapat dibatalkan.`)) return;
            try {
                await DB.clearAll();
                Utils.showToast('Semua data berhasil dihapus', 'info');
                await refreshAll();
            } catch {
                Utils.showToast('Gagal menghapus semua data', 'error');
            }
        });

        // Filter changes
        document.getElementById('filter-type')?.addEventListener('change', refreshAll);
        document.getElementById('filter-period')?.addEventListener('change', refreshAll);

        // Export
        document.getElementById('export-btn')?.addEventListener('click', exportExcel);
    }

    async function init() {
        try {
            await DB.open();

            // Set default date
            const dateEl = document.getElementById('date');
            if (dateEl) dateEl.value = Utils.todayStr();

            // Populate categories default (income)
            populateCategories('income');

            // Bind all events
            bindEvents();

            // Register router pages
            Router.register('dashboard',    refreshAll);
            Router.register('transactions', refreshAll);
            Router.register('statistics',   refreshAll);

            // Init router (resolves current hash)
            Router.init();

            // Initial data load
            await refreshAll();

        } catch (err) {
            console.error('Init error:', err);
            Utils.setDBBadge(false, 0);
            Utils.showToast('Gagal membuka database', 'error');
        }
    }

    return { init, deleteTransaction };
})();

/* ============================================================
   HELPERS (module-level, dipanggil dari template)
   ============================================================ */
function populateCategories(type) {
    const sel  = document.getElementById('category');
    if (!sel) return;
    const cats = CATEGORIES[type] || CATEGORIES.income;
    sel.innerHTML = '<option value="">-- Pilih Kategori --</option>';
    cats.forEach(c => {
        const o = document.createElement('option');
        o.value = c; o.textContent = c;
        sel.appendChild(o);
    });
}

/* ============================================================
   START
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => App.init());

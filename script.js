// ===== State =====
const state = {
    currentPage: 'home',
    homePage: 1,
    totalPages: 1,
    favorites: JSON.parse(localStorage.getItem('modhub_favorites') || '[]'),
    theme: localStorage.getItem('modhub_theme') || 'light',
    searchQuery: '',
};

// ===== DOM References =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const app = $('#app');
const loading = $('#loading');
const content = $('#contentContainer');
const bottomNav = $('#bottomNav');
const searchBar = $('#searchBar');
const searchInput = $('#searchInput');
const searchBtn = $('#searchBtn');
const searchToggle = $('#searchToggle');
const themeToggle = $('#themeToggle');
const mainContent = $('#mainContent');
const installBanner = $('#installBanner');
const installBtn = $('#installBtn');
const closeInstallBanner = $('#closeInstallBanner');

// ===== API Base =====
const API_BASE = window.location.origin;

// ===== Toast =====
function showToast(message, duration = 2500) {
    let toast = $('#toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._hide);
    toast._hide = setTimeout(() => toast.classList.remove('show'), duration);
}

// ===== Theme =====
function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('modhub_theme', theme);
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// ===== Favorites =====
function toggleFavorite(id) {
    const idx = state.favorites.indexOf(id);
    if (idx > -1) {
        state.favorites.splice(idx, 1);
        showToast('Dihapus dari favorit');
    } else {
        state.favorites.push(id);
        showToast('Ditambahkan ke favorit ❤️');
    }
    localStorage.setItem('modhub_favorites', JSON.stringify(state.favorites));
    if (state.currentPage === 'favorites') renderFavorites();
    if (state.currentPage === 'detail') {
        updateFavoriteButton();
    }
}

function isFavorite(id) {
    return state.favorites.includes(id);
}

// ===== Navigation =====
function navigateTo(page, params = {}) {
    state.currentPage = page;
    
    // Update nav
    $$('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });
    
    // Hide search bar
    searchBar.classList.add('hidden');
    
    // Render page
    switch (page) {
        case 'home':
            renderHome(state.homePage);
            break;
        case 'search':
            renderSearch();
            break;
        case 'favorites':
            renderFavorites();
            break;
        case 'settings':
            renderSettings();
            break;
        case 'detail':
            renderDetail(params.id);
            break;
        default:
            renderHome(1);
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== Fetch with Cache =====
const cache = new Map();

async function fetchAPI(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `${API_BASE}/api/${endpoint}?${query}`;
    const cacheKey = url;
    
    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.time < 600000) { // 10 min
            return cached.data;
        }
    }
    
    try {
        const res = await fetch(url, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await res.json();
        if (data.status) {
            cache.set(cacheKey, { data, time: Date.now() });
            return data;
        }
        throw new Error(data.message || 'Gagal memuat data');
    } catch (err) {
        throw new Error(err.message);
    }
}

// ===== Render Home =====
async function renderHome(page = 1) {
    content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="loader-circle" style="margin:0 auto;"></div></div>';
    
    try {
        const data = await fetchAPI('home', { page });
        const games = data.result.games || [];
        state.totalPages = data.result.total_pages || 1;
        state.homePage = page;
        
        if (games.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gamepad"></i>
                    <h3>Tidak ada game ditemukan</h3>
                    <p>Coba halaman lain</p>
                </div>
            `;
            return;
        }
        
        let html = `<div class="game-grid">`;
        games.forEach(game => {
            html += `
                <div class="game-card" onclick="openDetail('${game.id}')">
                    <img src="${game.thumbnail || 'https://via.placeholder.com/200x200/1a2332/4a5568?text=No+Image'}" 
                         alt="${game.title}" loading="lazy" 
                         onerror="this.src='https://via.placeholder.com/200x200/1a2332/4a5568?text=No+Image'">
                    <div class="info">
                        <div class="title">${game.title}</div>
                        <div class="developer">${game.developer || 'Unknown'}</div>
                        <div class="rating">
                            <i class="fas fa-star"></i>
                            ${game.rating ? game.rating.toFixed(1) : '0.0'}
                        </div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
        
        // Pagination
        if (state.totalPages > 1) {
            html += `<div class="pagination">
                <button onclick="renderHome(${page - 1})" ${page <= 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span class="page-info">Halaman ${page} dari ${state.totalPages}</span>
                <button onclick="renderHome(${page + 1})" ${page >= state.totalPages ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>`;
        }
        
        content.innerHTML = html;
    } catch (err) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Gagal memuat data</h3>
                <p>${err.message}</p>
                <button onclick="renderHome(${state.homePage})" 
                        style="margin-top:12px;padding:10px 24px;background:var(--accent);color:white;border:none;border-radius:8px;cursor:pointer;">
                    Coba Lagi
                </button>
            </div>
        `;
    }
}

// ===== Render Detail =====
async function renderDetail(id) {
    content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="loader-circle" style="margin:0 auto;"></div></div>';
    
    try {
        const data = await fetchAPI('detail', { id });
        const game = data.result;
        
        const fav = isFavorite(game.id);
        const downloadUrl = game.download_url || game.an1_store_url || '#';
        
        let featuresHtml = '';
        if (game.features && game.features.length > 0) {
            featuresHtml = `
                <div class="detail-features">
                    <h4>✨ Fitur Mod</h4>
                    <ul>
                        ${game.features.map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        let modInfoHtml = '';
        if (game.mod_info) {
            modInfoHtml = `
                <div class="detail-features" style="background:var(--accent-light);border-left:3px solid var(--accent);">
                    <h4>📦 Info Mod</h4>
                    <p style="font-size:13px;color:var(--text-secondary);margin:0;">${game.mod_info}</p>
                </div>
            `;
        }
        
        let screenshotsHtml = '';
        if (game.screenshots && game.screenshots.length > 0) {
            screenshotsHtml = `
                <div style="margin:12px 0;overflow-x:auto;display:flex;gap:10px;padding-bottom:8px;">
                    ${game.screenshots.slice(0, 5).map(s => `
                        <img src="${s}" alt="Screenshot" 
                             style="min-width:140px;height:100px;object-fit:cover;border-radius:8px;background:var(--bg-primary);"
                             onerror="this.style.display='none'">
                    `).join('')}
                </div>
            `;
        }
        
        content.innerHTML = `
            <button class="back-btn" onclick="navigateTo('home')">
                <i class="fas fa-arrow-left"></i> Kembali
            </button>
            <div class="detail-container">
                <img class="detail-thumbnail" src="${game.thumbnail || 'https://via.placeholder.com/600x337/1a2332/4a5568?text=No+Image'}" 
                     alt="${game.title}" onerror="this.src='https://via.placeholder.com/600x337/1a2332/4a5568?text=No+Image'">
                <div class="detail-body">
                    <div style="display:flex;justify-content:space-between;align-items:start;">
                        <h1 class="detail-title">${game.title}</h1>
                        <button onclick="toggleFavorite('${game.id}')" 
                                style="background:none;border:none;font-size:28px;cursor:pointer;padding:4px;">
                            ${fav ? '❤️' : '🤍'}
                        </button>
                    </div>
                    <div class="detail-meta">
                        <span><i class="fas fa-user"></i> ${game.developer || 'Unknown'}</span>
                        <span><i class="fas fa-tag"></i> ${game.category || 'Game'}</span>
                        ${game.version ? `<span><i class="fas fa-code-branch"></i> v${game.version}</span>` : ''}
                        ${game.size ? `<span><i class="fas fa-database"></i> ${game.size}</span>` : ''}
                        ${game.android_requirement ? `<span><i class="fab fa-android"></i> ${game.android_requirement}</span>` : ''}
                    </div>
                    ${screenshotsHtml}
                    <div class="detail-description">
                        ${game.description || 'Tidak ada deskripsi.'}
                    </div>
                    ${modInfoHtml}
                    ${featuresHtml}
                    <a href="${downloadUrl}" target="_blank" rel="noopener" 
                       class="detail-download-btn" onclick="if('${downloadUrl}'==='#'){event.preventDefault();showToast('Link download tidak tersedia');}">
                        <i class="fas fa-download"></i> Download ${game.size ? `(${game.size})` : ''}
                    </a>
                    ${game.google_play_url ? `
                        <a href="${game.google_play_url}" target="_blank" rel="noopener"
                           style="display:block;text-align:center;margin-top:10px;color:var(--accent);font-size:13px;text-decoration:none;">
                            <i class="fab fa-google-play"></i> Lihat di Google Play
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    } catch (err) {
        content.innerHTML = `
            <button class="back-btn" onclick="navigateTo('home')">
                <i class="fas fa-arrow-left"></i> Kembali
            </button>
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Gagal memuat detail</h3>
                <p>${err.message}</p>
                <button onclick="renderDetail('${id}')" 
                        style="margin-top:12px;padding:10px 24px;background:var(--accent);color:white;border:none;border-radius:8px;cursor:pointer;">
                    Coba Lagi
                </button>
            </div>
        `;
    }
}

function openDetail(id) {
    navigateTo('detail', { id });
}

// ===== Render Search =====
async function renderSearch(query = '') {
    if (!query) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Cari Game & Aplikasi</h3>
                <p>Ketik di atas untuk mencari mod favoritmu</p>
            </div>
        `;
        return;
    }
    
    content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="loader-circle" style="margin:0 auto;"></div></div>';
    
    try {
        const data = await fetchAPI('search', { query });
        const results = data.result.results || [];
        
        if (results.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Tidak ditemukan</h3>
                    <p>Hasil pencarian untuk "${query}"</p>
                </div>
            `;
            return;
        }
        
        let html = `<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
            Menampilkan ${results.length} hasil untuk "${query}"
        </p><div class="game-grid">`;
        
        results.forEach(game => {
            html += `
                <div class="game-card" onclick="openDetail('${game.id}')">
                    <img src="${game.thumbnail || 'https://via.placeholder.com/200x200/1a2332/4a5568?text=No+Image'}" 
                         alt="${game.title}" loading="lazy"
                         onerror="this.src='https://via.placeholder.com/200x200/1a2332/4a5568?text=No+Image'">
                    <div class="info">
                        <div class="title">${game.title}</div>
                        <div class="developer">${game.developer || 'Unknown'}</div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
        
        content.innerHTML = html;
    } catch (err) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Gagal mencari</h3>
                <p>${err.message}</p>
            </div>
        `;
    }
}

// ===== Render Favorites =====
function renderFavorites() {
    const ids = state.favorites;
    if (ids.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-heart" style="color:var(--accent);"></i>
                <h3>Belum Ada Favorit</h3>
                <p>Mulai tandai game favoritmu dengan klik ❤️</p>
            </div>
        `;
        return;
    }
    
    content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="loader-circle" style="margin:0 auto;"></div></div>';
    
    Promise.all(ids.map(id => 
        fetchAPI('detail', { id }).catch(() => null)
    )).then(results => {
        const games = results.filter(r => r && r.status);
        if (games.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-heart" style="color:var(--accent);"></i>
                    <h3>Tidak Ada Favorit</h3>
                    <p>Beberapa game mungkin sudah tidak tersedia</p>
                </div>
            `;
            return;
        }
        
        let html = `<div class="game-grid">`;
        games.forEach(data => {
            const game = data.result;
            html += `
                <div class="game-card" onclick="openDetail('${game.id}')">
                    <img src="${game.thumbnail || 'https://via.placeholder.com/200x200/1a2332/4a5568?text=No+Image'}" 
                         alt="${game.title}" loading="lazy"
                         onerror="this.src='https://via.placeholder.com/200x200/1a2332/4a5568?text=No+Image'">
                    <div class="info">
                        <div class="title">${game.title}</div>
                        <div class="developer">${game.developer || 'Unknown'}</div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
        content.innerHTML = html;
    }).catch(() => {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Gagal memuat favorit</h3>
                <p>Coba lagi nanti</p>
            </div>
        `;
    });
}

// ===== Render Settings =====
function renderSettings() {
    const isDark = state.theme === 'dark';
    content.innerHTML = `
        <h2 style="margin-bottom:16px;font-size:20px;">⚙️ Pengaturan</h2>
        <div class="settings-list">
            <div class="settings-item" onclick="toggleTheme()">
                <div class="left">
                    <i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}"></i>
                    <span class="label">Mode ${isDark ? 'Terang' : 'Gelap'}</span>
                </div>
                <label class="switch">
                    <input type="checkbox" ${isDark ? 'checked' : ''} onchange="toggleTheme()">
                    <span class="slider"></span>
                </label>
            </div>
            <div class="settings-item" onclick="if(confirm('Hapus semua favorit?')){localStorage.removeItem('modhub_favorites');state.favorites=[];showToast('Favorit dihapus');navigateTo('settings');}">
                <div class="left">
                    <i class="fas fa-trash" style="color:#ef4444;"></i>
                    <span class="label">Hapus Semua Favorit</span>
                </div>
                <i class="fas fa-chevron-right" style="color:var(--text-secondary);font-size:14px;"></i>
            </div>
            <div class="settings-item" onclick="if(confirm('Hapus semua cache?')){cache.clear();showToast('Cache dihapus');}">
                <div class="left">
                    <i class="fas fa-eraser"></i>
                    <span class="label">Hapus Cache</span>
                </div>
                <i class="fas fa-chevron-right" style="color:var(--text-secondary);font-size:14px;"></i>
            </div>
        </div>
        <div style="text-align:center;margin-top:30px;font-size:12px;color:var(--text-secondary);">
            ModHub v1.0.0
        </div>
    `;
}

// ===== Search Handler =====
function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        showToast('Masukkan kata kunci pencarian');
        return;
    }
    state.searchQuery = query;
    navigateTo('search');
    renderSearch(query);
}

// ===== PWA Install =====
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
});

function showInstallBanner() {
    if (deferredPrompt) {
        installBanner.classList.remove('hidden');
    }
}

function hideInstallBanner() {
    installBanner.classList.add('hidden');
}

installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === 'accepted') {
            showToast('🎉 ModHub berhasil diinstall!');
        } else {
            showToast('Install dibatalkan');
        }
        deferredPrompt = null;
        hideInstallBanner();
    }
});

closeInstallBanner.addEventListener('click', hideInstallBanner);

// Check if already installed
window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    showToast('🎉 ModHub berhasil diinstall!');
});

// ===== Event Listeners =====
searchToggle.addEventListener('click', () => {
    searchBar.classList.toggle('hidden');
    if (!searchBar.classList.contains('hidden')) {
        searchInput.focus();
    }
});

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
});

themeToggle.addEventListener('click', toggleTheme);

// ===== Init =====
async function init() {
    // Apply theme
    applyTheme(state.theme);
    
    // Load home
    await renderHome(1);
    
    // Hide loading
    loading.classList.add('hidden');
    app.style.display = 'block';
    
    // Check for service worker
    if ('serviceWorker' in navigator) {
        try {
            navigator.serviceWorker.register('/sw.js');
        } catch (e) {
            // SW registration failed, continue
        }
    }
}

// Start
document.addEventListener('DOMContentLoaded', init);
const webapp = window.Telegram.WebApp;
webapp.expand();
webapp.ready();

// STATE
let allUsers = [];
let allOrders = [];
let allDeposits = [];
let currentEditingUserId = null;
let currentOrderFilter = 'completed';
let currentDepositFilter = 'ALL';
let currentUserFilter = 'active'; // 'active' or 'banned'
let userSearchQuery = '';
let orderSearchQuery = '';
let depositSearchQuery = '';
let allCountries = [];
let countrySearchQuery = '';
let currentCountryFilter = 'active'; // 'active' or 'inactive'
let allSettings = {};
let allChannels = [];
let currentEditingSettingKey = null;
let currentEditingSettingType = 'text';

// Pagination State
let currentUserPage = 1;
const usersPerPage = 5;

let currentCountryPage = 1;
const countriesPerPage = 5;

let currentOrderPage = 1;
const ordersPerPage = 5;

let currentEditingCountryCode = null;
let currentEditingCountryEnabled = false;

// Channel pagination
let currentChannelPage = 1;
const channelsPerPage = 5;

// INIT
async function init() {
    try {
        await refreshData();

        // Search Handlers
        const userSearch = document.getElementById('user-search-v2');
        if (userSearch) userSearch.addEventListener('input', (e) => { userSearchQuery = e.target.value; });

        const countrySearch = document.getElementById('country-search-v2');
        if (countrySearch) {
            countrySearch.addEventListener('input', (e) => { countrySearchQuery = e.target.value; });
        }

        // Restore previous page if exists
        const lastPage = sessionStorage.getItem('admin_last_page');
        if (lastPage && lastPage !== 'dashboard') {
            switchPage(lastPage);
        }

        // Hide loader, show app
        document.body.classList.remove('loading');
        document.getElementById('loader').style.display = 'none';
        document.getElementById('app').style.display = 'block';
    } catch (err) {
        console.error('Init error:', err);
        document.body.classList.remove('loading');
        document.getElementById('loader').innerHTML = `
            <div class="loader-content" style="text-align: center; padding: 20px;">
                <span style="font-size: 2rem; display: block; margin-bottom: 10px;">⚠️</span>
                <span style="font-weight: 700; color: #fff; display: block; margin-bottom: 5px;">Failed to load dashboard</span>
                <span style="font-size: 0.8rem; color: #94a3b8; opacity: 0.8;">${err.message}</span>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; cursor: pointer;">Retry</button>
            </div>
        `;
    }
}

// DATA FETCHING
function getHeaders() {
    return { 'x-telegram-init-data': webapp.initData };
}

async function refreshData() {
    try {
        // Fetch all core data in parallel
        const [statsRes, usersRes, ordersRes, depositsRes, countriesRes] = await Promise.all([
            fetch('/api/admin/stats', { headers: getHeaders() }),
            fetch('/api/admin/users', { headers: getHeaders() }),
            fetch('/api/admin/orders', { headers: getHeaders() }),
            fetch('/api/admin/deposits', { headers: getHeaders() }),
            fetch('/api/admin/countries', { headers: getHeaders() })
        ]);

        // Check core APIs - these must succeed
        const coreChecks = {
            'Stats': statsRes,
            'Users': usersRes,
            'Orders': ordersRes,
            'Deposits': depositsRes,
            'Countries': countriesRes
        };

        for (const [name, res] of Object.entries(coreChecks)) {
            if (!res.ok) {
                throw new Error(`API Error (${name}): ${res.status} ${res.statusText}`);
            }
        }

        const stats = await statsRes.json();
        allUsers = await usersRes.json();
        allOrders = await ordersRes.json();
        allDeposits = await depositsRes.json();
        allCountries = await countriesRes.json();

        // Fetch secondary APIs with graceful fallback
        try {
            const settingsRes = await fetch('/api/admin/settings', { headers: getHeaders() });
            if (settingsRes.ok) { allSettings = await settingsRes.json(); }
        } catch (e) { console.warn('[WARN] Settings API unavailable:', e.message); }

        try {
            const channelsRes = await fetch('/api/admin/channels', { headers: getHeaders() });
            if (channelsRes.ok) { allChannels = await channelsRes.json(); }
        } catch (e) { console.warn('[WARN] Channels API unavailable:', e.message); }

        // Update Bot Name in Sidebar
        const sidebarTitle = document.querySelector('.sidebar-title');
        if (sidebarTitle) sidebarTitle.textContent = allSettings.bot_name || 'Pulse Bot';

        // Update Overview stats
        const sTotalUsers = document.getElementById('stat-total-users');
        const sActiveUsers = document.getElementById('stat-active-users');
        const sBannedUsers = document.getElementById('stat-banned-users');
        const sTotalOrders = document.getElementById('stat-total-orders');
        const sTotalCompleted = document.getElementById('stat-total-completed');
        const sTotalCancelled = document.getElementById('stat-total-cancelled');
        const sTotalDepositsCount = document.getElementById('stat-total-deposits-count');
        const sTotalDepositsAmount = document.getElementById('stat-total-deposits-amount');
        const sTotalCountries = document.getElementById('stat-total-countries');
        const sActiveCountries = document.getElementById('stat-active-countries');
        const sInactiveCountries = document.getElementById('stat-inactive-countries');

        if (sTotalUsers) sTotalUsers.textContent = stats.totalUsers || 0;
        if (sActiveUsers) sActiveUsers.textContent = (stats.totalUsers || 0) - (stats.bannedUsers || 0);
        if (sBannedUsers) sBannedUsers.textContent = stats.bannedUsers || 0;
        if (sTotalOrders) sTotalOrders.textContent = stats.totalOrdersCount || 0;
        if (sTotalCompleted) sTotalCompleted.textContent = stats.successfulOrders || 0;
        if (sTotalCancelled) sTotalCancelled.textContent = stats.cancelledOrdersCount || 0;
        if (sTotalDepositsCount) sTotalDepositsCount.textContent = stats.totalDepositsCount || 0;
        if (sTotalDepositsAmount) sTotalDepositsAmount.textContent = `$${(stats.totalDepositsAmount || 0).toFixed(2)}`;

        if (sTotalCountries) sTotalCountries.textContent = allCountries.length;
        if (sActiveCountries) sActiveCountries.textContent = allCountries.filter(c => c.isEnabled).length;
        if (sInactiveCountries) sInactiveCountries.textContent = allCountries.filter(c => !c.isEnabled).length;

        // Populate Sub-page Inputs
        const inputBotName = document.getElementById('input-bot-name');
        if (inputBotName) inputBotName.value = allSettings.bot_name || 'Pulse Bot';

        const maintenanceToggle = document.getElementById('maintenance-toggle-btn');
        if (maintenanceToggle) {
            const isMMode = allSettings.maintenance_mode === 'true';
            maintenanceToggle.classList.toggle('active', isMMode);
        }

        const inputRefPercent = document.getElementById('input-referral-percent');
        if (inputRefPercent) inputRefPercent.value = allSettings.referral_percent || '5';

        const inputRefMin = document.getElementById('input-referral-min');
        if (inputRefMin) inputRefMin.value = allSettings.min_withdrawal || '1';

        // Update User page stats
        const uStatTotal = document.getElementById('user-stat-total');
        const uStatBanned = document.getElementById('user-stat-banned');
        const uStatActive = document.getElementById('user-stat-active');
        if (uStatTotal) uStatTotal.textContent = stats.totalUsers || 0;
        if (uStatBanned) uStatBanned.textContent = stats.bannedUsers || 0;
        if (uStatActive) uStatActive.textContent = (stats.totalUsers || 0) - (stats.bannedUsers || 0);





        // Update Countries stats
        const cStatTotal = document.getElementById('country-stat-total');
        const cStatActive = document.getElementById('country-stat-active');
        const cStatInactive = document.getElementById('country-stat-inactive');
        if (cStatTotal) cStatTotal.textContent = allCountries.length;
        if (cStatActive) cStatActive.textContent = allCountries.filter(c => c.isEnabled).length;
        if (cStatInactive) cStatInactive.textContent = allCountries.filter(c => !c.isEnabled).length;

        // Render lists
        try { applyUserFilters(); } catch (e) { console.error('Users render error:', e); }
        try { renderCountries(); } catch (e) { console.error('Countries render error:', e); }
        try { renderMandatoryChannels(); } catch (e) { console.error('Channels render error:', e); }
    } catch (err) {
        console.error('Data refresh error:', err);
        throw err;
    }
}

// --- SETTINGS OVERHAUL ---

window.toggleSettingUI = (targetId) => {
    const btn = document.getElementById(targetId);
    if (btn) btn.classList.toggle('active');
};

window.saveSetting = async (key, elementId, type) => {
    let value = '';

    if (type === 'text') {
        value = document.getElementById(elementId).value;
    } else if (type === 'toggle') {
        value = document.getElementById(elementId).classList.contains('active') ? 'true' : 'false';
    }

    try {
        const res = await fetch('/api/admin/settings/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ key, value })
        });

        if (res.ok) {
            showOzAlert('Updated!', 'Settings have been saved successfully.');
            if (key === 'bot_name') {
                const sidebarTitle = document.querySelector('.sidebar-title');
                if (sidebarTitle) sidebarTitle.textContent = value;
            }
            refreshData();
        } else {
            throw new Error('Update failed');
        }
    } catch (err) {
        console.error('Save setting error:', err);
        showOzToast('error', 'Failed', 'Could not save setting.');
    }
};

window.saveReferralSettings = async () => {
    const percent = document.getElementById('input-referral-percent').value;
    const min = document.getElementById('input-referral-min').value;

    try {
        await Promise.all([
            fetch('/api/admin/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({ key: 'referral_percent', value: percent })
            }),
            fetch('/api/admin/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({ key: 'min_withdrawal', value: min })
            })
        ]);

        showOzAlert('Config Saved', 'Referral settings have been updated successfully.');
        refreshData();
    } catch (err) {
        console.error('Save referral settings error:', err);
        showOzToast('error', 'Error', 'Failed to save referral settings.');
    }
};

window.openSettingsEditor = (key, label, type) => {
    // Legacy function, no longer used with sub-pages
};

window.closeSettingsModal = () => {
    // Legacy function, no longer used with sub-pages
};

// NAVIGATION
window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('open');
};

window.switchPage = (pageName) => {
    sessionStorage.setItem('admin_last_page', pageName);
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });

    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === `page-${pageName}`;
        page.classList.toggle('active', isActive);
        if (isActive) page.scrollTop = 0; // Reset scroll to top on switch
    });

    const titles = {
        dashboard: 'Overview',
        users: 'User Management',
        countries: 'Countries',
        settings: 'Settings',
        'settings-bot-name': 'Bot Identity',
        'settings-maintenance': 'System Control',
        'settings-channels': 'Subscription Channels'
    };
    document.getElementById('page-title').textContent = titles[pageName] || 'Overview';
    document.getElementById('sidebar').classList.remove('open');

    // Re-render channel list on page visit to ensure empty state shows
    if (pageName === 'settings-channels') {
        renderMandatoryChannels();
    }
};

window.triggerSearch = (type) => {
    if (type === 'user') {
        userSearchQuery = document.getElementById('user-search-v2').value;
        const resetBtn = document.getElementById('reset-search-container');
        if (resetBtn) resetBtn.style.display = userSearchQuery.trim() ? 'block' : 'none';

        currentUserPage = 1; // Reset to page 1 on new search
        applyUserFilters();
    } else if (type === 'country') {
        countrySearchQuery = document.getElementById('country-search-v2').value;
        const resetBtn = document.getElementById('reset-country-search-container');
        if (resetBtn) resetBtn.style.display = countrySearchQuery.trim() ? 'block' : 'none';

        currentCountryPage = 1;
        renderCountries();
    } else if (type === 'order') {
        orderSearchQuery = document.getElementById('order-search-v2').value;
        const resetBtn = document.getElementById('reset-order-search-container');
        if (resetBtn) resetBtn.style.display = orderSearchQuery.trim() ? 'block' : 'none';
        applyOrderFilters();
    }
};

window.resetSearch = (type) => {
    if (type === 'user') {
        const input = document.getElementById('user-search-v2');
        if (input) input.value = '';
        userSearchQuery = '';
        const resetBtn = document.getElementById('reset-search-container');
        if (resetBtn) resetBtn.style.display = 'none';

        currentUserPage = 1;
        applyUserFilters();
    } else if (type === 'country') {
        const input = document.getElementById('country-search-v2');
        if (input) input.value = '';
        countrySearchQuery = '';
        const resetBtn = document.getElementById('reset-country-search-container');
        if (resetBtn) resetBtn.style.display = 'none';

        currentCountryPage = 1;
        renderCountries();
    } else if (type === 'order') {
        const input = document.getElementById('order-search-v2');
        if (input) input.value = '';
        orderSearchQuery = '';
        const resetBtn = document.getElementById('reset-order-search-container');
        if (resetBtn) resetBtn.style.display = 'none';
        applyOrderFilters();
    }
};

// FILTERS
function applyUserFilters() {
    if (!allUsers) return;
    let filtered = allUsers.filter(u => {
        const isBanned = u.isBanned || false;
        if (currentUserFilter === 'active') return !isBanned;
        if (currentUserFilter === 'banned') return isBanned;
        return true;
    });
    if (userSearchQuery) {
        const q = userSearchQuery.toLowerCase();
        filtered = filtered.filter(u => {
            const tid = String(u.telegramId || '').toLowerCase();
            const uname = String(u.username || '').toLowerCase();
            const fname = String(u.firstName || '').toLowerCase();
            return tid.includes(q) || uname.includes(q) || fname.includes(q);
        });
    }
    currentUserPage = 1; // Reset to first page on filter/search change
    renderUsersList(filtered);
}





// RENDERERS
function renderUsersList(users) {
    const list = document.getElementById('users-list');
    if (!list) return;

    if (!users.length) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-users-slash"></i><span>No users found</span></div>`;
        document.getElementById('user-pagination').innerHTML = '';
        return;
    }

    const start = (currentUserPage - 1) * usersPerPage;
    const paginated = users.slice(start, start + usersPerPage);

    list.innerHTML = paginated.map((u, index) => {
        const globalIndex = start + index + 1;
        return `
        <div class="user-container" onclick="openUserModal(${u.id}, '${escapeHtml(u.firstName || 'Unknown')}', '${escapeHtml(u.username || 'none')}', ${u.balance}, ${u.isBanned})">
            <div class="user-card-index">${globalIndex}</div>
            <div class="user-row">
                <span class="user-row-label">Account Status</span>
                <span class="user-row-value ${u.isBanned ? 'color-red' : 'color-green'}">${u.isBanned ? 'BANNED' : '<i class="fas fa-check"></i> ACTIVE'}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Full Name</span>
                <span class="user-row-value color-yellow">${escapeHtml(u.firstName || 'Unknown')}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Username</span>
                <span class="user-row-value color-blue-tint">@${escapeHtml(u.username || 'none')}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">User ID</span>
                <span class="user-row-value color-orange">${u.telegramId}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Balance</span>
                <span class="user-row-value color-blue-tint">$${parseFloat(u.balance || 0).toFixed(2)}</span>
            </div>
            <div class="user-row"><span class="user-row-label">Spent</span><span class="user-row-value color-red">$${parseFloat(u.spent || 0).toFixed(2)}</span></div>
            <div class="user-row"><span class="user-row-label">Earned</span><span class="user-row-value color-green">$${parseFloat(u.referralBalance || 0).toFixed(2)}</span></div>
            <div class="user-row"><span class="user-row-label">Orders Made</span><span class="user-row-value color-purple">${u.ordersMade || 0}</span></div>
        </div>
    `}).join('');

    renderPagination(
        Math.ceil(users.length / usersPerPage),
        currentUserPage,
        (newPage) => {
            currentUserPage = newPage;
            const target = document.getElementById('user-management-section');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            renderUsersList(users);
        },
        document.getElementById('user-pagination'),
        'userPaginationCallback'
    );
}

function renderPagination(totalPages, currentPage, onPageChange, container, callbackName) {
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="window.${callbackName}(${currentPage - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
        <div class="pagination-text">Page ${currentPage} of ${totalPages}</div>
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.${callbackName}(${currentPage + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    window[callbackName] = (page) => {
        onPageChange(page);
    };
}

window.changeUserPage = (delta) => {
    currentUserPage += delta;
    const target = document.getElementById('user-management-section');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    applyUserFiltersPaginated();
};

function applyUserFiltersPaginated() {
    // Helper to render without resetting page to 1
    if (!allUsers) return;
    let filtered = allUsers.filter(u => {
        const isBanned = u.isBanned || false;
        if (currentUserFilter === 'active') return !isBanned;
        if (currentUserFilter === 'banned') return isBanned;
        return true;
    });
    if (userSearchQuery) {
        const q = userSearchQuery.toLowerCase();
        filtered = filtered.filter(u => {
            const tid = String(u.telegramId || '').toLowerCase();
            const uname = String(u.username || '').toLowerCase();
            const fname = String(u.firstName || '').toLowerCase();
            return tid.includes(q) || uname.includes(q) || fname.includes(q);
        });
    }
    renderUsersList(filtered);
}





// --- COUNTRIES LOGIC ---
window.renderCountries = () => {
    const list = document.getElementById('countries-list');
    const paginationContainer = document.getElementById('country-pagination');
    if (!list) return;

    list.innerHTML = '';

    let filtered = allCountries.filter(c => {
        const isEnabled = c.isEnabled || false;
        if (currentCountryFilter === 'active') return isEnabled;
        if (currentCountryFilter === 'inactive') return !isEnabled;
        return true;
    });

    if (countrySearchQuery) {
        const query = countrySearchQuery.toLowerCase();
        filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.code.toLowerCase().includes(query)
        );
    }

    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-globe"></i><span>No countries found</span></div>`;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(filtered.length / countriesPerPage);
    if (currentCountryPage > totalPages) currentCountryPage = totalPages || 1;

    const start = (currentCountryPage - 1) * countriesPerPage;
    const paginated = filtered.slice(start, start + countriesPerPage);

    list.innerHTML = paginated.map((c, index) => {
        const globalIndex = start + index + 1;
        const isLive = (c.stock || 0) > 0;
        const safeName = escapeHtml(c.name).replace(/'/g, "\\'");

        return `
        <div class="user-container" style="cursor: pointer;" onclick="openCountryModal('${c.code}', '${safeName}', ${c.stock || 0}, ${c.isEnabled}, ${c.price})">
            <div class="user-card-index">${globalIndex}</div>
            
            <div class="user-row">
                <span class="user-row-label">Status</span>
                <span class="user-row-value ${c.isEnabled ? 'color-green' : 'color-red'}">
                    ${c.isEnabled ? '<i class="fas fa-check"></i> ACTIVE' : 'INACTIVE'}
                </span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Name</span>
                <span class="user-row-value color-yellow">${c.flag} ${escapeHtml(c.name)}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Code</span>
                <span class="user-row-value color-blue-tint">${c.code.toUpperCase()}</span>
            </div>

            <div class="user-row">
                <span class="user-row-label">Avail</span>
                <span class="user-row-value" style="font-weight: 700; color: ${isLive ? '#30d158' : '#64748b'}">
                    ${c.stock || 0}
                </span>
            </div>
            
            <div class="user-row">
                <span class="user-row-label">Price</span>
                <span class="user-row-value color-orange">$${parseFloat(c.price || 0).toFixed(2)}</span>
            </div>
        </div>
        `;
    }).join('');

    renderPagination(
        totalPages,
        currentCountryPage,
        (newPage) => {
            currentCountryPage = newPage;
            const target = document.getElementById('country-management-section');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            renderCountries();
        },
        paginationContainer,
        'countryPaginationCallback'
    );
};

window.openCountryModal = (code, name, stock, isEnabled, price) => {
    currentEditingCountryCode = code;
    currentEditingCountryEnabled = isEnabled;

    document.getElementById('modal-country-name').textContent = name;
    document.getElementById('modal-country-code').textContent = code.toUpperCase();
    document.getElementById('modal-country-stock').textContent = `Stock: ${stock}`;
    document.getElementById('country-price-input').value = price;

    const toggleBtn = document.getElementById('modal-country-toggle-btn');
    if (isEnabled) {
        toggleBtn.textContent = 'Inactive';
        toggleBtn.className = 'gradient-btn btn-ban';
    } else {
        toggleBtn.textContent = 'Active';
        toggleBtn.className = 'gradient-btn btn-unban';
    }

    document.getElementById('country-modal').classList.add('active');
};

window.closeCountryModal = () => {
    document.getElementById('country-modal').classList.remove('active');
    currentEditingCountryCode = null;
};

window.saveCountryPrice = async () => {
    if (!currentEditingCountryCode) return;
    const priceStr = document.getElementById('country-price-input').value;
    const price = parseFloat(priceStr);

    if (isNaN(price) || price < 0) {
        alert('Please enter a valid price.');
        return;
    }

    try {
        const res = await fetch('/api/admin/countries/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ code: currentEditingCountryCode, price })
        });
        if (res.ok) {
            closeCountryModal();
            webapp.HapticFeedback.notificationOccurred('success');
            await refreshData();
        } else {
            alert('Failed to update country price.');
        }
    } catch (err) { console.error(err); }
};

window.toggleCountryVisibility = async () => {
    if (!currentEditingCountryCode) return;
    try {
        const newStatus = !currentEditingCountryEnabled;
        const res = await fetch('/api/admin/countries/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ code: currentEditingCountryCode, isEnabled: newStatus })
        });
        if (res.ok) {
            closeCountryModal();
            webapp.HapticFeedback.notificationOccurred('success');
            await refreshData();
        }
    } catch (err) { console.error(err); }
};

// HANDLERS
window.performToggleBanFromModal = async () => {
    if (!currentEditingUserId) return;
    try {
        const res = await fetch('/api/admin/user-toggle-ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ userId: currentEditingUserId })
        });
        if (res.ok) {
            closeModal();
            await refreshData();
        }
    } catch (err) { console.error(err); }
};

window.bulkToggleCountries = async (isEnabled) => {
    const action = isEnabled ? 'ENABLE' : 'DISABLE';
    if (!confirm(`Are you sure you want to ${action} ALL countries?`)) return;

    try {
        const res = await fetch('/api/admin/countries/bulk-toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ isEnabled })
        });
        if (res.ok) {
            webapp.HapticFeedback.notificationOccurred('success');
            await refreshData();
        } else {
            alert('Bulk update failed');
        }
    } catch (err) { console.error(err); }
};



window.setUserFilter = (filter) => {
    currentUserFilter = filter;
    document.getElementById('tab-active').classList.toggle('active', filter === 'active');
    document.getElementById('tab-banned').classList.toggle('active', filter === 'banned');
    applyUserFilters();
};

window.setCountryFilter = (filter) => {
    currentCountryFilter = filter;
    document.getElementById('tab-country-active').classList.toggle('active', filter === 'active');
    document.getElementById('tab-country-inactive').classList.toggle('active', filter === 'inactive');
    currentCountryPage = 1;
    renderCountries();
};

window.setOrderFilter = (filter) => {
    currentOrderFilter = filter;
    const tabCompleted = document.getElementById('tab-order-completed');
    const tabCancelled = document.getElementById('tab-order-cancelled');
    if (tabCompleted) tabCompleted.classList.toggle('active', filter === 'completed');
    if (tabCancelled) tabCancelled.classList.toggle('active', filter === 'cancelled');
    applyOrderFilters();
};

// MODALS
window.openUserModal = (id, name, username, balance, isBanned) => {
    currentEditingUserId = id;

    // Set Info Headers
    document.getElementById('modal-user-name').textContent = name;
    document.getElementById('modal-user-handle').textContent = `@${username}`;
    document.getElementById('modal-user-balance').textContent = `$${parseFloat(balance).toFixed(2)}`;

    document.getElementById('balance-amount').value = '';

    // Setup Ban/Unban Button
    const banBtn = document.getElementById('modal-ban-btn');
    if (isBanned) {
        banBtn.textContent = 'Unban';
        banBtn.className = 'gradient-btn btn-unban';
    } else {
        banBtn.textContent = 'Ban';
        banBtn.className = 'gradient-btn btn-ban';
    }

    document.getElementById('user-modal').classList.add('active');
};

window.closeModal = () => {
    document.getElementById('user-modal').classList.remove('active');
};

window.performBalanceUpdate = async (operation) => {
    let amount = parseFloat(document.getElementById('balance-amount').value);
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid positive amount.');
        return;
    }

    // Adjust based on operation
    if (operation === 'subtract') {
        amount = -amount;
    }

    try {
        const res = await fetch('/api/admin/balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ userId: currentEditingUserId, amount })
        });
        if (res.ok) { closeModal(); await refreshData(); }
    } catch (err) { console.error(err); }
};

// HELPERS
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// --- MANDATORY CHANNELS LOGIC ---

window.renderMandatoryChannels = () => {
    const list = document.getElementById('mandatory-channels-list');
    const paginationContainer = document.getElementById('channel-pagination');
    if (!list) return;

    if (allChannels.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-rss"></i><span>No channels added yet</span></div>`;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const start = (currentChannelPage - 1) * channelsPerPage;
    const paginated = allChannels.slice(start, start + channelsPerPage);
    const totalPages = Math.ceil(allChannels.length / channelsPerPage);

    list.innerHTML = paginated.map((channel, idx) => `
        <div class="channel-card-v3">
            <div class="channel-card-v3-badge">${start + idx + 1}</div>

            <div class="channel-card-v3-row">
                <span class="label">USERNAME</span>
                <span class="value color-yellow">${channel.username}</span>
            </div>

            <div class="channel-card-v3-row">
                <span class="label">LINK</span>
                <a href="${channel.link}" target="_blank" class="value link">${channel.link}</a>
            </div>

            <button class="channel-card-v3-delete" onclick="deleteMandatoryChannel(${channel.id})">
                <i class="fas fa-trash-alt"></i> Delete Channel
            </button>
        </div>
    `).join('');

    renderPagination(
        totalPages,
        currentChannelPage,
        (newPage) => {
            currentChannelPage = newPage;
            const target = document.getElementById('managed-channels-section');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            renderMandatoryChannels();
        },
        paginationContainer,
        'channelPaginationCallback'
    );
};


window.addMandatoryChannel = async () => {
    const usernameInput = document.getElementById('input-channel-username');
    const linkInput = document.getElementById('input-channel-link');

    const username = usernameInput.value.trim();
    const link = linkInput.value.trim();

    if (!username || !link) {
        webapp.showAlert('Please enter both username and link ❌');
        return;
    }

    try {
        const res = await fetch('/api/admin/channels/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ username, link })
        });

        if (res.ok) {
            usernameInput.value = '';
            linkInput.value = '';

            await refreshData();
            showOzAlert('Channel Added!', 'The new channel has been added to your subscription list successfully. ✨');
        } else {
            const errorData = await res.json();
            if (res.status === 400 && errorData.msg === 'Channel already exists') {
                showOzToast('error', 'Duplicate Channel', 'This channel is already in your managed list.');
            } else {
                showOzToast('error', 'Operation Failed', 'Could not add the channel.');
            }
        }
    } catch (err) {
        console.error(err);
        showOzToast('error', 'System Error', 'A connection error occurred.');
    }
};

window.deleteMandatoryChannel = async (id) => {
    const isConfirmed = await showOzConfirm(
        'Delete Channel?',
        'This action is permanent and cannot be undone.',
        '🗑️'
    );

    if (!isConfirmed) return;

    try {
        const res = await fetch('/api/admin/channels/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ id })
        });

        if (res.ok) {
            await refreshData();
            showOzAlert('Deleted Successfully', 'The channel has been removed from the mandatory subscription list.');
        } else {
            showOzToast('error', 'Error', 'Failed to delete channel.');
        }
    } catch (err) {
        console.error(err);
    }
};

// --- OZ UI UTILITIES ---

window.showOzToast = (type, title, msg) => {
    // Keeping toast as a secondary lighter feedback if needed for other things
    const container = document.getElementById('oz-notifications');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `oz-toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <div class="oz-toast-content">
            <div class="oz-toast-title">${title}</div>
            <div class="oz-toast-msg">${msg}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        toast.style.transition = '0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
};

window.showOzAlert = (title, msg, type = 'success') => {
    return new Promise((resolve) => {
        const root = document.getElementById('oz-modal-root');
        if (!root) return resolve();

        const icon = type === 'success' ? 'fa-check' : 'fa-info';

        root.innerHTML = `
            <div class="oz-modal">
                <div class="oz-modal-icon-wrapper">
                    <div class="oz-modal-icon-inner">
                        <i class="fas ${icon}"></i>
                    </div>
                </div>
                <div class="oz-modal-title">${title}</div>
                <div class="oz-modal-msg">${msg}</div>
                <div class="oz-modal-actions">
                    <button class="oz-modal-btn dismiss">Dismiss</button>
                </div>
            </div>
        `;

        root.classList.remove('hide');

        const dismissBtn = root.querySelector('.dismiss');
        dismissBtn.onclick = () => {
            root.classList.add('hide');
            resolve();
        };
    });
};

window.showOzConfirm = (title, msg, iconEmoji = '🗑️') => {
    return new Promise((resolve) => {
        const root = document.getElementById('oz-modal-root');
        if (!root) return resolve(false);

        root.innerHTML = `
            <div class="oz-modal">
                <div class="oz-modal-icon-wrapper" style="border-color: rgba(244, 63, 94, 0.1); background: radial-gradient(circle, rgba(244, 63, 94, 0.1) 0%, transparent 70%);">
                    <div class="oz-modal-icon-inner" style="border-color: var(--danger); color: var(--danger); background: rgba(244, 63, 94, 0.1);">
                        <i class="fas fa-trash-alt"></i>
                    </div>
                </div>
                <div class="oz-modal-title">${title}</div>
                <div class="oz-modal-msg">${msg}</div>
                <div class="oz-modal-actions">
                    <button class="oz-modal-btn confirm-danger">Confirm</button>
                    <button class="oz-modal-btn cancel">Cancel</button>
                </div>
            </div>
        `;

        root.classList.remove('hide');

        const confirmBtn = root.querySelector('.confirm-danger');
        const cancelBtn = root.querySelector('.cancel');

        confirmBtn.onclick = () => {
            root.classList.add('hide');
            resolve(true);
        };

        cancelBtn.onclick = () => {
            root.classList.add('hide');
            resolve(false);
        };
    });
};

// START
document.addEventListener('DOMContentLoaded', () => {
    init();
});

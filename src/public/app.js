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

// Pagination State
let currentUserPage = 1;
const usersPerPage = 5;

let currentCountryPage = 1;
const countriesPerPage = 5;

let currentOrderPage = 1;
const ordersPerPage = 5;

let currentEditingCountryCode = null;
let currentEditingCountryEnabled = false;

// INIT
async function init() {
    try {
        await refreshData();

        // Search Handlers
        const userSearch = document.getElementById('user-search-v2');
        if (userSearch) userSearch.addEventListener('input', (e) => { userSearchQuery = e.target.value; });

        const orderSearch = document.getElementById('order-search-v2');
        if (orderSearch) orderSearch.addEventListener('input', (e) => { orderSearchQuery = e.target.value; applyOrderFilters(); });

        const depositSearch = document.getElementById('deposit-search-v2');
        if (depositSearch) depositSearch.addEventListener('input', (e) => { depositSearchQuery = e.target.value; applyDepositFilters(); });

        const countrySearch = document.getElementById('country-search-v2');
        if (countrySearch) {
            // Only update query, don't trigger render automatically
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
        document.getElementById('loader').innerHTML = '<div class="loader-content"><span>⚠️ Failed to load dashboard</span></div>';
    }
}

// DATA FETCHING
function getHeaders() {
    return { 'x-telegram-init-data': webapp.initData };
}

async function refreshData() {
    try {
        const [statsRes, usersRes, ordersRes, depositsRes, countriesRes] = await Promise.all([
            fetch('/api/admin/stats', { headers: getHeaders() }),
            fetch('/api/admin/users', { headers: getHeaders() }),
            fetch('/api/admin/orders', { headers: getHeaders() }),
            fetch('/api/admin/deposits', { headers: getHeaders() }),
            fetch('/api/admin/countries', { headers: getHeaders() })
        ]);

        if (!statsRes.ok || !usersRes.ok || !ordersRes.ok || !depositsRes.ok || !countriesRes.ok) {
            throw new Error('One or more API requests failed');
        }

        const stats = await statsRes.json();
        allUsers = await usersRes.json();
        allOrders = await ordersRes.json();
        allDeposits = await depositsRes.json();
        allCountries = await countriesRes.json();

        // Update Overview stats
        const sTotalUsers = document.getElementById('stat-total-users');
        const sTotalOrders = document.getElementById('stat-total-orders');
        const sTotalSales = document.getElementById('stat-total-sales');
        const sPendingDep = document.getElementById('stat-pending-deposits');
        const sRevenue = document.getElementById('stat-total-revenue');

        if (sTotalUsers) sTotalUsers.textContent = stats.totalUsers || 0;
        if (sTotalOrders) sTotalOrders.textContent = stats.totalOrdersCount || 0;
        if (sTotalSales) sTotalSales.textContent = stats.successfulOrders || 0;
        if (sPendingDep) sPendingDep.textContent = stats.pendingDeposits || 0;
        if (sRevenue) sRevenue.textContent = `$${(stats.totalRevenue || 0).toFixed(2)}`;

        // Update User page stats
        const uStatTotal = document.getElementById('user-stat-total');
        const uStatBanned = document.getElementById('user-stat-banned');
        const uStatActive = document.getElementById('user-stat-active');
        if (uStatTotal) uStatTotal.textContent = stats.totalUsers || 0;
        if (uStatBanned) uStatBanned.textContent = stats.bannedUsers || 0;
        if (uStatActive) uStatActive.textContent = (stats.totalUsers || 0) - (stats.bannedUsers || 0);

        // Update Order page stats
        const oStatTotal = document.getElementById('order-stat-total');
        const oStatApproved = document.getElementById('order-stat-approved');
        const oStatRejected = document.getElementById('order-stat-rejected');
        if (oStatTotal) oStatTotal.textContent = stats.totalOrdersCount || 0;
        if (oStatApproved) oStatApproved.textContent = stats.successfulOrders || 0;
        if (oStatRejected) oStatRejected.textContent = stats.cancelledOrdersCount || 0;

        // Update Deposit page stats
        const dStatCount = document.getElementById('deposit-stat-count');
        const dStatAmount = document.getElementById('deposit-stat-amount');
        if (dStatCount) dStatCount.textContent = stats.totalDepositsCount || 0;
        if (dStatAmount) dStatAmount.textContent = `$${(stats.totalDepositsAmount || 0).toFixed(2)}`;

        // Update Countries stats
        const cStatTotal = document.getElementById('country-stat-total');
        const cStatActive = document.getElementById('country-stat-active');
        const cStatInactive = document.getElementById('country-stat-inactive');
        if (cStatTotal) cStatTotal.textContent = allCountries.length;
        if (cStatActive) cStatActive.textContent = allCountries.filter(c => c.isEnabled).length;
        if (cStatInactive) cStatInactive.textContent = allCountries.filter(c => !c.isEnabled).length;

        // Render lists
        try { applyUserFilters(); } catch (e) { console.error('Users render error:', e); }
        try { applyOrderFilters(); } catch (e) { console.error('Orders render error:', e); }
        try { applyDepositFilters(); } catch (e) { console.error('Deposits render error:', e); }
        try { renderCountries(); } catch (e) { console.error('Countries render error:', e); }
    } catch (err) {
        console.error('Data refresh error:', err);
        throw err;
    }
}

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

    const titles = { dashboard: 'Overview', users: 'User Management', orders: 'Orders', deposits: 'Deposits', countries: 'Countries', settings: 'Settings' };
    document.getElementById('page-title').textContent = titles[pageName] || 'Overview';
    document.getElementById('sidebar').classList.remove('open');
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
    } else if (type === 'deposit') {
        depositSearchQuery = document.getElementById('deposit-search-v2').value;
        const resetBtn = document.getElementById('reset-deposit-search-container');
        if (resetBtn) resetBtn.style.display = depositSearchQuery.trim() ? 'block' : 'none';
        applyDepositFilters();
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
    } else if (type === 'deposit') {
        const input = document.getElementById('deposit-search-v2');
        if (input) input.value = '';
        depositSearchQuery = '';
        const resetBtn = document.getElementById('reset-deposit-search-container');
        if (resetBtn) resetBtn.style.display = 'none';
        applyDepositFilters();
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

function applyOrderFilters() {
    currentOrderPage = 1;
    const filtered = getFilteredOrders();
    renderOrdersList(filtered);
}

// Helper to get filtered orders without resetting page
function getFilteredOrders() {
    let filtered = allOrders;
    if (currentOrderFilter === 'completed') {
        filtered = filtered.filter(o => o.status === 'COMPLETED');
    } else if (currentOrderFilter === 'cancelled') {
        filtered = filtered.filter(o => o.status === 'CANCELLED');
    }
    if (orderSearchQuery) {
        const q = orderSearchQuery.toLowerCase();
        filtered = filtered.filter(o => 
            (o.phoneNumber && o.phoneNumber.includes(q)) || 
            (o.user?.telegramId && String(o.user.telegramId).includes(q)) || 
            (o.user?.firstName && o.user.firstName.toLowerCase().includes(q))
        );
    }
    return filtered;
}

function applyDepositFilters() {
    let filtered = allDeposits;
    if (depositSearchQuery) {
        const q = depositSearchQuery.toLowerCase();
        filtered = filtered.filter(d => (d.user?.telegramId && d.user.telegramId.includes(q)) || (d.user?.firstName && d.user.firstName.toLowerCase().includes(q)) || (d.method && d.method.toLowerCase().includes(q)));
    }
    renderDepositsList(filtered);
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

function renderOrdersList(orders) {
    const list = document.getElementById('orders-list');
    const paginationContainer = document.getElementById('order-pagination');
    if (!list) return;

    if (!orders.length) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><span>No orders found</span></div>`;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(orders.length / ordersPerPage);
    if (currentOrderPage > totalPages) currentOrderPage = totalPages || 1;

    const start = (currentOrderPage - 1) * ordersPerPage;
    const paginated = orders.slice(start, start + ordersPerPage);

    list.innerHTML = paginated.map((o, index) => {
        const globalIndex = start + index + 1;
        const countryInfo = allCountries.find(c => c.code === o.countryId);
        const countryDisplay = countryInfo ? `${countryInfo.flag} ${countryInfo.name}` : (o.countryId || '-');

        return `
        <div class="user-container">
            <div class="user-card-index">${globalIndex}</div>
            <div class="user-row">
                <span class="user-row-label">Status</span>
                <span class="user-row-value ${o.status === 'COMPLETED' ? 'color-green' : o.status === 'CANCELLED' ? 'color-red' : 'color-orange'}">${o.status}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">User ID</span>
                <span class="user-row-value color-yellow">${o.user?.telegramId || o.userId}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Phone</span>
                <span class="user-row-value color-blue-tint">${o.phoneNumber || '-'}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Country</span>
                <span class="user-row-value color-cyan">${countryDisplay}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Price</span>
                <span class="user-row-value color-green">$${o.price.toFixed(2)}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Date</span>
                <span class="user-row-value color-purple" style="font-size:0.8rem">${formatDate(o.createdAt)}</span>
            </div>
        </div>
        `;
    }).join('');

    renderPagination(
        totalPages,
        currentOrderPage,
        (newPage) => {
            currentOrderPage = newPage;
            const target = document.getElementById('page-orders');
            if (target) target.scrollTo({ top: 0, behavior: 'smooth' });
            const filteredOrders = getFilteredOrders();
            renderOrdersList(filteredOrders);
        },
        paginationContainer,
        'orderPaginationCallback'
    );
}

function renderDepositsList(deposits) {
    const list = document.getElementById('deposits-list');
    if (!list) return;
    if (!deposits.length) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-wallet"></i><span>No deposits found</span></div>`;
        return;
    }
    list.innerHTML = deposits.map((d, index) => `
        <div class="user-container">
            <div class="user-card-index">${index + 1}</div>
            <div class="user-row">
                <span class="user-row-label">Status</span>
                <span class="user-row-value ${d.status === 'APPROVED' ? 'color-green' : d.status === 'REJECTED' ? 'color-red' : 'color-orange'}">${d.status}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">User</span>
                <span class="user-row-value color-yellow">${escapeHtml(d.user?.firstName || 'User #' + d.userId)}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Amount</span>
                <span class="user-row-value color-green">$${d.amount.toFixed(2)}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Method</span>
                <span class="user-row-value color-blue-tint">${d.method || '-'}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Date</span>
                <span class="user-row-value" style="font-size:0.8rem">${formatDate(d.createdAt)}</span>
            </div>
            ${d.status === 'PENDING' ? `
                <div class="data-card-actions" style="margin-top:15px; border-top:none; display:flex; gap:10px;">
                    <button class="gradient-btn" style="background:#10b981; padding:8px" onclick="handleDeposit(${d.id}, 'APPROVED')">Approve</button>
                    <button class="gradient-btn" style="background:transparent; border:1px solid #ef4444; color:#ef4444; padding:8px" onclick="handleDeposit(${d.id}, 'REJECTED')">Reject</button>
                </div>
            ` : ''}
        </div>
    `).join('');
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

window.handleDeposit = async (depositId, action) => {
    try {
        const res = await fetch('/api/admin/deposit-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ depositId, action })
        });
        if (res.ok) await refreshData(); else alert('Failed');
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

// START
document.addEventListener('DOMContentLoaded', () => {
    init();
});

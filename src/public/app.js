const webapp = window.Telegram.WebApp;
webapp.expand();
webapp.ready();

// STATE
let allUsers = [];
let allOrders = [];
let allDeposits = [];
let currentEditingUserId = null;
let currentOrderFilter = 'ALL';
let currentDepositFilter = 'ALL';
let currentUserFilter = 'active'; // 'active' or 'banned'
let userSearchQuery = '';
let orderSearchQuery = '';
let depositSearchQuery = '';

// Pagination State
let currentUserPage = 1;
const usersPerPage = 5;

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
        const [statsRes, usersRes, ordersRes, depositsRes] = await Promise.all([
            fetch('/api/admin/stats', { headers: getHeaders() }),
            fetch('/api/admin/users', { headers: getHeaders() }),
            fetch('/api/admin/orders', { headers: getHeaders() }),
            fetch('/api/admin/deposits', { headers: getHeaders() })
        ]);

        if (!statsRes.ok || !usersRes.ok || !ordersRes.ok || !depositsRes.ok) {
            throw new Error('One or more API requests failed');
        }

        const stats = await statsRes.json();
        allUsers = await usersRes.json();
        allOrders = await ordersRes.json();
        allDeposits = await depositsRes.json();

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

        // Render lists
        try { applyUserFilters(); } catch(e) { console.error('Users render error:', e); }
        try { applyOrderFilters(); } catch(e) { console.error('Orders render error:', e); }
        try { applyDepositFilters(); } catch(e) { console.error('Deposits render error:', e); }
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

    const titles = { dashboard: 'Overview', users: 'User Management', orders: 'Orders', deposits: 'Deposits', settings: 'Settings' };
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
    } else if (type === 'order') {
        orderSearchQuery = document.getElementById('order-search-v2').value;
        applyOrderFilters();
    } else if (type === 'deposit') {
        depositSearchQuery = document.getElementById('deposit-search-v2').value;
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
    let filtered = allOrders;
    if (orderSearchQuery) {
        const q = orderSearchQuery.toLowerCase();
        filtered = filtered.filter(o => (o.phoneNumber && o.phoneNumber.includes(q)) || (o.user?.telegramId && o.user.telegramId.includes(q)) || (o.user?.firstName && o.user.firstName.toLowerCase().includes(q)));
    }
    renderOrdersList(filtered);
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

    const totalPages = Math.ceil(users.length / usersPerPage);
    if (currentUserPage > totalPages) currentUserPage = totalPages || 1;

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

    renderUserPagination(users.length);
}

function renderUserPagination(totalCount) {
    const container = document.getElementById('user-pagination');
    if (!container) return; // Safety check
    
    const totalPages = Math.ceil(totalCount / usersPerPage);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <button class="pagination-btn" ${currentUserPage === 1 ? 'disabled' : ''} onclick="changeUserPage(-1)">
            <i class="fas fa-chevron-left"></i>
        </button>
        <div class="pagination-text">Page ${currentUserPage} of ${totalPages}</div>
        <button class="pagination-btn" ${currentUserPage === totalPages ? 'disabled' : ''} onclick="changeUserPage(1)">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
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
    if (!list) return;
    if (!orders.length) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><span>No orders found</span></div>`;
        return;
    }
    list.innerHTML = orders.map((o, index) => `
        <div class="user-container">
            <div class="user-card-index">${index + 1}</div>
            <div class="user-row">
                <span class="user-row-label">Status</span>
                <span class="user-row-value ${o.status === 'COMPLETED' ? 'color-green' : o.status === 'CANCELLED' ? 'color-red' : 'color-orange'}">${o.status}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">User</span>
                <span class="user-row-value color-yellow">${escapeHtml(o.user?.firstName || 'User #' + o.userId)}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Phone</span>
                <span class="user-row-value color-blue-tint">${o.phoneNumber || '-'}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Country</span>
                <span class="user-row-value">${o.countryId || '-'}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Price</span>
                <span class="user-row-value color-green">$${o.price.toFixed(2)}</span>
            </div>
            <div class="user-row">
                <span class="user-row-label">Date</span>
                <span class="user-row-value" style="font-size:0.8rem">${formatDate(o.createdAt)}</span>
            </div>
        </div>
    `).join('');
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

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

// INIT
async function init() {
    try {
        await refreshData();

        // Use the new search input V2 if it exists
        const searchInput = document.getElementById('user-search-v2');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                userSearchQuery = e.target.value;
                applyUserFilters();
            });
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

        // Update Global stats
        document.getElementById('stat-total-users').textContent = stats.totalUsers || 0;
        document.getElementById('stat-total-orders').textContent = allOrders.length || 0;
        document.getElementById('stat-total-sales').textContent = stats.successfulOrders || 0;
        document.getElementById('stat-pending-deposits').textContent = stats.pendingDeposits || 0;
        document.getElementById('stat-total-revenue').textContent = `$${(stats.totalRevenue || 0).toFixed(2)}`;

        // Update User page specific stats
        const uStatTotal = document.getElementById('user-stat-total');
        const uStatBanned = document.getElementById('user-stat-banned');
        if (uStatTotal) uStatTotal.textContent = stats.totalUsers || 0;
        if (uStatBanned) uStatBanned.textContent = stats.bannedUsers || 0;

        // Render lists
        applyUserFilters();
        renderOrdersList(allOrders);
        renderDepositsList(allDeposits);
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
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });

    const titles = { dashboard: 'Overview', users: 'User Management', orders: 'Orders', deposits: 'Finance', settings: 'Settings' };
    document.getElementById('page-title').textContent = titles[pageName] || 'Overview';
    document.getElementById('sidebar').classList.remove('open');
};

// USER MANAGEMENT LOGIC
window.setUserFilter = (filter) => {
    currentUserFilter = filter;
    document.getElementById('tab-active').classList.toggle('active', filter === 'active');
    document.getElementById('tab-banned').classList.toggle('active', filter === 'banned');
    applyUserFilters();
};

window.triggerSearch = () => {
    userSearchQuery = document.getElementById('user-search-v2').value;
    applyUserFilters();
};

function applyUserFilters() {
    let filtered = allUsers.filter(u => {
        const isBanned = u.isBanned || false;
        if (currentUserFilter === 'active') return !isBanned;
        if (currentUserFilter === 'banned') return isBanned;
        return true;
    });

    if (userSearchQuery) {
        const q = userSearchQuery.toLowerCase();
        filtered = filtered.filter(u => 
            u.telegramId.includes(q) || 
            (u.username && u.username.toLowerCase().includes(q)) ||
            (u.firstName && u.firstName.toLowerCase().includes(q))
        );
    }

    renderUsersList(filtered);
}

function renderUsersList(users) {
    const list = document.getElementById('users-list');
    if (!list) return;
    if (!users.length) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users-slash"></i>
                <span>No users found</span>
            </div>
        `;
        return;
    }

    list.innerHTML = users.map((u, index) => `
        <div class="user-container">
            <div class="user-card-index">${index + 1}</div>
            
            <div class="user-row" onclick="toggleUserBan(${u.id})">
                <span class="user-row-label">Account Status</span>
                <span class="user-row-value ${u.isBanned ? 'color-red' : 'color-green'}">
                    ${u.isBanned ? 'BANNED' : '<i class="fas fa-check"></i> ACTIVE'}
                </span>
            </div>

            <div class="user-row" onclick="openBalanceModal(${u.id}, '${escapeHtml(u.firstName || u.username || u.telegramId)}')">
                <span class="user-row-label">Full Name</span>
                <span class="user-row-value color-yellow">${escapeHtml(u.firstName || 'Unknown')} ${u.isAdmin ? '(Admin)' : ''}</span>
            </div>

            <div class="user-row">
                <span class="user-row-label">Username</span>
                <span class="user-row-value color-blue-tint">@${escapeHtml(u.username || 'none')}</span>
            </div>

            <div class="user-row">
                <span class="user-row-label">User ID</span>
                <span class="user-row-value color-orange">${u.telegramId}</span>
            </div>

            <div class="user-row" onclick="openBalanceModal(${u.id}, '${escapeHtml(u.firstName || u.username || u.telegramId)}')">
                <span class="user-row-label">Balance</span>
                <span class="user-row-value color-blue-tint">$${u.balance.toFixed(2)}</span>
            </div>

            <div class="user-row">
                <span class="user-row-label">Spent</span>
                <span class="user-row-value color-red">$${(u.spent || 0).toFixed(2)}</span>
            </div>

            <div class="user-row">
                <span class="user-row-label">Earned</span>
                <span class="user-row-value color-green">$${(u.referralBalance || 0).toFixed(2)}</span>
            </div>

            <div class="user-row">
                <span class="user-row-label">Orders Made</span>
                <span class="user-row-value color-purple">${u.ordersMade || 0}</span>
            </div>

            <div class="data-card-actions" style="margin-top:15px; border-top:none; padding-top:0">
                 <button class="gradient-btn" style="padding:10px; font-size:0.8rem;" onclick="openBalanceModal(${u.id}, '${escapeHtml(u.firstName || u.username || u.telegramId)}')">
                    <i class="fas fa-wallet"></i> Edit Balance
                 </button>
            </div>
        </div>
    `).join('');
}

window.toggleUserBan = async (userId) => {
    if (!confirm('Are you sure you want to toggle ban status for this user?')) return;
    try {
        const res = await fetch('/api/admin/user-toggle-ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ userId })
        });
        if (res.ok) {
            await refreshData();
        }
    } catch (err) {
        console.error('Ban toggle error:', err);
    }
};

// RENDERERS FOR OTHER PAGES
function renderOrdersList(orders) {
    const list = document.getElementById('orders-list');
    if (!list) return;
    const filtered = currentOrderFilter === 'ALL' ? orders : orders.filter(o => o.status === currentOrderFilter);
    if (!filtered.length) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <span>No orders found</span>
            </div>
        `;
        return;
    }
    list.innerHTML = filtered.map(o => `
        <div class="data-card">
            <div class="data-card-header">
                <span class="data-card-name">${escapeHtml(o.user?.firstName || o.user?.username || 'User #' + o.userId)}</span>
                ${statusBadge(o.status)}
            </div>
            <div class="data-card-body">
                <div class="data-card-details">
                    <span class="data-card-detail">Phone: <strong>${o.phoneNumber || '-'}</strong></span>
                    <span class="data-card-detail">Country: <strong>${o.countryId || '-'}</strong></span>
                    <span class="data-card-detail">Price: <strong class="color-green">$${o.price.toFixed(2)}</strong></span>
                </div>
                <div class="data-card-detail" style="color:var(--text-muted); font-size: 0.7rem;">${formatDate(o.createdAt)}</div>
            </div>
        </div>
    `).join('');
}

window.filterOrders = (status) => {
    currentOrderFilter = status;
    document.querySelectorAll('#page-orders .filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.filter === status);
    });
    renderOrdersList(allOrders);
};

function renderDepositsList(deposits) {
    const list = document.getElementById('deposits-list');
    if (!list) return;
    const filtered = currentDepositFilter === 'ALL' ? deposits : deposits.filter(d => d.status === currentDepositFilter);
    if (!filtered.length) {
        list.innerHTML = '<div class="empty-state"><span>💳</span>No deposits found</div>';
        return;
    }
    list.innerHTML = filtered.map(d => `
        <div class="data-card">
            <div class="data-card-header">
                <span class="data-card-name">${escapeHtml(d.user?.firstName || d.user?.username || 'User #' + d.userId)}</span>
                ${statusBadge(d.status)}
            </div>
            <div class="data-card-body">
                <div class="data-card-details">
                    <span class="data-card-detail">Amount: <strong class="color-green">$${d.amount.toFixed(2)}</strong></span>
                    <span class="data-card-detail">Method: <strong>${d.method || '-'}</strong></span>
                    <span class="data-card-detail">Date: <strong>${formatDate(d.createdAt)}</strong></span>
                </div>
                ${d.status === 'PENDING' ? `
                    <div class="data-card-actions">
                        <button class="btn-edit" style="padding:6px 12px; font-size:0.75rem; background:var(--success)" onclick="handleDeposit(${d.id}, 'APPROVED')">Approve</button>
                        <button class="btn-cancel" style="padding:6px 12px; font-size:0.75rem; border:1px solid var(--danger); color:var(--danger)" onclick="handleDeposit(${d.id}, 'REJECTED')">Reject</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

window.filterDeposits = (status) => {
    currentDepositFilter = status;
    document.querySelectorAll('#page-deposits .filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.filter === status);
    });
    renderDepositsList(allDeposits);
};

window.handleDeposit = async (depositId, action) => {
    try {
        const res = await fetch('/api/admin/deposit-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ depositId, action })
        });
        if (res.ok) {
            await refreshData();
        } else {
            const err = await res.json();
            alert('Error: ' + (err.msg || 'Failed'));
        }
    } catch (err) {
        console.error('Deposit action error:', err);
    }
};

// MODALS
window.openBalanceModal = (id, name) => {
    currentEditingUserId = id;
    document.getElementById('target-user-display').textContent = `User: ${name}`;
    document.getElementById('balance-amount').value = '';
    document.getElementById('balance-modal').classList.add('active');
    document.getElementById('balance-amount').focus();
};

window.closeModal = () => {
    document.getElementById('balance-modal').classList.remove('active');
};

window.performBalanceUpdate = async () => {
    const amount = parseFloat(document.getElementById('balance-amount').value);
    if (isNaN(amount)) {
        alert('Please enter a valid number');
        return;
    }
    const btn = document.getElementById('confirm-balance-btn');
    try {
        btn.disabled = true;
        btn.textContent = 'Updating...';
        const res = await fetch('/api/admin/balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ userId: currentEditingUserId, amount })
        });
        if (res.ok) {
            closeModal();
            await refreshData();
        } else {
            const err = await res.json();
            alert('Error: ' + (err.msg || 'Update failed'));
        }
    } catch (err) {
        console.error('Update error:', err);
        alert('Network error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Update';
    }
};

// HELPERS
function statusBadge(status) {
    const map = {
        'COMPLETED': 'badge-completed',
        'APPROVED': 'badge-approved',
        'PENDING': 'badge-pending',
        'CANCELLED': 'badge-cancelled',
        'REJECTED': 'badge-rejected'
    };
    return `<span class="badge ${map[status] || 'badge-pending'}">${status}</span>`;
}

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
init();

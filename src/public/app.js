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

// INIT
async function init() {
    try {
        await refreshData();

        document.getElementById('user-search').addEventListener('input', (e) => {
            filterUsers(e.target.value);
        });

        // Set admin name/avatar
        if (webapp.initDataUnsafe && webapp.initDataUnsafe.user) {
            const user = webapp.initDataUnsafe.user;
            const name = user.first_name || 'Admin';
            document.getElementById('admin-avatar').textContent = name.substring(0, 2).toUpperCase();
        }

        // Restore previous page if exists (sessionStorage survives refresh but resets on fresh start)
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

        // Update stats
        document.getElementById('stat-total-users').textContent = stats.totalUsers || 0;
        document.getElementById('stat-total-orders').textContent = allOrders.length || 0;
        document.getElementById('stat-total-sales').textContent = stats.successfulOrders || 0;
        document.getElementById('stat-pending-deposits').textContent = stats.pendingDeposits || 0;
        document.getElementById('stat-total-revenue').textContent = `$${(stats.totalRevenue || 0).toFixed(2)}`;

        // Render lists
        renderUsersList(allUsers);
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

    const titles = { dashboard: 'Overview', users: 'Users', orders: 'Orders', deposits: 'Finance', settings: 'Settings' };
    document.getElementById('page-title').textContent = titles[pageName] || 'Overview';
    document.getElementById('sidebar').classList.remove('open');
};

// RENDERERS
function renderUsersList(users) {
    const list = document.getElementById('users-list');
    if (!list) return;
    if (!users.length) {
        list.innerHTML = '<div class="empty-state"><span>👥</span>No users yet</div>';
        return;
    }
    list.innerHTML = users.map(u => `
        <div class="data-card">
            <div class="data-card-header">
                <span class="data-card-name">${escapeHtml(u.firstName || u.username || 'Unknown')}</span>
                <span class="data-card-id">${u.telegramId}</span>
            </div>
            <div class="data-card-body">
                <div class="data-card-details">
                    <span class="data-card-detail">Balance: <strong class="color-green">$${u.balance.toFixed(2)}</strong></span>
                    <span class="data-card-detail">Joined: <strong>${formatDate(u.createdAt)}</strong></span>
                </div>
                <div class="data-card-actions">
                    <button class="btn-edit" onclick="openBalanceModal(${u.id}, '${escapeHtml(u.firstName || u.username || u.telegramId)}')">Edit Balance</button>
                </div>
            </div>
        </div>
    `).join('');
}

function filterUsers(query) {
    const q = query.toLowerCase();
    const filtered = allUsers.filter(u =>
        u.telegramId.includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.firstName && u.firstName.toLowerCase().includes(q))
    );
    renderUsersList(filtered);
}

function renderOrdersList(orders) {
    const list = document.getElementById('orders-list');
    if (!list) return;
    const filtered = currentOrderFilter === 'ALL' ? orders : orders.filter(o => o.status === currentOrderFilter);
    if (!filtered.length) {
        list.innerHTML = '<div class="empty-state"><span>🛒</span>No orders found</div>';
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

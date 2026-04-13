const webapp = window.Telegram.WebApp;
webapp.expand();
webapp.ready();

// ═══════════ STATE ═══════════
let allUsers = [];
let allOrders = [];
let allDeposits = [];
let currentEditingUserId = null;
let currentOrderFilter = 'ALL';
let currentDepositFilter = 'ALL';

// ═══════════ INIT ═══════════
async function init() {
    try {
        await refreshData();

        document.getElementById('user-search').addEventListener('input', (e) => {
            filterUsers(e.target.value);
        });

        // Set admin name
        if (webapp.initDataUnsafe && webapp.initDataUnsafe.user) {
            const name = webapp.initDataUnsafe.user.first_name;
            document.getElementById('sidebar-admin-name').textContent = name;
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

// ═══════════ DATA FETCHING ═══════════
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

        const stats = await statsRes.json();
        allUsers = await usersRes.json();
        allOrders = await ordersRes.json();
        allDeposits = await depositsRes.json();

        // Update stats
        document.getElementById('stat-total-users').textContent = stats.totalUsers || 0;
        document.getElementById('stat-total-sales').textContent = stats.successfulOrders || 0;
        document.getElementById('stat-total-revenue').textContent = `$${(stats.totalRevenue || 0).toFixed(2)}`;
        document.getElementById('stat-pending-deposits').textContent = stats.pendingDeposits || 0;

        // Render tables
        renderRecentUsers(allUsers.slice(0, 5));
        renderRecentOrders(allOrders.slice(0, 5));
        renderUsersTable(allUsers);
        renderOrdersTable(allOrders);
        renderDepositsTable(allDeposits);
    } catch (err) {
        console.error('Data refresh error:', err);
    }
}

// ═══════════ SIDEBAR & NAVIGATION ═══════════
window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('open');
};

window.switchPage = (pageName) => {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });

    // Update title
    const titles = { dashboard: 'Dashboard', users: 'Users', orders: 'Orders', deposits: 'Deposits' };
    document.getElementById('page-title').textContent = titles[pageName] || 'Dashboard';

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
};

// ═══════════ DASHBOARD RENDERERS ═══════════
function renderRecentUsers(users) {
    const tbody = document.getElementById('recent-users-body');
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state"><span>👥</span>No users yet</div></td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td><strong>${u.firstName || u.username || 'Unknown'}</strong></td>
            <td class="balance-cell">$${u.balance.toFixed(2)}</td>
            <td style="color:var(--text-muted)">${formatDate(u.createdAt)}</td>
        </tr>
    `).join('');
}

function renderRecentOrders(orders) {
    const tbody = document.getElementById('recent-orders-body');
    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><span>🛒</span>No orders yet</div></td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(o => `
        <tr>
            <td>${o.user?.firstName || o.user?.username || 'User #' + o.userId}</td>
            <td>${o.countryId || '-'}</td>
            <td>${statusBadge(o.status)}</td>
            <td class="balance-cell">$${o.price.toFixed(2)}</td>
        </tr>
    `).join('');
}

// ═══════════ USERS PAGE ═══════════
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><span>👥</span>No users found</div></td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td class="id-cell">${u.telegramId}</td>
            <td>${u.firstName || '-'}</td>
            <td>${u.username ? '@' + u.username : '-'}</td>
            <td class="balance-cell">$${u.balance.toFixed(2)}</td>
            <td style="color:var(--text-muted)">$${(u.referralBalance || 0).toFixed(2)}</td>
            <td style="color:var(--text-muted)">${formatDate(u.createdAt)}</td>
            <td>
                <button class="btn-edit" onclick="openBalanceModal(${u.id}, '${escapeHtml(u.firstName || u.username || u.telegramId)}')">Edit</button>
            </td>
        </tr>
    `).join('');
}

function filterUsers(query) {
    const q = query.toLowerCase();
    const filtered = allUsers.filter(u =>
        u.telegramId.includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.firstName && u.firstName.toLowerCase().includes(q))
    );
    renderUsersTable(filtered);
}

// ═══════════ ORDERS PAGE ═══════════
function renderOrdersTable(orders) {
    const filtered = currentOrderFilter === 'ALL' ? orders : orders.filter(o => o.status === currentOrderFilter);
    const tbody = document.getElementById('orders-table-body');
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><span>🛒</span>No orders found</div></td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(o => `
        <tr>
            <td class="id-cell">#${o.id}</td>
            <td>${o.user?.firstName || o.user?.username || 'User #' + o.userId}</td>
            <td style="font-family:monospace">${o.phoneNumber || '-'}</td>
            <td>${o.countryId || '-'}</td>
            <td class="balance-cell">$${o.price.toFixed(2)}</td>
            <td>${statusBadge(o.status)}</td>
            <td style="color:var(--text-muted)">${formatDate(o.createdAt)}</td>
        </tr>
    `).join('');
}

window.filterOrders = (status) => {
    currentOrderFilter = status;
    document.querySelectorAll('#page-orders .filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.filter === status);
    });
    renderOrdersTable(allOrders);
};

// ═══════════ DEPOSITS PAGE ═══════════
function renderDepositsTable(deposits) {
    const filtered = currentDepositFilter === 'ALL' ? deposits : deposits.filter(d => d.status === currentDepositFilter);
    const tbody = document.getElementById('deposits-table-body');
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><span>💳</span>No deposits found</div></td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(d => `
        <tr>
            <td class="id-cell">#${d.id}</td>
            <td>${d.user?.firstName || d.user?.username || 'User #' + d.userId}</td>
            <td class="balance-cell">$${d.amount.toFixed(2)}</td>
            <td>${d.method || '-'}</td>
            <td>${statusBadge(d.status)}</td>
            <td style="color:var(--text-muted)">${formatDate(d.createdAt)}</td>
            <td>
                ${d.status === 'PENDING' ? `
                    <button class="btn-approve" onclick="handleDeposit(${d.id}, 'APPROVED')">✓</button>
                    <button class="btn-reject" onclick="handleDeposit(${d.id}, 'REJECTED')">✕</button>
                ` : '-'}
            </td>
        </tr>
    `).join('');
}

window.filterDeposits = (status) => {
    currentDepositFilter = status;
    document.querySelectorAll('#page-deposits .filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.filter === status);
    });
    renderDepositsTable(allDeposits);
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

// ═══════════ BALANCE MODAL ═══════════
window.openBalanceModal = (id, name) => {
    currentEditingUserId = id;
    document.getElementById('target-user-display').textContent = `Updating balance for: ${name}`;
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
        btn.textContent = 'Update Balance';
    }
};

// ═══════════ HELPERS ═══════════
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
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ═══════════ START ═══════════
init();

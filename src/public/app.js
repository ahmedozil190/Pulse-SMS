const webapp = window.Telegram.WebApp;
webapp.expand();
webapp.ready();

let allUsers = [], allOrders = [], allDeposits = [];
let currentEditingUserId = null;
let currentOrderFilter = 'ALL', currentDepositFilter = 'ALL';

async function init() {
    try {
        await refreshData();
        document.getElementById('user-search').addEventListener('input', e => filterUsers(e.target.value));

        if (webapp.initDataUnsafe && webapp.initDataUnsafe.user) {
            const name = webapp.initDataUnsafe.user.first_name || 'Admin';
            document.getElementById('admin-avatar').textContent = name.substring(0, 2).toUpperCase();
        }

        document.body.classList.remove('loading');
        document.getElementById('loader').style.display = 'none';
        document.getElementById('app').style.display = 'block';
    } catch (err) {
        console.error('Init error:', err);
        document.getElementById('loader').innerHTML = '<div class="loader-content"><span>⚠️ Failed to load</span></div>';
        document.body.classList.remove('loading');
    }
}

function getHeaders() { return { 'x-telegram-init-data': webapp.initData }; }

async function refreshData() {
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

    // Dashboard stats
    document.getElementById('stat-total-users').textContent = stats.totalUsers || 0;
    document.getElementById('stat-total-orders').textContent = allOrders.length || 0;
    document.getElementById('stat-total-sales').textContent = stats.successfulOrders || 0;
    document.getElementById('stat-pending-orders').textContent = allOrders.filter(o => o.status === 'PENDING').length;
    document.getElementById('stat-cancelled-orders').textContent = allOrders.filter(o => o.status === 'CANCELLED').length;
    document.getElementById('stat-total-revenue').textContent = `$${(stats.totalRevenue || 0).toFixed(2)}`;
    document.getElementById('stat-pending-deposits').textContent = stats.pendingDeposits || 0;

    renderUsers(allUsers);
    renderOrders(allOrders);
    renderDeposits(allDeposits);
}

// ═══ SIDEBAR ═══
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('open');

window.switchPage = (pageName) => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === pageName));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${pageName}`));
    const titles = { dashboard:'Overview', users:'Users', orders:'Orders', deposits:'Finance', settings:'Settings' };
    document.getElementById('page-title').textContent = titles[pageName] || 'Overview';
    document.getElementById('sidebar').classList.remove('open');
};

// ═══ USERS ═══
function renderUsers(users) {
    const el = document.getElementById('users-list');
    if (!users.length) { el.innerHTML = '<div class="empty-state"><span>👥</span>No users yet</div>'; return; }
    el.innerHTML = users.map(u => `
        <div class="data-card">
            <div class="data-card-header">
                <span class="data-card-name">${u.firstName || u.username || 'Unknown'}</span>
                <span class="data-card-id">${u.telegramId}</span>
            </div>
            <div class="data-card-body">
                <div>
                    <span class="data-card-detail">Balance: <strong class="color-green">$${u.balance.toFixed(2)}</strong></span>
                    <span class="data-card-detail" style="margin-left:12px">Referral: <strong class="color-purple">$${(u.referralBalance||0).toFixed(2)}</strong></span>
                </div>
                <div class="data-card-actions">
                    <button class="btn-edit" onclick="openBalanceModal(${u.id},'${esc(u.firstName||u.username||u.telegramId)}')">Edit Balance</button>
                </div>
            </div>
        </div>
    `).join('');
}

function filterUsers(q) {
    q = q.toLowerCase();
    renderUsers(allUsers.filter(u =>
        u.telegramId.includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.firstName && u.firstName.toLowerCase().includes(q))
    ));
}

// ═══ ORDERS ═══
function renderOrders(orders) {
    const filtered = currentOrderFilter === 'ALL' ? orders : orders.filter(o => o.status === currentOrderFilter);
    const el = document.getElementById('orders-list');
    if (!filtered.length) { el.innerHTML = '<div class="empty-state"><span>🛒</span>No orders found</div>'; return; }
    el.innerHTML = filtered.map(o => `
        <div class="data-card">
            <div class="data-card-header">
                <span class="data-card-name">${o.user?.firstName || o.user?.username || '#'+o.userId}</span>
                ${badge(o.status)}
            </div>
            <div class="data-card-body">
                <span class="data-card-detail">Phone: <strong>${o.phoneNumber||'-'}</strong></span>
                <span class="data-card-detail">Country: <strong>${o.countryId||'-'}</strong></span>
                <span class="data-card-detail">Price: <strong class="color-green">$${o.price.toFixed(2)}</strong></span>
                <span class="data-card-detail" style="color:var(--text-muted)">${fmtDate(o.createdAt)}</span>
            </div>
        </div>
    `).join('');
}

window.filterOrders = (s) => {
    currentOrderFilter = s;
    document.querySelectorAll('#page-orders .filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter===s));
    renderOrders(allOrders);
};

// ═══ DEPOSITS ═══
function renderDeposits(deposits) {
    const filtered = currentDepositFilter === 'ALL' ? deposits : deposits.filter(d => d.status === currentDepositFilter);
    const el = document.getElementById('deposits-list');
    if (!filtered.length) { el.innerHTML = '<div class="empty-state"><span>💳</span>No deposits found</div>'; return; }
    el.innerHTML = filtered.map(d => `
        <div class="data-card">
            <div class="data-card-header">
                <span class="data-card-name">${d.user?.firstName || d.user?.username || '#'+d.userId}</span>
                ${badge(d.status)}
            </div>
            <div class="data-card-body">
                <span class="data-card-detail">Amount: <strong class="color-green">$${d.amount.toFixed(2)}</strong></span>
                <span class="data-card-detail">Method: <strong>${d.method||'-'}</strong></span>
                <span class="data-card-detail" style="color:var(--text-muted)">${fmtDate(d.createdAt)}</span>
                ${d.status === 'PENDING' ? `
                    <div class="data-card-actions">
                        <button class="btn-approve" onclick="handleDeposit(${d.id},'APPROVED')">✓ Approve</button>
                        <button class="btn-reject" onclick="handleDeposit(${d.id},'REJECTED')">✕ Reject</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

window.filterDeposits = (s) => {
    currentDepositFilter = s;
    document.querySelectorAll('#page-deposits .filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter===s));
    renderDeposits(allDeposits);
};

window.handleDeposit = async (id, action) => {
    try {
        const res = await fetch('/api/admin/deposit-action', {
            method:'POST', headers:{'Content-Type':'application/json', ...getHeaders()},
            body: JSON.stringify({ depositId:id, action })
        });
        if (res.ok) await refreshData();
        else { const e = await res.json(); alert('Error: '+(e.msg||'Failed')); }
    } catch(e) { console.error(e); }
};

// ═══ BALANCE MODAL ═══
window.openBalanceModal = (id, name) => {
    currentEditingUserId = id;
    document.getElementById('target-user-display').textContent = `Updating balance for: ${name}`;
    document.getElementById('balance-amount').value = '';
    document.getElementById('balance-modal').classList.add('active');
};
window.closeModal = () => document.getElementById('balance-modal').classList.remove('active');

window.performBalanceUpdate = async () => {
    const amount = parseFloat(document.getElementById('balance-amount').value);
    if (isNaN(amount)) return alert('Enter a valid number');
    const btn = document.getElementById('confirm-balance-btn');
    btn.disabled = true; btn.textContent = 'Updating...';
    try {
        const res = await fetch('/api/admin/balance', {
            method:'POST', headers:{'Content-Type':'application/json', ...getHeaders()},
            body: JSON.stringify({ userId:currentEditingUserId, amount })
        });
        if (res.ok) { closeModal(); await refreshData(); }
        else { const e = await res.json(); alert('Error: '+(e.msg||'Failed')); }
    } catch(e) { alert('Network error'); }
    finally { btn.disabled = false; btn.textContent = 'Update'; }
};

// ═══ HELPERS ═══
function badge(s) {
    const cls = { COMPLETED:'badge-completed', APPROVED:'badge-approved', PENDING:'badge-pending', CANCELLED:'badge-cancelled', REJECTED:'badge-rejected' };
    return `<span class="badge ${cls[s]||'badge-pending'}">${s}</span>`;
}
function fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
function esc(s) { return String(s).replace(/'/g,"\\'"); }

init();

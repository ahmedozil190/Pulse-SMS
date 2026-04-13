const webapp = window.Telegram.WebApp;
webapp.expand();
webapp.ready();

// DOM Elements
const body = document.body;
const loader = document.getElementById('loader');
const app = document.getElementById('app');
const totalUsersEl = document.getElementById('total-users');
const totalSalesEl = document.getElementById('total-sales');
const totalRevenueEl = document.getElementById('total-revenue');
const userListBody = document.getElementById('user-list-body');
const userSearchInput = document.getElementById('user-search');
const modal = document.getElementById('balance-modal');
const modalNameDisplay = document.getElementById('target-user-display');
const balanceInput = document.getElementById('balance-amount');
const confirmBalanceBtn = document.getElementById('confirm-balance-btn');
const cancelBtn = document.getElementById('cancel-btn');

let allUsers = [];
let currentEditingUserId = null;

// Initialize
async function init() {
    try {
        // Authenticate - we pass the initData to the backend for verification
        const initData = webapp.initData;
        
        // Fetch stats
        await refreshData();
        
        // Setup Search
        userSearchInput.addEventListener('input', (e) => {
            filterUsers(e.target.value);
        });

        // Setup Modal Buttons
        cancelBtn.addEventListener('click', closeModal);
        confirmBalanceBtn.addEventListener('click', performBalanceUpdate);

        // Hide loader
        body.classList.remove('loading');
        loader.style.display = 'none';
        app.style.display = 'block';

        // Set admin name from telegram
        if (webapp.initDataUnsafe && webapp.initDataUnsafe.user) {
            document.getElementById('admin-name').textContent = webapp.initDataUnsafe.user.first_name;
        }

    } catch (err) {
        console.error('Initialization error:', err);
        alert('Failed to load dashboard. Make sure you have authorized correctly.');
    }
}

async function refreshData() {
    try {
        const initData = webapp.initData;
        
        // Get Stats
        const statsRes = await fetch('/api/admin/stats', {
            headers: { 'x-telegram-init-data': initData }
        });
        const stats = await statsRes.json();
        
        totalUsersEl.textContent = stats.totalUsers;
        totalSalesEl.textContent = stats.successfulOrders;
        totalRevenueEl.textContent = `${stats.totalRevenue.toFixed(2)}$`;

        // Get Users
        const usersRes = await fetch('/api/admin/users', {
            headers: { 'x-telegram-init-data': initData }
        });
        allUsers = await usersRes.json();
        renderUsers(allUsers);

    } catch (err) {
        console.error('Data refresh error:', err);
    }
}

function renderUsers(users) {
    userListBody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="user-id">${user.telegramId}</span></td>
            <td>${user.username || user.firstName || 'Unknown'}</td>
            <td><span class="user-balance">${user.balance.toFixed(2)}$</span></td>
            <td class="actions">
                <button class="edit-btn" onclick="openBalanceModal(${user.id}, '${user.username || user.firstName || user.telegramId}')">Edit</button>
            </td>
        `;
        userListBody.appendChild(row);
    });
}

function filterUsers(query) {
    const q = query.toLowerCase();
    const filtered = allUsers.filter(u => 
        u.telegramId.includes(q) || 
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.firstName && u.firstName.toLowerCase().includes(q))
    );
    renderUsers(filtered);
}

// Window functions for onclick handlers
window.openBalanceModal = (id, name) => {
    currentEditingUserId = id;
    modalNameDisplay.textContent = `Update balance for: ${name}`;
    balanceInput.value = '';
    modal.classList.add('active');
    balanceInput.focus();
};

function closeModal() {
    modal.classList.remove('active');
}

async function performBalanceUpdate() {
    const amount = parseFloat(balanceInput.value);
    if (isNaN(amount)) {
        webapp.showAlert('Please enter a valid number');
        return;
    }

    try {
        confirmBalanceBtn.disabled = true;
        confirmBalanceBtn.textContent = 'Updating...';
        
        const initData = webapp.initData;
        const res = await fetch('/api/admin/balance', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-telegram-init-data': initData 
            },
            body: JSON.stringify({ userId: currentEditingUserId, amount: amount })
        });

        if (res.ok) {
            webapp.showConfirm('Balance updated successfully!', () => {
                closeModal();
                refreshData();
            });
        } else {
            const err = await res.json();
            alert(`Error: ${err.msg || 'Update failed'}`);
        }
    } catch (err) {
        console.error('Update error:', err);
        alert('Network error while updating balance');
    } finally {
        confirmBalanceBtn.disabled = false;
        confirmBalanceBtn.textContent = 'Update';
    }
}

// Start
init();

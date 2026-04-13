const { Telegraf, session } = require('telegraf');
const dotenv = require('dotenv');
const prisma = require('./db/prisma');
const durianApi = require('./api/durian');
const keyboards = require('./keyboards');
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Simple session middleware
bot.use(session());

/**
 * /admin command - Opens the Mini App Dashboard
 */
bot.command('admin', async (ctx) => {
  const adminIds = (process.env.ADMIN_IDS || process.env.ADMIN_TELEGRAM_ID || "").split(',').map(id => id.trim());
  const userId = ctx.from.id.toString();

  if (!adminIds.includes(userId)) {
    return; // Silent fail or Access Denied
  }

  const webAppUrl = process.env.WEBAPP_URL || 'https://your-app.up.railway.app';

  await ctx.reply('🔒 *Welcome Creator*\nOpen the dashboard to manage your empire.', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Open Admin Dashboard', web_app: { url: webAppUrl } }]
      ]
    }
  });
});

/**
 * Helper to ensure user exists in Database
 */
async function getOrCreateUser(ctx, referrerTelegramId = null) {
  try {
    const telegramId = ctx.from.id.toString();
    ctx.session = ctx.session || {};

    let user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      let referredById = null;
      if (referrerTelegramId && referrerTelegramId !== telegramId) {
        const referrerUser = await prisma.user.findUnique({ where: { telegramId: referrerTelegramId } });
        if (referrerUser) {
          referredById = referrerUser.id;
        }
      }

      user = await prisma.user.create({
        data: {
          telegramId,
          username: ctx.from.username || null,
          firstName: ctx.from.first_name || null,
          balance: 0.0,
          referredById
        }
      });
    }
    return user;
  } catch (error) {
    console.error('[DATABASE ERROR] Failed to get/create user:', error.message);
    return null;
  }
}

/**
 * /start command
 */
bot.command('start', async (ctx) => {
  try {
    const args = (ctx.message.text || "").split(' ');
    let referrerTelegramId = null;
    if (args.length > 1 && args[1].startsWith('ref_')) {
      referrerTelegramId = args[1].replace('ref_', '');
    }

    const user = await getOrCreateUser(ctx, referrerTelegramId);
    if (!user) {
      return ctx.reply("⚠️ Sorry, there is a technical issue with the database setup. Please try again in 1 minute.");
    }

    const startMessage = `
🔰 *Welcome to International Numbers Store* 🔰

*Pulse SMS 🩸 👋*

*Choose the appropriate option from the menu:*
    `;

    await ctx.reply(startMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboards.mainMenu.reply_markup
    });
  } catch (err) {
    console.error('[START COMMAND ERROR]', err);
  }
});

/**
 * Handle My Balance
 */
bot.action('action_balance', async (ctx) => {
  const user = await getOrCreateUser(ctx);

  const totalPurchasesResult = await prisma.order.aggregate({
    _sum: { price: true },
    where: { userId: user.id, status: 'COMPLETED' }
  });
  const totalPurchases = (totalPurchasesResult._sum.price || 0).toFixed(2);
  const availableBalance = user.balance.toFixed(2);

  const msg = `*💰 Your Current Balance*\n\n*• Available Balance:* ${availableBalance}$\n*• Total Purchases:* ${totalPurchases}$\n\n*💎 Choose Deposit Method:*`;
  await ctx.editMessageText(msg, {
    parse_mode: 'Markdown',
    reply_markup: keyboards.depositMethods.reply_markup
  });
});

/**
 * Handle My Statistics
 */
bot.action('action_stats', async (ctx) => {
  const user = await getOrCreateUser(ctx);

  const allOrdersCount = await prisma.order.count({
    where: { userId: user.id }
  });

  const completedCount = await prisma.order.count({
    where: { userId: user.id, status: 'COMPLETED' }
  });

  const totalPurchasesResult = await prisma.order.aggregate({
    _sum: { price: true },
    where: { userId: user.id, status: 'COMPLETED' }
  });
  const totalSpent = (totalPurchasesResult._sum.price || 0).toFixed(2);

  const msg = `*📊 Your Personal Statistics*\n\n•* Active Numbers:* ${completedCount}\n• *Total Purchases:* ${allOrdersCount}\n• *Total Purchases:* ${totalSpent} $\n\n*🎯 Continue Shopping!*`;

  await ctx.editMessageText(msg, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 Back', callback_data: 'action_main_menu' }]
      ]
    }
  });
});

/**
 * Handle Deposit
 */
bot.action('action_deposit', async (ctx) => {
  await ctx.editMessageText(`*💎 Choose Deposit Method:*`, {
    parse_mode: 'Markdown',
    reply_markup: keyboards.depositMethods.reply_markup
  });
});
/**
 * Handle Invite Friend
 */
bot.action('action_invite', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const botInfo = await ctx.telegram.getMe();
  const inviteLink = `https://t.me/${botInfo.username}?start=ref_${ctx.from.id}`;

  const dateObj = new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${year}/${month}/${day}`;

  const totalTeam = await prisma.user.count({ where: { referredById: user.id } });

  const referrals = await prisma.user.findMany({ where: { referredById: user.id }, select: { id: true } });
  const refIds = referrals.map(r => r.id);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const allRefOrders = await prisma.order.findMany({
    where: {
      userId: { in: refIds },
      status: 'COMPLETED'
    },
    select: { price: true, updatedAt: true }
  });

  let todayCount = 0, todayEarn = 0;
  let weekCount = 0, weekEarn = 0;
  let monthCount = 0, monthEarn = 0;

  for (const o of allRefOrders) {
    const earn = o.price * 0.05;
    if (o.updatedAt >= startOfToday) {
      todayCount++; todayEarn += earn;
    }
    if (o.updatedAt >= startOfWeek) {
      weekCount++; weekEarn += earn;
    }
    if (o.updatedAt >= startOfMonth) {
      monthCount++; monthEarn += earn;
    }
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  const msg = `*🔗 Invite a Friend*\n\nInvite your friends and earn 5% of their purchases!\n\n📎 Your invite link:\n\`${inviteLink}\`\n\nCopy the link and send it to your friends. When they join through your link and buy a number, you'll earn 5% of the purchase price.\n\n*📊 Your Statistics*\n• 👥 Your total team: ${totalTeam}\n• Today: ${todayCount} (Earnings: ${todayEarn.toFixed(2)}$)\n• This week: ${weekCount} (Earnings: ${weekEarn.toFixed(2)}$)\n• This month: ${monthCount} (Earnings: ${monthEarn.toFixed(2)}$)\n• 💰 Current referral balance: ${dbUser.referralBalance.toFixed(2)}$\n\nThis balance is separate from your main balance and can be used to buy numbers or withdraw\n\n📅 Date: ${dateStr}`;

  await ctx.editMessageText(msg, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: '💰 Withdraw Earnings', callback_data: 'action_withdraw_referral' }],
        [{ text: '🔙 Back', callback_data: 'action_main_menu' }]
      ]
    }
  });
});

/**
 * Handle Referral Withdrawal
 */
bot.action('action_withdraw_referral', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  if (dbUser.referralBalance < 1) {
    const alertMsg = `❌ Your referral balance is insufficient.\n• Current balance: ${dbUser.referralBalance.toFixed(2)}$\n• Minimum required: 1$`;
    return ctx.answerCbQuery(alertMsg, { show_alert: true });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      balance: { increment: dbUser.referralBalance },
      referralBalance: 0
    }
  });

  return ctx.answerCbQuery(`✅ Withdrawal Successful!\n${dbUser.referralBalance.toFixed(2)}$ has been added to your main balance.`, { show_alert: true });
});

/**
 * Handle Buy Number - Show Country Selection
 */
bot.action('action_buy_number', async (ctx) => {
  await showCountrySelection(ctx);
});

async function showCountrySelection(ctx, isRefresh = false) {
  const loadingMsg = isRefresh ? "🔄 Refreshing list..." : "🌍 Loading countries...";

  if (!isRefresh) {
    await ctx.answerCbQuery().catch(() => { });
  }

  try {
    // 0257 is Telegram
    const response = await durianApi.getCountryDistribution('0257');

    if (response.code === 200 && response.data) {
      // Sort and take top 20 countries with stock > 0
      const distribution = response.data;
      const sortedCodes = Object.keys(distribution)
        .filter(c => c !== "" && distribution[c] > 0)
        .sort((a, b) => distribution[b] - distribution[a])
        .slice(0, 20); // Top 20 for better UI

      const filteredDistribution = {};
      sortedCodes.forEach(code => filteredDistribution[code] = distribution[code]);

      const msg = `🌍 *Choose Required Country*\n\n• Get all updates first-hand\n• Choose the country to buy number from:`;
      const keyboard = keyboards.buildCountryKeyboard(filteredDistribution);

      if (isRefresh) {
        await ctx.answerCbQuery("✅ List refreshed");
      }

      await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } else {
      await ctx.editMessageText(`❌ Failed to load countries: ${response.msg}`, {
        reply_markup: keyboards.backToMain.reply_markup
      });
    }
  } catch (error) {
    console.error("Error loading countries:", error);
    await ctx.editMessageText(`❌ System error while loading countries.`, {
      reply_markup: keyboards.backToMain.reply_markup
    });
  }
}

/**
 * Handle Refresh List
 */
bot.action('action_refresh_countries', async (ctx) => {
  ctx.session = ctx.session || {};
  const now = Date.now();
  const lastRefresh = ctx.session.lastRefresh || 0;
  const elapsed = now - lastRefresh;

  if (elapsed < 3000) {
    const remaining = Math.ceil((3000 - elapsed) / 1000);
    return ctx.answerCbQuery(`⏳ Please wait ${remaining} seconds before refreshing again`, { showAlert: true });
  }

  ctx.session.lastRefresh = now;
  await showCountrySelection(ctx, true);
});

/**
 * Handle Country Selection
 */
bot.action(/^select_country_(.+)$/, async (ctx) => {
  const countryCode = ctx.match[1];
  const countryInfo = durianApi.getCountryInfo(countryCode);

  await ctx.answerCbQuery().catch(() => { });

  const percentages = ['10%', '30%', '70%', '100%'];
  for (let percent of percentages) {
    await ctx.editMessageText(`🔄 Trying to purchase number...`, {
      reply_markup: {
        inline_keyboard: [[{ text: percent, callback_data: 'ignore' }]]
      }
    }).catch(() => { });
    await new Promise(r => setTimeout(r, 600));
  }

  try {
    const response = await durianApi.getMobile('0257', countryCode);

    if (response.code === 200 && response.data) {
      const phoneNumber = response.data;
      const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;

      const user = await getOrCreateUser(ctx);
      await prisma.order.create({
        data: {
          userId: user.id,
          serviceId: '0257',
          countryId: countryCode,
          phoneNumber: phoneNumber,
          price: 0.25,
          status: 'PENDING'
        }
      });

      const msg = `🎉 *Purchase Successful!*\n\n• *Number*: \`+${cleanPhone}\`\n• *Country*: ${countryInfo.flag} ${countryInfo.name}\n• *Code*: \`XXXXX\`\n\n*🔄 Request Code*`;

      await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Request Code', callback_data: `check_code_${countryCode}_${phoneNumber}` }]
          ]
        }
      });

      // ... polling logic remains the same ...
      startPolling(ctx, phoneNumber, countryCode);

    } else {
      await ctx.editMessageText(`❌ Failed to get number: ${response.msg}`, {
        reply_markup: keyboards.backToMain.reply_markup
      });
    }
  } catch (error) {
    await ctx.editMessageText(`❌ System error. Try again later.`, {
      reply_markup: keyboards.backToMain.reply_markup
    });
  }
});

/**
 * Handle Manual Code Request
 */
bot.action(/^check_code_(.+)_(.+)$/, async (ctx) => {
  const countryCode = ctx.match[1];
  const phoneNumber = ctx.match[2];
  const countryInfo = durianApi.getCountryInfo(countryCode);
  const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;

  await ctx.answerCbQuery().catch(() => { });

  // Random animation effect "ارقام ورا بعض"
  for (let i = 0; i < 3; i++) {
    const randomCode = Math.floor(10000 + Math.random() * 90000);
    const animMsg = `🎉 *Purchase Successful!*\n\n• *Number*: \`+${cleanPhone}\`\n• *Country*: ${countryInfo.flag} ${countryInfo.name}\n• *Code*: \`${randomCode}\`\n\n*🔄 Request Code*`;
    try {
      await ctx.editMessageText(animMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔄 Request Code', callback_data: `check_code_${countryCode}_${phoneNumber}` }]]
        }
      });
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (e) { }
  }

  try {
    const smsRes = await durianApi.getMsg('0257', phoneNumber);
    if (smsRes.code === 200 && smsRes.data && smsRes.data.length > 0) {
      await completeOrderAndCommission(phoneNumber, smsRes.data);
      const msg = `🎉 Purchase Successful\n\n• *Number*: \`+${cleanPhone}\`\n• *Country*: ${countryInfo.flag} ${countryInfo.name}\n• *Code*:  \`${smsRes.data}\`\n\n✅ You can use the code now`;
      await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛒 Buy Another Number', callback_data: 'action_buy_number' }],
            [{ text: '📢 Activation Channel', url: 'https://t.me/your_activation_channel' }]
          ]
        }
      });
    } else {
      const msg = `🎉 Purchase Successful\n\n• *Number*: \`+${cleanPhone}\`\n• *Country*: ${countryInfo.flag} ${countryInfo.name}\n• *Code*:  \`XXXXX\`\n\n❌ *The code was not retrieved. Please try again.*`;
      await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Retry', callback_data: `check_code_${countryCode}_${phoneNumber}` }],
            [{ text: '🔙 Main Menu', callback_data: 'action_main_menu' }]
          ]
        }
      });
    }
  } catch (err) {
    const errorMsg = `🎉 Purchase Successful\n\n• *Number*: \`+${cleanPhone}\`\n• *Country*: ${countryInfo.flag} ${countryInfo.name}\n• *Code*:  \`XXXXX\`\n\n❌ *The code was not retrieved. Please try again.*`;
    await ctx.editMessageText(errorMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Retry', callback_data: `check_code_${countryCode}_${phoneNumber}` }],
          [{ text: '🔙 Main Menu', callback_data: 'action_main_menu' }]
        ]
      }
    });
  }
});

async function completeOrderAndCommission(phoneNumber, smsCode) {
  const order = await prisma.order.findFirst({
    where: { phoneNumber, status: 'PENDING' },
    orderBy: { id: 'desc' }
  });
  if (order) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'COMPLETED', smsCode }
    });
    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    if (user && user.referredById) {
      const commission = order.price * 0.05;
      await prisma.user.update({
        where: { id: user.referredById },
        data: { referralBalance: { increment: commission } }
      });
    }
  }
}

async function cancelOrder(phoneNumber) {
  const order = await prisma.order.findFirst({
    where: { phoneNumber, status: 'PENDING' },
    orderBy: { id: 'desc' }
  });
  if (order) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED' }
    });
  }
}

/**
 * Polling Logic Helper
 */
async function startPolling(ctx, phoneNumber, countryCode) {
  let attempts = 0;
  const maxAttempts = 20; // 5 minutes at 15s per check

  const pollInterval = setInterval(async () => {
    attempts++;
    try {
      const smsRes = await durianApi.getMsg('0257', phoneNumber);
      if (smsRes.code === 200 && smsRes.data && smsRes.data.length > 0) {
        clearInterval(pollInterval);
        await completeOrderAndCommission(phoneNumber, smsRes.data);
        const countryInfo = durianApi.getCountryInfo(countryCode);
        const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.callbackQuery.message.message_id,
          null,
          `🎉 Purchase Successful\n\n• *Number*: \`+${cleanPhone}\`\n• *Country*: ${countryInfo.flag} ${countryInfo.name}\n• *Code*:  \`${smsRes.data}\`\n\n✅ You can use the code now`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🛒 Buy Another Number', callback_data: 'action_buy_number' }],
                [{ text: '📢 Activation Channel', url: 'https://t.me/your_activation_channel' }]
              ]
            }
          }
        );
      } else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        await durianApi.releaseNumber('0257', phoneNumber);
        await cancelOrder(phoneNumber);
        const countryInfo = durianApi.getCountryInfo(countryCode);
        const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.callbackQuery.message.message_id,
          null,
          `🎉 Purchase Successful\n\n• *Number*: \`+${cleanPhone}\`\n• *Country*: ${countryInfo.flag} ${countryInfo.name}\n• *Code*:  \`XXXXX\`\n\n❌ *The code was not retrieved. Please try again.*`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Retry', callback_data: `check_code_${countryCode}_${phoneNumber}` }],
                [{ text: '🔙 Main Menu', callback_data: 'action_main_menu' }]
              ]
            }
          }
        );
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, 15000);
}

/**
 * Return to Main Menu
 */
bot.action('action_main_menu', async (ctx) => {
  const startMessage = `
🔰 *Welcome to International Numbers Store* 🔰

*Pulse SMS 🩸 👋*

*Choose the appropriate option from the menu:*
  `;

  await ctx.editMessageText(startMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboards.mainMenu.reply_markup
  });
});



/**
 * Catch all text for simple testing
 */
bot.on('text', async (ctx) => {
  await ctx.reply("Please use the menu /start");
});


bot.command('lang', async (ctx) => {
  await ctx.reply("Language selection coming soon...");
});

bot.launch().then(async () => {
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: '/start' },
      { command: 'lang', description: '/lang' }
    ]);
  } catch (e) {
    console.log('Failed to set commands', e);
  }
  console.log('[BOT] Pulse SMS Bot started successfully.');
});

// --- EXPRESS SERVER FOR ADMIN WEB APP ---
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Verify Telegram Web App initData
 */
function verifyTelegramWebAppData(initData) {
  if (!initData) return false;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  const data = [];

  urlParams.sort();
  for (const [key, value] of urlParams.entries()) {
    if (key !== 'hash') {
      data.push(`${key}=${value}`);
    }
  }

  const dataCheckString = data.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const checkHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return checkHash === hash;
}

/**
 * Middleware to check if request is from an authorized Admin
 */
const isAdminMiddleware = (req, res, next) => {
  const initData = req.headers['x-telegram-init-data'];
  if (!verifyTelegramWebAppData(initData)) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }

  const urlParams = new URLSearchParams(initData);
  const userData = JSON.parse(urlParams.get('user'));
  const adminIds = (process.env.ADMIN_IDS || process.env.ADMIN_TELEGRAM_ID || "").split(',');

  if (!adminIds.includes(userData.id.toString())) {
    return res.status(403).json({ msg: 'Forbidden' });
  }

  next();
};

// API Endpoints
app.get('/api/admin/stats', isAdminMiddleware, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const successfulOrders = await prisma.order.count({ where: { status: 'COMPLETED' } });
    const revenueRes = await prisma.order.aggregate({
      _sum: { price: true },
      where: { status: 'COMPLETED' }
    });
    const pendingDeposits = await prisma.deposit.count({ where: { status: 'PENDING' } });

    res.json({
      totalUsers,
      successfulOrders,
      totalRevenue: revenueRes._sum.price || 0,
      pendingDeposits
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

app.get('/api/admin/users', isAdminMiddleware, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(users || []);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

app.get('/api/admin/orders', isAdminMiddleware, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { firstName: true, username: true, telegramId: true } } }
    });
    res.json(orders || []);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

app.get('/api/admin/deposits', isAdminMiddleware, async (req, res) => {
  try {
    const deposits = await prisma.deposit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { firstName: true, username: true, telegramId: true } } }
    });
    res.json(deposits || []);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

app.post('/api/admin/balance', isAdminMiddleware, async (req, res) => {
  const { userId, amount } = req.body;
  if (isNaN(amount)) return res.status(400).json({ msg: 'Invalid amount' });

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to update balance' });
  }
});

app.post('/api/admin/deposit-action', isAdminMiddleware, async (req, res) => {
  const { depositId, action } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(action)) {
    return res.status(400).json({ msg: 'Invalid action' });
  }

  try {
    const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) return res.status(404).json({ msg: 'Deposit not found' });
    if (deposit.status !== 'PENDING') return res.status(400).json({ msg: 'Deposit already processed' });

    // Update deposit status
    await prisma.deposit.update({
      where: { id: depositId },
      data: { status: action }
    });

    // If approved, add balance to user
    if (action === 'APPROVED') {
      await prisma.user.update({
        where: { id: deposit.userId },
        data: { balance: { increment: deposit.amount } }
      });

      // Notify the user via Telegram
      try {
        const user = await prisma.user.findUnique({ where: { id: deposit.userId } });
        if (user) {
          await bot.telegram.sendMessage(user.telegramId,
            `✅ *Deposit Approved!*\n\n💰 Amount: $${deposit.amount.toFixed(2)}\n💎 Your new balance has been updated.\n\nThank you for your deposit!`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (notifyErr) {
        console.error('[NOTIFY ERROR]', notifyErr.message);
      }
    }

    if (action === 'REJECTED') {
      try {
        const user = await prisma.user.findUnique({ where: { id: deposit.userId } });
        if (user) {
          await bot.telegram.sendMessage(user.telegramId,
            `❌ *Deposit Rejected*\n\n💰 Amount: $${deposit.amount.toFixed(2)}\n\nYour deposit request has been rejected. Please contact support if you believe this is an error.`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (notifyErr) {
        console.error('[NOTIFY ERROR]', notifyErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[DEPOSIT ACTION ERROR]', err);
    res.status(500).json({ msg: 'Failed to process deposit' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[SERVER] Admin Dashboard running on port ${PORT}`);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

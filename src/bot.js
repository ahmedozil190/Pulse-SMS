const { Telegraf, session, Markup } = require('telegraf');
const dotenv = require('dotenv');
const prisma = require('./db/prisma');
const durianApi = require('./api/durian');
const keyboards = require('./keyboards');
const i18n = require('./i18n');
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const hunter = require('./services/hunter');

dotenv.config();

// Start the Live Hunting Monitor (5s interval)
hunter.start(5000);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Escapes characters for HTML parse mode
 */
const escapeHTML = (str) => {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Simple session middleware
bot.use(session());

/**
 * i18n Middleware - Detect user language and provide translation helper
 */
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();

  const { user } = await getOrCreateUser(ctx);
  const lang = user?.language || 'en';

  ctx.state.lang = lang;
  ctx.t = (key, params) => i18n.t(lang, key, params);

  return next();
});
/**
 * Maintenance Mode Middleware
 */
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();

  // Skip maintenance check for admins
  const adminIds = (process.env.ADMIN_IDS || process.env.ADMIN_TELEGRAM_ID || "").split(',').map(id => id.trim());
  if (adminIds.includes(ctx.from.id.toString())) {
    return next();
  }

  const maintenance = await prisma.globalSetting.findUnique({ where: { key: 'maintenance_mode' } });
  if (maintenance && maintenance.value === 'true') {
    return ctx.reply('🛠️ <b>System Under Maintenance</b>\n\nWe are currently performing scheduled maintenance to improve our service. Please try again later.\n\nThank you for your patience!', { parse_mode: 'HTML' });
  }

  return next();
});

/**
 * Mandatory Subscription Middleware
 */
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();

  // We previously skipped admins, but admins might want to test the subscription requirement on their own account.
  // if (adminIds.includes(ctx.from.id.toString())) return next();

  try {
    const channels = await prisma.mandatoryChannel.findMany();
    if (channels.length === 0) return next();

    const notJoined = [];
    for (const channel of channels) {
      try {
        let chUsername = channel.username.trim();
        if (!chUsername.startsWith('@') && !chUsername.startsWith('-') && !chUsername.match(/^\d+$/)) {
          chUsername = '@' + chUsername;
        }

        const member = await ctx.telegram.getChatMember(chUsername, ctx.from.id);
        const joinedStatus = ['member', 'administrator', 'creator'];
        if (!joinedStatus.includes(member.status)) {
          notJoined.push(channel);
        }
      } catch (err) {
        console.error(`[SUB CHECK ERROR] ${channel.username}:`, err.message);
        // If bot isn't admin, it fails to check. We block the user and show the button anyway, 
        // to force the owner to fix the bot's admin status in the channel, rather than failing silently.
        notJoined.push(channel);
      }
    }

    if (notJoined.length > 0) {
      // 1- Sequential subscription: Show only the first unjoined channel
      const nextChannel = notJoined[0];
      const buttons = [
        [Markup.button.url('- Click Here .', nextChannel.link)]
      ];

      const msgText = '<b>🔒 Subscription Required</b>\n\nSorry, you must join our channel first to use the bot:\n\n<b>✅ After joining, send</b> /start';
      const msgOpts = {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      };

      // 2- Mutate current message if interaction came from a button click
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCbQuery(); // Acknowledge without a popup text
          await ctx.editMessageText(msgText, msgOpts);
          return;
        } catch (e) {
          // Fallback if message content is exactly the same or edit fails
          if (e.description && e.description.includes('exactly the same')) return;
          return ctx.reply(msgText, msgOpts);
        }
      } else {
        return ctx.reply(msgText, msgOpts);
      }
    }
  } catch (err) {
    console.error('[SUB MIDDLEWARE ERROR]', err);
  }

  return next();
});

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

  await ctx.reply('🔒 <b>Welcome Creator</b>\nOpen the dashboard to manage your empire.', {
    parse_mode: 'HTML',
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
    const userExistsBefore = !!user;

    if (!user) {
      let referredById = null;
      if (referrerTelegramId && referrerTelegramId !== telegramId) {
        const referrerUser = await prisma.user.findUnique({ where: { telegramId: referrerTelegramId } });
        if (referrerUser) {
          referredById = referrerUser.id;
        }
      }

      // Auto-detect language from Telegram if possible
      let detectedLang = 'en';
      if (ctx.from.language_code && ctx.from.language_code.startsWith('ar')) {
        detectedLang = 'ar';
      }

      user = await prisma.user.create({
        data: {
          telegramId,
          username: ctx.from.username || null,
          firstName: ctx.from.first_name || null,
          lastName: ctx.from.last_name || null,
          balance: 0.0,
          language: detectedLang,
          referredById
        }
      });
      ctx.session.isFirstTime = true;
    } else {
      // PROMPT SYNC: Update user info if it changed since last interaction
      const currentFirstName = ctx.from.first_name || null;
      const currentLastName = ctx.from.last_name || null;
      const currentUsername = ctx.from.username || null;

      if (user.firstName !== currentFirstName || user.lastName !== currentLastName || user.username !== currentUsername) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            firstName: currentFirstName,
            lastName: currentLastName,
            username: currentUsername
          }
        });
      }
    }

    // Attach language to session for faster access if needed
    ctx.session.lang = user.language;

    return { user, isNew: !userExistsBefore };
  } catch (error) {
    console.error('[DATABASE ERROR] Failed to get/create user:', error.message);
    return { user: null, isNew: false };
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

    const { user, isNew } = await getOrCreateUser(ctx, referrerTelegramId);
    if (!user) {
      return ctx.reply("⚠️ Sorry, there is a technical issue with the database setup. Please try again in 1 minute.");
    }

    if (isNew || ctx.session.isFirstTime) {
      // Clear flag so they don't get stuck in language selection
      ctx.session.isFirstTime = false;
      // First time using the bot (after they just subscribed if required)
      return ctx.reply(ctx.t('choose_lang'), keyboards.languageSelect);
    }

    const msg = ctx.t('welcome_user', { name: escapeHTML(ctx.from.first_name || 'User') });
    await ctx.reply(msg, {
      parse_mode: 'HTML',
      reply_markup: keyboards.mainMenu(ctx.state.lang).reply_markup
    });
  } catch (err) {
    console.error('[START COMMAND ERROR]', err);
  }
});

/**
 * /lang command
 */
bot.command('lang', (ctx) => {
  return ctx.reply(ctx.t('choose_lang'), keyboards.languageSelect);
});

// Handle Language Switch
['ar', 'en', 'fa', 'bn'].forEach(lang => {
  bot.action(`set_lang_${lang}`, async (ctx) => {
    try {
      await prisma.user.update({
        where: { telegramId: ctx.from.id.toString() },
        data: { language: lang }
      });
      ctx.state.lang = lang;
      ctx.t = (key, params) => i18n.t(lang, key, params); // Refresh translation helper for current request

      const langNames = { ar: 'العربية', en: 'English', fa: 'فارسی', bn: 'বাংলা' };
      await ctx.answerCbQuery(ctx.t('lang_set_success', { lang: langNames[lang] || lang }));

      // Send fresh start message in new language
      const msg = ctx.t('welcome_bot');
      await ctx.reply(msg, {
        parse_mode: 'HTML',
        reply_markup: keyboards.mainMenu(lang).reply_markup
      });

      // Cleanup
      await ctx.deleteMessage();
    } catch (err) { console.error(err); }
  });
});

/**
 * Handle My Balance
 */
bot.action('action_balance', async (ctx) => {
  const { user } = await getOrCreateUser(ctx);

  const totalPurchasesResult = await prisma.order.aggregate({
    _sum: { price: true },
    where: { userId: user.id, status: 'COMPLETED' }
  });
  const totalPurchases = (totalPurchasesResult._sum.price || 0).toFixed(0);
  const availableBalance = user.balance.toFixed(0);

  const msg = ctx.t('balance_header', { balance: availableBalance, purchases: totalPurchases });
  await ctx.editMessageText(msg, {
    parse_mode: 'HTML'
  });
});

/**
 * Handle My Statistics
 */
bot.action('action_stats', async (ctx) => {
  const { user } = await getOrCreateUser(ctx);

  const allOrdersCount = await prisma.order.count({
    where: { userId: user.id }
  });
  const totalPurchasesResult = await prisma.order.aggregate({
    _sum: { price: true },
    _count: { id: true },
    where: { userId: user.id, status: 'COMPLETED' }
  });

  const totalSpent = (totalPurchasesResult._sum.price || 0).toFixed(1);
  const totalCount = totalPurchasesResult._count.id;

  const activeCount = 0;

  const msg = ctx.t('stats_header', {
    active: activeCount,
    count: totalCount,
    total: totalSpent
  });

  await ctx.editMessageText(msg, {
    parse_mode: 'HTML',
    reply_markup: keyboards.backToMain(ctx.state.lang).reply_markup
  });
});

/**
 * Handle Deposit
 */
bot.action('action_deposit', async (ctx) => {
  await ctx.editMessageText(ctx.t('deposit_header'), {
    parse_mode: 'HTML',
    reply_markup: keyboards.depositMethods(ctx.state.lang).reply_markup
  });
});

/**
 * Handle Invite Friend
 */
bot.action('action_invite', async (ctx) => {
  try {
    console.log(`[ACTION] User ${ctx.from.id} clicked Invite button`);
    await ctx.answerCbQuery().catch(() => { });

    const { user } = await getOrCreateUser(ctx);
    if (!user) {
      console.error('[INVITE] Failed to get/create user');
      return ctx.answerCbQuery('❌ Error: User record not found.', { show_alert: true });
    }

    const botInfo = await ctx.telegram.getMe();
    const inviteLink = `https://t.me/${botInfo.username}?start=ref_${ctx.from.id}`;

    const dateObj = new Date(new Date().getTime() + (2 * 60 * 60 * 1000)); // Adjust to GMT+2
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${year}/${month}/${day}`;

    // Get team count
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

    // Get referral settings
    const settings = await prisma.globalSetting.findMany();
    const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
    const refPercent = parseFloat(settingsMap.referral_percent || '5');
    const minWithdraw = parseFloat(settingsMap.min_withdrawal || '1');

    // Calculate earnings with dynamic percent
    const refMultiplier = refPercent / 100;
    let todayCount = 0, todayEarn = 0;
    let weekCount = 0, weekEarn = 0;
    let monthCount = 0, monthEarn = 0;

    for (const o of allRefOrders) {
      const earn = o.price * refMultiplier;
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
    if (!dbUser) {
      console.error('[INVITE] dbUser not found for ID:', user.id);
      return ctx.answerCbQuery('❌ Error: User details not found.', { show_alert: true });
    }

    const msg = ctx.t('invite_header', {
      link: escapeHTML(inviteLink),
      percent: refPercent,
      min: minWithdraw,
      teamCount: totalTeam,
      todayCount: todayCount,
      todayProfit: todayEarn.toFixed(2),
      weekCount: weekCount,
      weekProfit: weekEarn.toFixed(2),
      monthCount: monthCount,
      monthProfit: monthEarn.toFixed(2),
      refBalance: dbUser.referralBalance.toFixed(2),
      date: dateStr
    });

    await ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(ctx.t('withdraw_btn'), 'action_withdraw_referral')],
        [Markup.button.callback(ctx.t('back_btn'), 'action_main_menu')]
      ]).reply_markup
    }).catch(err => {
      if (!err.message.includes('message is not modified')) {
        console.error('Edit error in action_invite:', err.message);
      }
    });

    console.log(`[ACTION] User ${ctx.from.id} invite stats shown`);
  } catch (err) {
    console.error('CRITICAL ERROR in action_invite handler:', err);
    await ctx.answerCbQuery('❌ A system error occurred. Please try again later.', { show_alert: true });
  }
});

/**
 * Handle Referral Withdrawal
 */
bot.action('action_withdraw_referral', async (ctx) => {
  const { user } = await getOrCreateUser(ctx);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  const settings = await prisma.globalSetting.findMany();
  const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
  const minWithdraw = parseFloat(settingsMap.min_withdrawal || '1');

  if (dbUser.referralBalance < minWithdraw) {
    const alertMsg = ctx.t('insufficient_ref_balance', {
      balance: dbUser.referralBalance.toFixed(2),
      min: minWithdraw
    });
    return ctx.answerCbQuery(alertMsg, { show_alert: true });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      balance: { increment: dbUser.referralBalance },
      referralBalance: 0
    }
  });

  const successMsg = ctx.t('withdrawal_success') + '\n' + ctx.t('withdrawn_to_balance', { amount: dbUser.referralBalance.toFixed(2) });
  return ctx.answerCbQuery(successMsg, { show_alert: true });
});

/**
 * Handle Buy Number - Show Country Selection
 */
bot.action('action_buy_number', async (ctx) => {
  await showCountrySelection(ctx);
});

async function showCountrySelection(ctx, isRefresh = false) {
  if (!isRefresh) {
    await ctx.answerCbQuery().catch(() => { });
  }

  try {
    // If refresh requested, force a fresh poll from API
    if (isRefresh) {
      await hunter.poll();
    }

    // Force a poll if hunter hasn't finished first poll yet
    if (Object.keys(hunter.getLiveDistribution()).length === 0) {
      await hunter.poll();
    }

    const liveDist = hunter.getLiveDistribution();
    const configs = await prisma.countryConfig.findMany();
    const configMap = configs.reduce((acc, c) => ({ ...acc, [c.countryCode]: c }), {});

    await ctx.editMessageText(ctx.t('buy_number_header'), {
      parse_mode: 'HTML',
      reply_markup: keyboards.buildCountryKeyboard(liveDist, ctx.state.lang, configMap).reply_markup
    });

    // Provide a small success notification on refresh
    if (isRefresh) {
      await ctx.answerCbQuery("🔄").catch(() => { });
    }
  } catch (error) {
    // If message not modified, it means stock is still the same - still technically a success for the user
    if (error.description && error.description.includes('message is not modified')) {
      return ctx.answerCbQuery("🔄").catch(() => { });
    }

    console.error("Error loading countries:", error);
    await ctx.editMessageText(`❌ System error while loading countries.`, {
      reply_markup: keyboards.backToMain(ctx.state.lang).reply_markup
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
    const msg = ctx.t('refresh_cooldown_msg', { seconds: remaining });
    return ctx.answerCbQuery(msg, { show_alert: true });
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
  const { user } = await getOrCreateUser(ctx);

  const countryConfig = await prisma.countryConfig.findUnique({
    where: { countryCode }
  });
  const currentPrice = countryConfig ? countryConfig.price : 0.15;

  // 0. Cooldown check (30 seconds)
  ctx.session = ctx.session || {};
  const now = Date.now();
  const lastPurchase = ctx.session.lastPurchase || 0;
  const elapsed = now - lastPurchase;
  const cooldownMs = 30000;

  if (elapsed < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
    const msg = ctx.t('purchase_cooldown', { seconds: remaining });
    return ctx.answerCbQuery(msg, { show_alert: true });
  }

  // 1. Check for sufficient balance before starting purchase
  if (user.balance < currentPrice) {
    const msg = ctx.t('insufficient_balance', {
      balance: user.balance.toFixed(2),
      required: currentPrice.toFixed(2)
    });
    return ctx.answerCbQuery(msg, { show_alert: true });
  }


  // Start the UX animation immediately (DON'T answer query yet)
  const percentages = ['10%', '30%', '70%', '100%'];
  for (let percent of percentages) {
    await ctx.editMessageText(ctx.t('purchase_process'), {
      reply_markup: {
        inline_keyboard: [[{ text: percent, callback_data: 'ignore' }]]
      }
    }).catch(() => { });
    await new Promise(r => setTimeout(r, 600));
  }

  // Now check stock
  try {
    const response = await durianApi.getMobile('0257', countryCode);

    if (response.code === 200 && response.data) {
      const phoneNumber = response.data;
      const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;

      // Finish query successfully
      await ctx.answerCbQuery().catch(() => { });

      await prisma.order.create({
        data: {
          userId: user.id,
          serviceId: '0257',
          countryId: countryCode,
          phoneNumber: phoneNumber,
          price: currentPrice,
          status: 'PENDING'
        }
      });

      // Start cooldown only on successful purchase
      ctx.session.lastPurchase = Date.now();

      const isAr = user.language === 'ar';
      const countryName = (isAr && countryInfo.name_ar) ? countryInfo.name_ar : countryInfo.name;

      const msg = `${ctx.t('purchase_success')}\n\n• <b>${ctx.t('number_label')}</b>: <code>+${cleanPhone}</code>\n• <b>${ctx.t('country_label')}</b>: ${countryInfo.flag} ${escapeHTML(countryName)}\n• <b>${ctx.t('code_label')}</b>: <code>XXXXX</code>\n\n<b>${ctx.t('request_code_btn')}</b>`;

      await ctx.editMessageText(msg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: ctx.t('request_code_btn'), callback_data: `check_code_${countryCode}_${phoneNumber}` }]
          ]
        }
      });

      startPolling(ctx, phoneNumber, countryCode);

    } else {
      // 1. Show the popup alert FIRST (this must be first to secure the callback answer)
      await ctx.answerCbQuery(ctx.t('no_numbers_error'), { show_alert: true }).catch(() => { });
      
      // 2. NOW restore the country selection menu
      await showCountrySelection(ctx, true);
    }
  } catch (error) {
    console.error("Purchase error:", error);
    // Restoration fallback: alert first!
    await ctx.answerCbQuery(ctx.t('no_numbers_error'), { show_alert: true }).catch(() => { });
    await showCountrySelection(ctx, true);
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

  // Force a fresh fetch of the user to get the latest balance
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from.id.toString() } });
  
  const order = await prisma.order.findFirst({
    where: { phoneNumber, status: 'PENDING' },
    orderBy: { id: 'desc' }
  });

  if (!user || !order) {
    return ctx.answerCbQuery().catch(() => { });
  }

  // Safety check: ensure balance is still sufficient
  if (user.balance < order.price || user.balance <= 0) {
    const msg = ctx.t('insufficient_balance', {
      balance: user.balance.toFixed(2),
      required: order.price.toFixed(2)
    });
    return ctx.answerCbQuery(msg, { show_alert: true });
  }

  await ctx.answerCbQuery().catch(() => { });

  const isAr = user.language === 'ar';
  const countryName = (isAr && countryInfo.name_ar) ? countryInfo.name_ar : countryInfo.name;

  // Random animation effect
  for (let i = 0; i < 3; i++) {
    const randomCode = Math.floor(10000 + Math.random() * 90000);
    const animMsg = `${ctx.t('purchase_success')}\n\n• <b>${ctx.t('number_label')}</b>: <code>+${cleanPhone}</code>\n• <b>${ctx.t('country_label')}</b>: ${countryInfo.flag} ${escapeHTML(countryName)}\n• <b>${ctx.t('code_label')}</b>: <code>${randomCode}</code>\n\n<b>${ctx.t('requesting_code_msg')}</b>`;
    try {
      await ctx.editMessageText(animMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: ctx.t('requesting_code_msg'), callback_data: `check_code_${countryCode}_${phoneNumber}` }]]
        }
      });
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (e) { }
  }

  try {
    const smsRes = await durianApi.getMsg('0257', phoneNumber);
    if (smsRes.code === 200 && smsRes.data && smsRes.data.length > 0) {
      await completeOrderAndCommission(phoneNumber, smsRes.data);
      const msg = `${ctx.t('purchase_success')}\n\n• <b>${ctx.t('number_label')}</b>: <code>+${cleanPhone}</code>\n• <b>${ctx.t('country_label')}</b>: ${countryInfo.flag} ${escapeHTML(countryName)}\n• <b>${ctx.t('code_label')}</b>:  <code>${escapeHTML(smsRes.data)}</code>\n\n✅ ${ctx.t('use_code_now_hint') || 'You can use the code now'}`;
      await ctx.editMessageText(msg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: ctx.t('buy_another_btn'), callback_data: 'action_buy_number' }],
            [{ text: ctx.t('activation_channel_btn'), url: 'https://t.me/your_activation_channel' }]
          ]
        }
      });
    } else {
      const msg = `${ctx.t('purchase_success_plain')}\n\n• <b>${ctx.t('number_label')}</b>: <code>+${cleanPhone}</code>\n• <b>${ctx.t('country_label')}</b>: ${countryInfo.flag} ${escapeHTML(countryName)}\n• <b>${ctx.t('code_label')}</b>:  <code>XXXXX</code>\n\n<b>${ctx.t('code_not_retrieved')}</b>`;
      await ctx.editMessageText(msg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: ctx.t('retry_btn'), callback_data: `check_code_${countryCode}_${phoneNumber}` }],
            [{ text: ctx.t('main_menu_btn'), callback_data: 'action_main_menu' }]
          ]
        }
      });
    }
  } catch (err) {
    const errorMsg = `${ctx.t('purchase_success_plain')}\n\n• <b>${ctx.t('number_label')}</b>: <code>+${cleanPhone}</code>\n• <b>${ctx.t('country_label')}</b>: ${countryInfo.flag} ${escapeHTML(countryName)}\n• <b>${ctx.t('code_label')}</b>:  <code>XXXXX</code>\n\n<b>${ctx.t('code_not_retrieved')}</b>`;
    await ctx.editMessageText(errorMsg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: ctx.t('retry_btn'), callback_data: `check_code_${countryCode}_${phoneNumber}` }],
          [{ text: ctx.t('main_menu_btn'), callback_data: 'action_main_menu' }]
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

    // 3. Deduct balance only on successful code arrival
    await prisma.user.update({
      where: { id: order.userId },
      data: { balance: { decrement: order.price } }
    });

    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    if (user && user.referredById) {
      // Get referral percent
      const settings = await prisma.globalSetting.findMany();
      const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
      const refPercent = parseFloat(settingsMap.referral_percent || '5');

      const commission = order.price * (refPercent / 100);
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
        const user = await prisma.user.findUnique({ where: { id: order.userId } });
        const isAr = user && user.language === 'ar';
        const countryName = (isAr && countryInfo.name_ar) ? countryInfo.name_ar : countryInfo.name;

        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.callbackQuery.message.message_id,
          null,
          `${ctx.t('purchase_success')}\n\n• <b>${ctx.t('number_label')}</b>: <code>+${cleanPhone}</code>\n• <b>${ctx.t('country_label')}</b>: ${countryInfo.flag} ${escapeHTML(countryName)}\n• <b>${ctx.t('code_label')}</b>:  <code>${escapeHTML(smsRes.data)}</code>\n\n✅ ${ctx.t('use_code_now_hint') || 'You can use the code now'}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: ctx.t('buy_another_btn'), callback_data: 'action_buy_number' }],
                [{ text: ctx.t('activation_channel_btn'), url: 'https://t.me/your_activation_channel' }]
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
        const user = await prisma.user.findUnique({ where: { id: order.userId } });
        const isAr = user && user.language === 'ar';
        const countryName = (isAr && countryInfo.name_ar) ? countryInfo.name_ar : countryInfo.name;

        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.callbackQuery.message.message_id,
          null,
          `${ctx.t('purchase_success_plain')}\n\n• <b>${ctx.t('number_label')}</b>: <code>+${cleanPhone}</code>\n• <b>${ctx.t('country_label')}</b>: ${countryInfo.flag} ${escapeHTML(countryName)}\n• <b>${ctx.t('code_label')}</b>:  <code>XXXXX</code>\n\n<b>${ctx.t('code_not_retrieved')}</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: ctx.t('retry_btn'), callback_data: `check_code_${countryCode}_${phoneNumber}` }],
                [{ text: ctx.t('main_menu_btn'), callback_data: 'action_main_menu' }]
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
bot.action(/action_main_menu|action_cancel/, async (ctx) => {
  try {
    const msg = ctx.t('welcome_bot');
    await ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      reply_markup: keyboards.mainMenu(ctx.state.lang).reply_markup
    }).catch(err => {
      if (!err.message.includes('message is not modified')) {
        console.error('Edit error in main menu:', err.message);
      }
    });
    await ctx.answerCbQuery().catch(() => { });
  } catch (err) {
    console.error('Main menu handler error:', err);
  }
});



/**
 * Catch all text for simple testing (Removed to ignore unknown text)
 */
// bot.on('text', async (ctx) => {
//   await ctx.reply(ctx.t('welcome', { name: escapeHTML(ctx.from.first_name || 'User') }), { parse_mode: 'HTML' });
// });

/**
 * Handle Settings Placeholder
 */
bot.action('action_settings', async (ctx) => {
  await ctx.answerCbQuery('Coming soon... ⚙️', { show_alert: true });
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
  console.log('[BOT] OzZoO SMS Bot started successfully.');
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
    const bannedUsers = await prisma.user.count({ where: { isBanned: true } });
    const successfulOrders = await prisma.order.count({ where: { status: 'COMPLETED' } });
    const totalOrdersCount = await prisma.order.count();
    const cancelledOrdersCount = await prisma.order.count({ where: { status: 'CANCELLED' } });

    const revenueRes = await prisma.order.aggregate({
      _sum: { price: true },
      where: { status: 'COMPLETED' }
    });

    const totalDepositsCount = await prisma.deposit.count();
    const totalDepositsAmountRes = await prisma.deposit.aggregate({
      _sum: { amount: true },
      where: { status: 'APPROVED' }
    });

    const activeOrdersCount = await prisma.order.count({ where: { status: 'PENDING' } });
    const pendingDeposits = await prisma.deposit.count({ where: { status: 'PENDING' } });

    res.json({
      totalUsers,
      bannedUsers,
      successfulOrders,
      totalOrdersCount,
      cancelledOrdersCount,
      activeOrdersCount,
      totalRevenue: revenueRes._sum.price || 0,
      totalDepositsCount,
      totalDepositsAmount: totalDepositsAmountRes._sum.amount || 0,
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
      take: 200,
      include: {
        _count: { select: { orders: true } },
        orders: { where: { status: 'COMPLETED' }, select: { price: true } }
      }
    });

    // Calculate spent for each user
    const formattedUsers = users.map(u => ({
      ...u,
      firstName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown',
      spent: u.orders.reduce((acc, curr) => acc + curr.price, 0),
      ordersMade: u._count.orders,
      orders: undefined, // Clear from response
      _count: undefined
    }));

    // SILENT BACKGROUND SYNC: Trigger sync for the top 5 most stale users in this list
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const staleUsers = formattedUsers
      .filter(u => !u.updatedAt || u.updatedAt < fiveMinutesAgo)
      .slice(0, 5);

    if (staleUsers.length > 0) {
      syncSpecificUsers(staleUsers.map(u => u.telegramId)).catch(err => console.error('Silent sync error:', err));
    }

    res.json(formattedUsers || []);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Helper for silent sync
async function syncSpecificUsers(telegramIds) {
  for (const tid of telegramIds) {
    try {
      const chat = await bot.telegram.getChat(tid).catch(() => null);
      if (!chat) continue;
      const newFirstName = chat.first_name || chat.title || '';
      const newLastName = chat.last_name || '';
      const newUsername = chat.username;
      await prisma.user.update({
        where: { telegramId: tid },
        data: { firstName: newFirstName, lastName: newLastName, username: newUsername, updatedAt: new Date() }
      });
      await new Promise(r => setTimeout(r, 500)); // Respect rate limits
    } catch (e) { }
  }
}

app.post('/api/admin/user-toggle-ban', isAdminMiddleware, async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: !user.isBanned }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to toggle ban status' });
  }
});

app.get('/api/admin/orders', isAdminMiddleware, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { firstName: true, lastName: true, username: true, telegramId: true } } }
    });

    const formattedOrders = orders.map(o => ({
      ...o,
      user: { ...o.user, firstName: `${o.user?.firstName || ''} ${o.user?.lastName || ''}`.trim() || 'Unknown' }
    }));

    res.json(formattedOrders || []);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

app.get('/api/admin/deposits', isAdminMiddleware, async (req, res) => {
  try {
    const deposits = await prisma.deposit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { firstName: true, lastName: true, username: true, telegramId: true } } }
    });

    const formattedDeposits = deposits.map(d => ({
      ...d,
      user: { ...d.user, firstName: `${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim() || 'Unknown' }
    }));

    res.json(formattedDeposits || []);
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

// --- COUNTRY MANAGEMENT APIs ---

app.get('/api/admin/countries', isAdminMiddleware, async (req, res) => {
  try {
    const liveDist = hunter.getLiveDistribution();
    const configs = await prisma.countryConfig.findMany();
    const configMap = configs.reduce((acc, c) => ({ ...acc, [c.countryCode]: c }), {});
    const allCountryMap = durianApi.getAllCountries();

    const countries = [];
    Object.keys(allCountryMap).forEach(code => {
      const info = allCountryMap[code];
      const config = configMap[code] || { isEnabled: true, price: 0.15 };

      countries.push({
        code,
        name: info.name,
        flag: info.flag,
        stock: liveDist[code] || 0,
        isEnabled: config.isEnabled,
        price: config.price
      });
    });

    // Sort alphabetically by name
    countries.sort((a, b) => a.name.localeCompare(b.name));
    res.json(countries);
  } catch (err) {
    console.error('Fetch countries error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

app.post('/api/admin/countries/update', isAdminMiddleware, async (req, res) => {
  const { code, isEnabled, price } = req.body;
  try {
    const updateData = {};
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ msg: 'Invalid price' });
      }
      updateData.price = parsedPrice;
    }

    await prisma.countryConfig.upsert({
      where: { countryCode: code },
      update: updateData,
      create: {
        countryCode: code,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        price: price !== undefined ? parseFloat(price) : 0.15
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Update country error:', err);
    res.status(500).json({ msg: 'Failed to update country' });
  }
});

// --- SETTINGS APIs ---

app.get('/api/admin/settings', isAdminMiddleware, async (req, res) => {
  try {
    const settings = await prisma.globalSetting.findMany();
    // Convert to easy-to-use object
    const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

    // Set defaults if missing
    if (!settingsMap.bot_name) settingsMap.bot_name = 'OzZoO SMS';
    if (!settingsMap.maintenance_mode) settingsMap.maintenance_mode = 'false';

    res.json(settingsMap);
  } catch (err) {
    console.error('Fetch settings error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

app.post('/api/admin/settings/update', isAdminMiddleware, async (req, res) => {
  const { key, value } = req.body;
  try {
    await prisma.globalSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Update setting error:', err);
    res.status(500).json({ msg: 'Failed to update setting' });
  }
});

// --- MANDATORY CHANNELS APIs ---

app.get('/api/admin/channels', isAdminMiddleware, async (req, res) => {
  try {
    const channels = await prisma.mandatoryChannel.findMany();
    res.json(channels);
  } catch (err) {
    console.error('Fetch channels error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

app.post('/api/admin/channels/add', isAdminMiddleware, async (req, res) => {
  const { username, link } = req.body;
  try {
    // Duplicate check
    const existing = await prisma.mandatoryChannel.findFirst({
      where: { username }
    });
    if (existing) {
      return res.status(400).json({ msg: 'Channel already exists' });
    }

    const channel = await prisma.mandatoryChannel.create({
      data: { username, link }
    });
    res.json(channel);
  } catch (err) {
    console.error('Add channel error:', err);
    res.status(500).json({ msg: 'Failed to add channel' });
  }
});

app.post('/api/admin/channels/delete', isAdminMiddleware, async (req, res) => {
  const { id } = req.body;
  try {
    await prisma.mandatoryChannel.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete channel error:', err);
    res.status(500).json({ msg: 'Failed to delete channel' });
  }
});

app.post('/api/admin/countries/bulk-toggle', isAdminMiddleware, async (req, res) => {
  const { isEnabled } = req.body;
  try {
    if (isEnabled) {
      // Enable All: Just set all existing to true.
      await prisma.countryConfig.updateMany({
        data: { isEnabled: true }
      });
    } else {
      // Disable All: Must ensure all valid countries have a 'false' record
      const allCountryMap = durianApi.getAllCountries();
      const codes = Object.keys(allCountryMap);

      // Using a batch of upserts for safety and consistency
      await Promise.all(codes.map(code =>
        prisma.countryConfig.upsert({
          where: { countryCode: code },
          update: { isEnabled: false },
          create: { countryCode: code, isEnabled: false, price: 0.15 }
        })
      ));
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Bulk update error:', err);
    res.status(500).json({ msg: 'Bulk update failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[SERVER] Admin Dashboard running on port ${PORT}`);
});

// --- BACKGROUND SYNC FOR USER IDENTITIES ---
async function syncUserIdentities() {
  console.log('[SYNC] Starting background user identity synchronization...');
  try {
    // Fetch 20 users who haven't been updated in over 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const usersToSync = await prisma.user.findMany({
      where: {
        updatedAt: { lt: yesterday }
      },
      orderBy: { updatedAt: 'asc' },
      take: 20
    });

    if (usersToSync.length === 0) {
      console.log('[SYNC] All users are already up to date.');
      return;
    }

    for (const user of usersToSync) {
      try {
        console.log(`[SYNC] Refreshing info for User ${user.telegramId}...`);
        const chat = await bot.telegram.getChat(user.telegramId);

        const newFirstName = chat.first_name || chat.title || user.firstName;
        const newUsername = chat.username || user.username;

        if (user.firstName !== newFirstName || user.username !== newUsername) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              firstName: newFirstName,
              username: newUsername
            }
          });
          console.log(`[SYNC] Updated User ${user.telegramId}: ${newFirstName} (@${newUsername})`);
        } else {
          // Still update updatedAt to mark as checked
          await prisma.user.update({
            where: { id: user.id },
            data: { updatedAt: new Date() }
          });
        }

        // Wait 2 seconds between requests to respect Telegram rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        if (err.description && err.description.includes('chat not found')) {
          // User might have blocked the bot, skip and mark as checked
          await prisma.user.update({
            where: { id: user.id },
            data: { updatedAt: new Date() }
          });
        }
        console.error(`[SYNC ERROR] Failed to sync user ${user.telegramId}:`, err.message);
      }
    }
    console.log('[SYNC] Background synchronization complete.');
  } catch (err) {
    console.error('[SYNC CRITICAL ERROR]', err);
  }
}

/**
 * STALE ORDER CLEANUP
 * Automatically cancels PENDING orders that have exceeded the timeout (e.g., 15 minutes)
 */
async function cleanupStaleOrders() {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const staleOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: fifteenMinutesAgo }
      }
    });

    if (staleOrders.length > 0) {
      console.log(`[CLEANUP] Found ${staleOrders.length} stale pending orders. Cancelling...`);

      await prisma.order.updateMany({
        where: {
          id: { in: staleOrders.map(o => o.id) }
        },
        data: { status: 'CANCELLED' }
      });

      console.log(`[CLEANUP] Successfully cancelled stale orders.`);
    }
  } catch (err) {
    console.error('[CLEANUP ERROR]', err);
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupStaleOrders, 30 * 60 * 1000);
// Initial cleanup run after 5 seconds of server start
setTimeout(cleanupStaleOrders, 5000);

// Run sync every 30 minutes
setInterval(syncUserIdentities, 30 * 60 * 1000);
// Initial run after 1 minute of server start
setTimeout(syncUserIdentities, 60 * 1000);

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

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
const cron = require('node-cron');
const BinancePayService = require('./services/binance');
const checker = require('./services/checker');

dotenv.config();

// Initialize the Telegram Checker Service
checker.init();

// Start the Live Hunting Monitor (5s interval)
// hunter.start(5000); // Moved to end of file to ensure bot is ready

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Track last notification alert sent per country to avoid spamming users
const lastAlertSent = {};

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

/**
 * Mask sensitive strings with dots (keeping first/last 3-4 chars)
 */
const maskSensitive = (str, visibleLen = 3) => {
  if (!str) return '••••••';
  const s = String(str);
  if (s.length <= visibleLen * 2) return s;
  return s.substring(0, visibleLen) + '••••••••';
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
 * Admin Commands for Checker Service
 */
bot.command('set_checker_id', async (ctx) => {
  const adminIds = (process.env.ADMIN_IDS || process.env.ADMIN_TELEGRAM_ID || "").split(',').map(id => id.trim());
  if (!adminIds.includes(ctx.from.id.toString())) return;

  const value = ctx.message.text.split(' ')[1];
  if (!value) return ctx.reply('Usage: /set_checker_id <id>');

  await prisma.globalSetting.upsert({
    where: { key: 'checker_api_id' },
    update: { value },
    create: { key: 'checker_api_id', value }
  });
  ctx.reply('✅ API ID saved to Database.');
});

bot.command('set_checker_hash', async (ctx) => {
  const adminIds = (process.env.ADMIN_IDS || process.env.ADMIN_TELEGRAM_ID || "").split(',').map(id => id.trim());
  if (!adminIds.includes(ctx.from.id.toString())) return;

  const value = ctx.message.text.split(' ')[1];
  if (!value) return ctx.reply('Usage: /set_checker_hash <hash>');

  await prisma.globalSetting.upsert({
    where: { key: 'checker_api_hash' },
    update: { value },
    create: { key: 'checker_api_hash', value }
  });
  ctx.reply('✅ API HASH saved to Database.');
});

bot.command('set_checker_session', async (ctx) => {
  const adminIds = (process.env.ADMIN_IDS || process.env.ADMIN_TELEGRAM_ID || "").split(',').map(id => id.trim());
  if (!adminIds.includes(ctx.from.id.toString())) return;

  const value = ctx.message.text.split(' ')[1];
  if (!value) return ctx.reply('Usage: /set_checker_session <session>');

  await prisma.globalSetting.upsert({
    where: { key: 'checker_session' },
    update: { value },
    create: { key: 'checker_session', value }
  });
  ctx.reply('✅ STRING_SESSION saved to Database.');
});

bot.command('checker_restart', async (ctx) => {
  const adminIds = (process.env.ADMIN_IDS || process.env.ADMIN_TELEGRAM_ID || "").split(',').map(id => id.trim());
  if (!adminIds.includes(ctx.from.id.toString())) return;

  await ctx.reply('⏳ Restarting Checker Service...');
  const result = await checker.init();
  if (result.success) {
    ctx.reply(`✅ <b>Checker Service</b>: ${result.message}`, { parse_mode: 'HTML' });
  } else {
    ctx.reply(`❌ <b>Checker Service Failed</b>:\n<code>${result.message}</code>`, { parse_mode: 'HTML' });
  }
});

/**
 * Provider Account Management
 */
bot.command('add_acc', async (ctx) => {
  const adminIds = (process.env.ADMIN_IDS || process.env.ADMIN_TELEGRAM_ID || "").split(',').map(id => id.trim());
  if (!adminIds.includes(ctx.from.id.toString())) return;

  const args = ctx.message.text.split(' ');
  if (args.length < 3) return ctx.reply('Usage: /add_acc <username> <apiKey>');

  const username = args[1];
  const apiKey = args[2];

  await prisma.providerAccount.create({
    data: { username, apiKey }
  });
  ctx.reply(`✅ Account for <code>${username}</code> added to pool.`, { parse_mode: 'HTML' });
});

bot.command('list_accs', async (ctx) => {
  const adminIds = (process.env.ADMIN_IDS || process.env.ADMIN_TELEGRAM_ID || "").split(',').map(id => id.trim());
  if (!adminIds.includes(ctx.from.id.toString())) return;

  const accs = await prisma.providerAccount.findMany();
  if (accs.length === 0) return ctx.reply('No extra provider accounts found in DB.');

  let msg = '📋 <b>Provider Accounts:</b>\n\n';
  accs.forEach(a => {
    msg += `ID: <code>${a.id}</code> | User: <code>${a.username}</code> | Active: ${a.isActive ? '✅' : '❌'}\n`;
  });
  ctx.reply(msg, { parse_mode: 'HTML' });
});

bot.command('del_acc', async (ctx) => {
  const adminIds = (process.env.ADMIN_IDS || process.env.ADMIN_TELEGRAM_ID || "").split(',').map(id => id.trim());
  if (!adminIds.includes(ctx.from.id.toString())) return;

  const id = parseInt(ctx.message.text.split(' ')[1]);
  if (isNaN(id)) return ctx.reply('Usage: /del_acc <id>');

  await prisma.providerAccount.delete({ where: { id } });
  ctx.reply('✅ Account deleted.');
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
  const totalPurchases = (totalPurchasesResult._sum.price || 0).toFixed(2);
  const availableBalance = user.balance.toFixed(2);

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

  const totalSpent = (totalPurchasesResult._sum.price || 0).toFixed(2);
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

bot.action('deposit_binance', async (ctx) => {
  try {
    const settings = await prisma.globalSetting.findMany();
    const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
    const binanceId = settingsMap.binance_pay_id || '1050123485';
    const supportLink = settingsMap.activation_channel_link || 'https://t.me/Binance_Support'; // Placeholder

    await ctx.editMessageText(ctx.t('binance_deposit_instructions', { binanceId }), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: ctx.t('binance_how_btn'), url: supportLink }],
          [Markup.button.callback(ctx.t('cancel_btn'), 'action_deposit')]
        ]
      }
    });

    ctx.session.awaitingBinanceTxid = true;
  } catch (err) {
    console.error('[BINANCE ACTION ERROR]', err);
    await ctx.answerCbQuery('Error loading settings.');
  }
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
 * Handle Country Alert Settings
 */
bot.action(/^(action_settings|alert_page_(\d+))$/, async (ctx) => {
  try {
    const page = ctx.match[2] ? parseInt(ctx.match[2]) : 0;
    const { user } = await getOrCreateUser(ctx);

    // Get all active subscriptions for this user
    const subs = await prisma.notificationSubscription.findMany({
      where: { userId: user.id },
      select: { countryCode: true }
    });
    const subCodes = subs.map(s => s.countryCode);

    // Get country configs for prices
    const configs = await prisma.countryConfig.findMany();
    const configMap = configs.reduce((acc, c) => ({ ...acc, [c.countryCode]: c }), {});

    // Filter subscriptions for display based on current affordability (visual only in settings)
    const validSubs = [];
    for (const subCode of subCodes) {
      const cfg = configMap[subCode];
      const price = cfg ? cfg.price : 0.25;
      if (user.balance >= price) {
        validSubs.push(subCode);
      }
    }

    const msg = ctx.t('alert_settings_header') + ctx.t('alert_settings_note');

    await ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      reply_markup: keyboards.buildAlertKeyboard(user.balance, validSubs, ctx.state.lang, page, configMap).reply_markup
    });

    await ctx.answerCbQuery().catch(() => { });
  } catch (err) {
    console.error('[ALERT SETTINGS ERROR]', err);
    await ctx.answerCbQuery('❌ Error opening alert settings', { show_alert: true });
  }
});

/**
 * Toggle Alert Subscription
 */
bot.action(/^toggle_alert_(.+)_(.+)$/, async (ctx) => {
  const countryCode = ctx.match[1];
  const page = parseInt(ctx.match[2]);

  try {
    const { user } = await getOrCreateUser(ctx);

    // Check if subscription already exists
    const existing = await prisma.notificationSubscription.findUnique({
      where: { userId_countryCode: { userId: user.id, countryCode } }
    });

    if (existing) {
      // Toggle OFF: Remove subscription
      await prisma.notificationSubscription.delete({
        where: { id: existing.id }
      });
      const countryInfo = durianApi.getCountryInfo(countryCode, ctx.state.lang);
      const msg = ctx.t('alert_disabled', { country: countryInfo.localizedName });
      await ctx.answerCbQuery(msg).catch(() => { });
    } else {
      // Toggle ON: Check balance first
      const countryConfig = await prisma.countryConfig.findUnique({ where: { countryCode } });
      const price = countryConfig ? countryConfig.price : 0.25;

      if (user.balance < price) {
        return ctx.answerCbQuery().catch(() => { });
      }

      await prisma.notificationSubscription.create({
        data: { userId: user.id, countryCode }
      });
      const countryInfo = durianApi.getCountryInfo(countryCode, ctx.state.lang);
      const msg = ctx.t('alert_enabled', { country: countryInfo.localizedName });
      await ctx.answerCbQuery(msg).catch(() => { });
    }

    // Refresh the current page
    const subs = await prisma.notificationSubscription.findMany({
      where: { userId: user.id },
      select: { countryCode: true }
    });
    const subCodes = subs.map(s => s.countryCode);
    const configs = await prisma.countryConfig.findMany();
    const configMap = configs.reduce((acc, c) => ({ ...acc, [c.countryCode]: c }), {});

    const msg = ctx.t('alert_settings_header') + ctx.t('alert_settings_note');
    await ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      reply_markup: keyboards.buildAlertKeyboard(user.balance, subCodes, ctx.state.lang, page, configMap).reply_markup
    });

  } catch (err) {
    console.error('[TOGGLE ALERT ERROR]', err);
    await ctx.answerCbQuery('❌ Error toggling alert', { show_alert: true });
  }
});

/**
 * Handle Auto-Reserve Settings
 */
bot.action(/^(action_auto_reserve|auto_reserve_page_(\d+))$/, async (ctx) => {
  try {
    const page = ctx.match[2] ? parseInt(ctx.match[2]) : 0;
    const { user } = await getOrCreateUser(ctx);

    // Get all active auto-reserve subscriptions for this user
    const subs = await prisma.autoReserveSubscription.findMany({
      where: { userId: user.id },
      select: { countryCode: true }
    });
    const subCodes = subs.map(s => s.countryCode);

    // Get country configs for prices
    const configs = await prisma.countryConfig.findMany();
    const configMap = configs.reduce((acc, c) => ({ ...acc, [c.countryCode]: c }), {});

    const msg = ctx.t('auto_reserve_settings_header');

    await ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      reply_markup: keyboards.buildAutoReserveKeyboard(ctx.state.lang, subCodes, configMap, page, user.balance).reply_markup
    });

    await ctx.answerCbQuery().catch(() => { });
  } catch (err) {
    console.error('[AUTO RESERVE SETTINGS ERROR]', err);
    await ctx.answerCbQuery('❌ Error opening auto-reserve settings', { show_alert: true });
  }
});

/**
 * Toggle Auto-Reserve Subscription
 */
bot.action(/^toggle_auto_reserve_(.+)_(.+)$/, async (ctx) => {
  const countryCode = ctx.match[1];
  const page = parseInt(ctx.match[2]);

  try {
    const { user } = await getOrCreateUser(ctx);

    // Check if subscription already exists
    const existing = await prisma.autoReserveSubscription.findUnique({
      where: { userId_countryCode: { userId: user.id, countryCode } }
    });

    if (existing) {
      // Toggle OFF: Remove subscription
      await prisma.autoReserveSubscription.delete({
        where: { id: existing.id }
      });
      const countryInfo = durianApi.getCountryInfo(countryCode, ctx.state.lang);
      const msg = ctx.t('auto_reserve_disabled', { country: countryInfo.localizedName });
      await ctx.answerCbQuery(msg).catch(() => { });
    } else {
      // Toggle ON: Check balance first
      const countryConfig = await prisma.countryConfig.findUnique({ where: { countryCode } });
      const price = countryConfig ? countryConfig.price : 0.15;

      if (user.balance < price) {
        const msg = ctx.t('insufficient_balance', { balance: user.balance.toFixed(2), required: price.toFixed(2) });
        return ctx.answerCbQuery(msg, { show_alert: true });
      }

      await prisma.autoReserveSubscription.create({
        data: { userId: user.id, countryCode }
      });
      const countryInfo = durianApi.getCountryInfo(countryCode, ctx.state.lang);
      const msg = ctx.t('auto_reserve_enabled', { country: countryInfo.localizedName });
      await ctx.answerCbQuery(msg).catch(() => { });

      // Immediate Purchase Attempt if stock exists right now
      const liveData = hunter.getLiveDistribution();
      if (liveData[countryCode] > 0) {
        try {
          const buyRes = await getCleanMobile(countryCode);
          if (buyRes && buyRes.phoneNumber) {
            const phoneNumber = buyRes.phoneNumber;
            const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;

            const order = await prisma.order.create({
              data: {
                userId: user.id,
                serviceId: '0257',
                countryId: countryCode,
                phoneNumber: phoneNumber,
                price: price,
                status: 'PENDING',
                providerAccountId: buyRes.account?.id || null
              }
            });

            const lang = user.language || 'en';
            const countryName = (lang === 'ar' && countryInfo.name_ar) ? countryInfo.name_ar : countryInfo.name;
            const successMsg = `⚡ <b>${ctx.t('purchase_success')} (Auto-Reserve)</b>\n\n• <b>${ctx.t('number_label')}</b>: <code>+${cleanPhone}</code>\n• <b>${ctx.t('country_label')}</b>: ${countryInfo.flag} ${escapeHTML(countryName)}\n• <b>${ctx.t('code_label')}</b>: <code>XXXXX</code>\n\n<b>${ctx.t('request_code_btn')}</b>`;

            const sentMsg = await ctx.reply(successMsg, {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: ctx.t('request_code_btn'), callback_data: `check_code_${countryCode}_${phoneNumber}` }]]
              }
            });

            startAutoPolling(user.telegramId, sentMsg.message_id, phoneNumber, countryCode, lang, buyRes.account);
          }
        } catch (e) {
          console.error('[AUTO-RESERVE IMMEDIATE FAIL]', e.message);
        }
      }
    }

    // Refresh the current page
    const subs = await prisma.autoReserveSubscription.findMany({
      where: { userId: user.id },
      select: { countryCode: true }
    });
    const subCodes = subs.map(s => s.countryCode);
    const configs = await prisma.countryConfig.findMany();
    const configMap = configs.reduce((acc, c) => ({ ...acc, [c.countryCode]: c }), {});

    const msg = ctx.t('auto_reserve_settings_header');
    await ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      reply_markup: keyboards.buildAutoReserveKeyboard(ctx.state.lang, subCodes, configMap, page, user.balance).reply_markup
    });

  } catch (err) {
    console.error('[TOGGLE AUTO RESERVE ERROR]', err);
    await ctx.answerCbQuery('❌ Error toggling auto-reserve', { show_alert: true });
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
bot.action(/^select_country_([^_]+)(?:_(.+))?$/, async (ctx) => {
  const countryCode = ctx.match[1];
  const source = ctx.match[2];
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
    const response = await getCleanMobile(countryCode);

    if (response && response.phoneNumber) {
      const phoneNumber = response.phoneNumber;
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
          status: 'PENDING',
          providerAccountId: response.account?.id || null
        }
      });

      // Start cooldown only on successful purchase
      ctx.session.lastPurchase = Date.now();

      const lang = user.language || 'en';
      let countryName = countryInfo.name;
      if (lang === 'ar' && countryInfo.name_ar) countryName = countryInfo.name_ar;
      else if (lang === 'fa' && countryInfo.name_fa) countryName = countryInfo.name_fa;
      else if (lang === 'bn' && countryInfo.name_bn) countryName = countryInfo.name_bn;

      const msg = `<b>${ctx.t('purchase_success')}</b>\n\n• <b>${ctx.t('number_label')}</b>: <code>+${cleanPhone}</code>\n• <b>${ctx.t('country_label')}</b>: ${countryInfo.flag} ${escapeHTML(countryName)}\n• <b>${ctx.t('code_label')}</b>: <code>XXXXX</code>\n\n<b>${ctx.t('request_code_btn')}</b>`;

      await ctx.editMessageText(msg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: ctx.t('request_code_btn'), callback_data: `check_code_${countryCode}_${phoneNumber}` }]
          ]
        }
      });

      startPolling(ctx, phoneNumber, countryCode, response.account);

    } else {
      // 1. Show the popup alert FIRST
      await ctx.answerCbQuery(ctx.t('no_numbers_error'), { show_alert: true }).catch(() => { });

      // Mark the country as out of stock to make it disappear
      // We pass the current stock so hunter knows this specific amount is stuck/bugged
      const liveDist = hunter.getLiveDistribution();
      const currentStock = liveDist[countryCode] || 0;
      hunter.markOutOfStock(countryCode, currentStock);

      // 2. NOW restore appropriately
      if (source !== 'alert') {
        await showCountrySelection(ctx, false);
      } else {
        const info = durianApi.getCountryInfo(countryCode, ctx.state.lang);
        const originalAlertMsg = ctx.t('alert_notification', {
          flag: info.flag,
          name: info.localizedName,
          price: currentPrice.toFixed(2)
        });
        await ctx.editMessageText(originalAlertMsg, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[Markup.button.callback(ctx.t('alert_buy_btn'), `select_country_${countryCode}_alert`)]]
          }
        }).catch(() => { });
      }
    }
  } catch (error) {
    console.error("Purchase error:", error);
    await ctx.answerCbQuery(ctx.t('no_numbers_error'), { show_alert: true }).catch(() => { });

    const liveDist = hunter.getLiveDistribution();
    const currentStock = liveDist[countryCode] || 0;
    hunter.markOutOfStock(countryCode, currentStock);

    if (source !== 'alert') {
      await showCountrySelection(ctx, false);
    } else {
      const info = durianApi.getCountryInfo(countryCode, ctx.state.lang);
      const originalAlertMsg = ctx.t('alert_notification', {
        flag: info.flag,
        name: info.localizedName,
        price: currentPrice.toFixed(2)
      });
      await ctx.editMessageText(originalAlertMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[Markup.button.callback(ctx.t('alert_buy_btn'), `select_country_${countryCode}_alert`)]]
        }
      }).catch(() => { });
    }
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
      const msg = `${ctx.t('purchase_success')}\n\n• ${ctx.t('number_label')}: <b><code>+${cleanPhone}</code></b>\n• ${ctx.t('country_label')}: <b>${countryInfo.flag} ${escapeHTML(countryName)}</b>\n• ${ctx.t('code_label')}: <b><code>${escapeHTML(smsRes.data)}</code></b>\n\n✅ ${ctx.t('use_code_now_hint') || 'You can use the code now'}`;
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

/**
 * Helper to get a CLEAN (Not Banned, Not Registered) Mobile number
 * Automatically retries up to maxRetries times
 */
async function getCleanMobile(countryCode, maxRetries = 3) {
  let lastRes = null;
  
  // Fetch all active provider accounts
  let accounts = await prisma.providerAccount.findMany({ where: { isActive: true } });
  
  // If no DB accounts, use the one from .env (represented as null in our API)
  if (accounts.length === 0) {
    accounts = [null]; 
  }

  for (let i = 0; i < maxRetries; i++) {
    // Pick an account (round robin by attempt index)
    const acc = accounts[i % accounts.length];
    
    const response = await durianApi.getMobile('0257', countryCode, acc);
    if (response.code !== 200 || !response.data) {
      lastRes = response;
      // If this account failed, we might want to try the next one immediately? 
      // But we'll just let the loop continue to the next attempt/account.
      continue; 
    }

    const phoneNumber = response.data;

    // If checker is not ready, just return the number (fallback)
    if (!checker.isReady) {
      return { phoneNumber, account: acc };
    }

    console.log(`[Checker] Verifying ${phoneNumber} via ${acc ? acc.username : 'Default'} (Attempt ${i + 1}/${maxRetries})...`);
    const check = await checker.checkNumber(phoneNumber);

    if (check.status === 'CLEAN') {
      console.log(`[Checker] SUCCESS: ${phoneNumber} is CLEAN`);
      return { phoneNumber, account: acc };
    } else {
      console.warn(`[Checker] REJECTED: ${phoneNumber} is ${check.status}. Blacklisting on provider and retrying...`);
      // Blacklist it on the specific account that gave it to us
      await durianApi.blacklistNumber('0257', phoneNumber, acc);
      lastRes = { code: 403, msg: `Rejected: ${check.status}` };

      // Wait a bit before next attempt
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return lastRes;
}

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

    // --- ACTIVATION CHANNEL BROADCAST ---
    try {
      const settings = await prisma.globalSetting.findMany();
      const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

      const channelUsername = settingsMap.activation_channel;
      if (channelUsername) {
        // Increment global counter
        const currentCountStr = settingsMap.global_activation_count || '0';
        const nextCount = parseInt(currentCountStr) + 1;
        await prisma.globalSetting.upsert({
          where: { key: 'global_activation_count' },
          update: { value: String(nextCount) },
          create: { key: 'global_activation_count', value: String(nextCount) }
        });

        const countryInfo = durianApi.getCountryInfo(order.countryId);
        const user = await prisma.user.findUnique({ where: { id: order.userId } });
        const botInfo = await bot.telegram.getMe();

        // Date formatting: 2026-04-17 | 14:25:35
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];

        const maskedPhone = '+' + maskSensitive(order.phoneNumber.replace('+', ''), 4);
        const maskedUserId = maskSensitive(user.telegramId, 3);

        const broadcastMsg =
          `✅ <b>Purchase report</b> <b>#Successful</b> ( ${countryInfo.flag} <b>#${countryInfo.name.replace(/\s+/g, '')}</b> )
⏰ <b>At time:</b> <b>${dateStr}</b> | <b>${timeStr}</b>
🔔 <b>Activation code:</b> <code>${smsCode}</code>
🛍️ <b>Purchase details</b> 👇🏻
🤖 <a href="https://t.me/${botInfo.username}">@${botInfo.username}</a>`;

        const channelLink = settingsMap.activation_channel_link || `https://t.me/${botInfo.username}`;

        await bot.telegram.sendMessage(channelUsername, broadcastMsg, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌍 Country', callback_data: 'none' }, { text: `${countryInfo.name} ${countryInfo.flag}`, callback_data: 'none' }],
              [{ text: '📵 Number', callback_data: 'none' }, { text: maskedPhone, callback_data: 'none' }],
              [{ text: '🏷️ Price', callback_data: 'none' }, { text: `${order.price}$`, callback_data: 'none' }],
              [{ text: '🆔 User ID', callback_data: 'none' }, { text: maskedUserId, callback_data: 'none' }],
              [{ text: '🐊 Total', callback_data: 'none' }, { text: String(nextCount), callback_data: 'none' }],
              [{ text: '🛒 Buy Now', url: channelLink }]
            ]
          }
        });
      }
    } catch (err) {
      console.error('[BROADCAST ERROR]', err.message);
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
async function startPolling(ctx, phoneNumber, countryCode, account = null) {
  let attempts = 0;
  const maxAttempts = 20; // 5 minutes at 15s per check

  const pollInterval = setInterval(async () => {
    attempts++;
    try {
      const smsRes = await durianApi.getMsg('0257', phoneNumber, account);
      if (smsRes.code === 200 && smsRes.data && smsRes.data.length > 0) {
        clearInterval(pollInterval);
        await completeOrderAndCommission(phoneNumber, smsRes.data);

        const countryInfo = durianApi.getCountryInfo(countryCode);
        const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;

        const lang = ctx.state.lang || 'en';
        const countryName = (lang === 'ar' && countryInfo.name_ar) ? countryInfo.name_ar : countryInfo.name;

        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.callbackQuery.message.message_id,
          null,
          `${ctx.t('purchase_success')}\n\n• ${ctx.t('number_label')}: <b><code>+${cleanPhone}</code></b>\n• ${ctx.t('country_label')}: <b>${countryInfo.flag} ${escapeHTML(countryName)}</b>\n• ${ctx.t('code_label')}: <b><code>${escapeHTML(smsRes.data)}</code></b>\n\n✅ ${ctx.t('use_code_now_hint') || 'You can use the code now'}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: ctx.t('buy_another_btn'), callback_data: 'action_buy_number' }],
                [{ text: ctx.t('activation_channel_btn'), url: 'https://t.me/your_activation_channel' }]
              ]
            }
          }
        ).catch(() => { });
      } else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        await durianApi.releaseNumber('0257', phoneNumber, account);
        await cancelOrder(phoneNumber);

        const countryInfo = durianApi.getCountryInfo(countryCode);
        const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
        const lang = ctx.state.lang || 'en';
        const countryName = (lang === 'ar' && countryInfo.name_ar) ? countryInfo.name_ar : countryInfo.name;

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
        ).catch(() => { });
      }
    } catch (err) {
      console.error('[POLLING ERROR]', err);
    }
  }, 15000);
}

/**
 * Background Polling Logic for Auto-Reserve (No ctx available)
 */
async function startAutoPolling(telegramId, messageId, phoneNumber, countryCode, lang, account = null) {
  let attempts = 0;
  const maxAttempts = 20;

  const pollInterval = setInterval(async () => {
    attempts++;
    try {
      const smsRes = await durianApi.getMsg('0257', phoneNumber, account);
      if (smsRes.code === 200 && smsRes.data && smsRes.data.length > 0) {
        clearInterval(pollInterval);
        await completeOrderAndCommission(phoneNumber, smsRes.data);

        const countryInfo = durianApi.getCountryInfo(countryCode);
        const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
        const countryName = (lang === 'ar' && countryInfo.name_ar) ? countryInfo.name_ar : countryInfo.name;

        await bot.telegram.editMessageText(
          telegramId,
          messageId,
          null,
          `${i18n.t(lang, 'purchase_success')}\n\n• ${i18n.t(lang, 'number_label')}: <b><code>+${cleanPhone}</code></b>\n• ${i18n.t(lang, 'country_label')}: <b>${countryInfo.flag} ${escapeHTML(countryName)}</b>\n• ${i18n.t(lang, 'code_label')}: <b><code>${escapeHTML(smsRes.data)}</code></b>\n\n✅ ${i18n.t(lang, 'use_code_now_hint') || 'You can use the code now'}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: i18n.t(lang, 'buy_another_btn'), callback_data: 'action_buy_number' }],
                [{ text: i18n.t(lang, 'activation_channel_btn'), url: 'https://t.me/your_activation_channel' }]
              ]
            }
          }
        ).catch(() => { });
      } else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        await durianApi.releaseNumber('0257', phoneNumber, account);
        await cancelOrder(phoneNumber);

        const countryInfo = durianApi.getCountryInfo(countryCode);
        const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
        const countryName = (lang === 'ar' && countryInfo.name_ar) ? countryInfo.name_ar : countryInfo.name;

        await bot.telegram.editMessageText(
          telegramId,
          messageId,
          null,
          `${i18n.t(lang, 'purchase_success_plain')}\n\n• <b>${i18n.t(lang, 'number_label')}</b>: <code>+${cleanPhone}</code>\n• <b>${i18n.t(lang, 'country_label')}</b>: ${countryInfo.flag} ${escapeHTML(countryName)}\n• <b>${i18n.t(lang, 'code_label')}</b>:  <code>XXXXX</code>\n\n<b>${i18n.t(lang, 'code_not_retrieved')}</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: i18n.t(lang, 'retry_btn'), callback_data: `check_code_${countryCode}_${phoneNumber}` }],
                [{ text: i18n.t(lang, 'main_menu_btn'), callback_data: 'action_main_menu' }]
              ]
            }
          }
        ).catch(() => { });
      }
    } catch (err) {
      console.error('[AUTO POLLING ERROR]', err);
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
// --- TEXT MESSAGE HANDLER FOR BINANCE TXID ---
bot.on('text', async (ctx, next) => {
  if (!ctx.session || !ctx.session.awaitingBinanceTxid) return next();

  const txid = ctx.message.text.trim();
  if (!txid) return next();

  // 1. Validation: Length <= 5
  if (txid.length <= 5) {
    ctx.session.awaitingBinanceTxid = false;
    await ctx.reply(ctx.t('deposit_id_error'), { parse_mode: 'HTML' });
    return;
  }

  // 2. Processing Feedback loop
  const processing = await ctx.reply(ctx.t('processing_msg'), { parse_mode: 'HTML' });

  // Artificial delay (e.g., 2 seconds) for UX
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Before proceeding, delete the processing message to keep chat clean (optional but professional)
    try {
      await ctx.deleteMessage(processing.message_id);
    } catch (err) { /* ignore */ }

    // 3. Check if TXID already used
    const existing = await prisma.deposit.findUnique({ where: { transactionId: txid } });
    if (existing) {
      ctx.session.awaitingBinanceTxid = false;
      await ctx.reply(ctx.t('deposit_not_found'), { parse_mode: 'HTML' });
      return;
    }

    // 2. Load Credentials
    const settings = await prisma.globalSetting.findMany();
    const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

    const apiKey = settingsMap.binance_api_key || process.env.BINANCE_API_KEY;
    const apiSecret = settingsMap.binance_api_secret || process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('[BINANCE ERROR] API Credentials missing in database and .env');
      ctx.session.awaitingBinanceTxid = false;
      await ctx.reply(ctx.t('deposit_error'), { parse_mode: 'HTML' });
      return;
    }

    // 3. Verify with Binance
    const binanceService = new BinancePayService(apiKey, apiSecret);
    const verification = await binanceService.verifyTransaction(txid);

    if (verification) {
      const { amount } = verification;
      const { user } = await getOrCreateUser(ctx);

      // Create Deposit record
      await prisma.deposit.create({
        data: {
          userId: user.id,
          amount: amount,
          method: 'BINANCE_PAY',
          status: 'APPROVED',
          transactionId: txid
        }
      });

      // Update User Balance
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { balance: { increment: amount } }
      });

      await ctx.reply(ctx.t('deposit_verified', {
        amount: amount.toFixed(8).replace(/\.?0+$/, ''), // Clean decimal
        newBalance: updatedUser.balance.toFixed(8).replace(/\.?0+$/, '')
      }), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(ctx.t('shop_btn'), 'action_buy_number')],
            [Markup.button.callback(ctx.t('back_to_main_btn'), 'action_main_menu')]
          ]
        }
      });
      ctx.session.awaitingBinanceTxid = false;
    } else {
      ctx.session.awaitingBinanceTxid = false;
      await ctx.reply(ctx.t('deposit_not_found'), { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.error('[BINANCE VERIFICATION ERROR]', err.message);
    ctx.session.awaitingBinanceTxid = false;
    await ctx.reply(ctx.t('deposit_error'), { parse_mode: 'HTML' });
  }
});

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
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount)) return res.status(400).json({ msg: 'Invalid amount' });

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: parsedAmount } }
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

// --- PROVIDER ACCOUNTS APIs ---

app.get('/api/admin/provider-accounts', isAdminMiddleware, async (req, res) => {
  try {
    const accs = await prisma.providerAccount.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Fetch live balance for each account to show in UI
    const formattedAccs = await Promise.all(accs.map(async (a) => {
      const info = await durianApi.getUserInfo({ username: a.username, apiKey: a.apiKey });
      return {
        ...a,
        liveBalance: info.code === 200 ? info.data.balance : 'Error'
      };
    }));

    res.json(formattedAccs);
  } catch (err) {
    console.error('Fetch provider accounts error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

app.post('/api/admin/provider-accounts/add', isAdminMiddleware, async (req, res) => {
  const { username, apiKey } = req.body;
  if (!username || !apiKey) return res.status(400).json({ msg: 'Missing fields' });

  try {
    const newAcc = await prisma.providerAccount.create({
      data: { username, apiKey }
    });
    res.json(newAcc);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to add account' });
  }
});

app.post('/api/admin/provider-accounts/toggle', isAdminMiddleware, async (req, res) => {
  const { id, isActive } = req.body;
  try {
    await prisma.providerAccount.update({
      where: { id: parseInt(id) },
      data: { isActive }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to toggle account' });
  }
});

app.delete('/api/admin/provider-accounts/:id', isAdminMiddleware, async (req, res) => {
  try {
    await prisma.providerAccount.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to delete account' });
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

// --- LIVE HUNTER ALERTS & BOT STARTUP ---
hunter.start(5000, async (code, stock) => {
  try {
    const subs = await prisma.notificationSubscription.findMany({
      where: { countryCode: code },
      include: { user: true }
    });

    if (subs.length > 0) {
      console.log(`[HUNTER ALERT] Stock for ${code} is ${stock}. Notifying ${subs.length} users...`);
    }

    const countryConfig = await prisma.countryConfig.findUnique({ where: { countryCode: code } });
    const price = countryConfig ? countryConfig.price : 0.25;

    for (const s of subs) {
      if (!s.user || s.user.isBanned) continue;

      // Skip notification if balance is low (wait for grace period cleanup)
      if (s.user.balance < price) {
        continue;
      }

      const lang = s.user.language || 'en';
      const info = durianApi.getCountryInfo(code, lang);
      const msg = i18n.t(lang, 'alert_notification', {
        flag: info.flag,
        name: info.localizedName,
        price: price.toFixed(2)
      });

      const btnText = i18n.t(lang, 'alert_buy_btn');

      bot.telegram.sendMessage(s.user.telegramId, msg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(btnText, `select_country_${code}_alert`)]
          ]
        }
      }).catch(err => {
        if (!err.message.includes('blocked by the user') && !err.message.includes('chat not found')) {
          console.error(`[HUNTER MSG ERROR] User ${s.user.telegramId}:`, err.message);
        }
      });

      // Small sleep to prevent flood
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } catch (err) {
    console.error('[HUNTER BROADCAST ERROR]', err);
  }
});

/**
 * Schedule Daily Summary at 00:00 AM
 */
const scheduleDailySummary = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running daily summary...');
    try {
      const settings = await prisma.globalSetting.findMany();
      const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
      const channelUsername = settingsMap.activation_channel;

      if (!channelUsername) return;

      // Time range: Yesterday (the day that just ended)
      const now = new Date();
      const endOfYesterday = new Date(now.setHours(0, 0, 0, 0));
      const startOfYesterday = new Date(new Date(endOfYesterday).setDate(endOfYesterday.getDate() - 1));

      const orders = await prisma.order.findMany({
        where: {
          status: 'SUCCESS',
          createdAt: {
            gte: startOfYesterday,
            lt: endOfYesterday
          }
        }
      });

      if (orders.length === 0) return;

      // Group by country
      const stats = {};
      for (const order of orders) {
        if (!stats[order.countryId]) {
          stats[order.countryId] = { count: 0, price: order.price };
        }
        stats[order.countryId].count++;
      }

      // Sort by count descending
      const sortedStats = Object.entries(stats)
        .sort((a, b) => b[1].count - a[1].count);

      const botInfo = await bot.telegram.getMe();

      // Date formatting for header (Yesterday)
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[startOfYesterday.getDay()];
      const dateFormatted = `${startOfYesterday.getDate().toString().padStart(2, '0')}/${(startOfYesterday.getMonth() + 1).toString().padStart(2, '0')}/${startOfYesterday.getFullYear()}`;

      let msg = `📊 <b>Countries that were purchased today</b>\n`;
      msg += `<b>${dayName} ${dateFormatted}</b>\n\n`;

      let listMsg = '';
      sortedStats.forEach(([countryId, data], index) => {
        const countryInfo = durianApi.getCountryInfo(countryId);
        listMsg += `${index + 1} - ${countryInfo.name} ${countryInfo.flag} : ${data.count} : ( $${data.price} )\n`;
      });
      msg += `<blockquote>${listMsg.trim()}</blockquote>\n`;

      msg += `\n\n<b>Thank you for using our bot ❤️</b>`;

      const sentMsg = await bot.telegram.sendMessage(channelUsername, msg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛒 Buy Now', url: settingsMap.activation_channel_link || `https://t.me/${botInfo.username}` }]
          ]
        }
      });

      await bot.telegram.pinChatMessage(channelUsername, sentMsg.message_id);
    } catch (err) {
      console.error('[CRON ERROR]', err.message);
    }
  });
};

// Start the CRON job
scheduleDailySummary();

/**
 * Background scanner for delayed subscription cancellation (1-hour grace period)
 */
const scanLowBalanceSubscriptions = async () => {
  try {
    const usersWithSubs = await prisma.user.findMany({
      where: {
        subscriptions: { some: {} }
      },
      include: {
        subscriptions: true
      }
    });

    const configs = await prisma.countryConfig.findMany();
    const configMap = configs.reduce((acc, c) => ({ ...acc, [c.countryCode]: c }), {});

    for (const user of usersWithSubs) {
      const invalidSubs = [];
      for (const sub of user.subscriptions) {
        const cfg = configMap[sub.countryCode];
        const price = cfg ? cfg.price : 0.25;
        if (user.balance < price) {
          invalidSubs.push({ ...sub, price });
        }
      }

      if (invalidSubs.length > 0) {
        if (!user.lowBalanceSince) {
          // Mark starting time of low balance
          await prisma.user.update({
            where: { id: user.id },
            data: { lowBalanceSince: new Date() }
          });
        } else {
          // Check if 1 hour has passed
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (user.lowBalanceSince < oneHourAgo) {
            // Cancel all subscriptions
            await prisma.notificationSubscription.deleteMany({
              where: { userId: user.id }
            });

            // Reset lowBalanceSince and notify
            await prisma.user.update({
              where: { id: user.id },
              data: { lowBalanceSince: null }
            });

            // Send localized notification
            const lang = user.language || 'en';
            let countriesList = '';
            invalidSubs.forEach(s => {
              const info = durianApi.getCountryInfo(s.countryCode, lang);
              countriesList += `• ${info.localizedName} (${s.price}$)\n`;
            });

            const msg = i18n.t(lang, 'alert_cancel_msg', { countries: countriesList.trim() });
            await bot.telegram.sendMessage(user.telegramId, msg, {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: i18n.t(lang, 'alert_cancel_deposit_btn'), callback_data: 'action_deposit' }],
                  [{ text: i18n.t(lang, 'alert_cancel_back_btn'), callback_data: 'action_main_menu' }]
                ]
              }
            }).catch(() => { });
          }
        }
      } else if (user.lowBalanceSince) {
        // Balance is sufficient now, reset timer
        await prisma.user.update({
          where: { id: user.id },
          data: { lowBalanceSince: null }
        });
      }
    }
  } catch (err) {
    console.error('[SCANNER ERROR]', err.message);
  }
};

// Run scanner every 5 minutes
setInterval(scanLowBalanceSubscriptions, 5 * 60 * 1000);

// Start the hunter service
hunter.start(3000, async (code, stock) => {
  try {
    const countryConfig = await prisma.countryConfig.findUnique({ where: { countryCode: code } });
    const price = countryConfig ? countryConfig.price : 0.25;

    // 1. Handle Auto-Reserves (Priority)
    const autoSubs = await prisma.autoReserveSubscription.findMany({
      where: { countryCode: code },
      include: { user: true }
    });

    if (autoSubs.length > 0) {
      console.log(`[AUTO-RESERVE] Stock for ${code} is ${stock}. Trying to buy for ${autoSubs.length} users...`);
      for (const sub of autoSubs) {
        if (!sub.user || sub.user.isBanned || sub.user.balance < price) continue;

        try {
          const buyRes = await getCleanMobile(code);
          if (buyRes && buyRes.phoneNumber) {
            const phoneNumber = buyRes.phoneNumber;
            const cleanPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;

            // Create Order
            const order = await prisma.order.create({
              data: {
                userId: sub.user.id,
                serviceId: '0257',
                countryId: code,
                phoneNumber: phoneNumber,
                price: price,
                status: 'PENDING',
                providerAccountId: buyRes.account?.id || null
              }
            });

            const lang = sub.user.language || 'en';
            const countryInfo = durianApi.getCountryInfo(code, lang);
            const countryName = (lang === 'ar' && countryInfo.name_ar) ? countryInfo.name_ar : countryInfo.name;

            const msg = `⚡ <b>${i18n.t(lang, 'purchase_success')} (Auto-Reserve)</b>\n\n• <b>${i18n.t(lang, 'number_label')}</b>: <code>+${cleanPhone}</code>\n• <b>${i18n.t(lang, 'country_label')}</b>: ${countryInfo.flag} ${escapeHTML(countryName)}\n• <b>${i18n.t(lang, 'code_label')}</b>: <code>XXXXX</code>\n\n<b>${i18n.t(lang, 'request_code_btn')}</b>`;

            const sentMsg = await bot.telegram.sendMessage(sub.user.telegramId, msg, {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: i18n.t(lang, 'request_code_btn'), callback_data: `check_code_${code}_${phoneNumber}` }]
                ]
              }
            });

            // Start polling for this specific auto-reserved number
            startAutoPolling(sub.user.telegramId, sentMsg.message_id, phoneNumber, code, lang, buyRes.account);

            console.log(`[AUTO-RESERVE] SUCCESS for User ${sub.user.telegramId} | Country: ${code}`);
          }
        } catch (buyErr) {
          console.error(`[AUTO-RESERVE FAIL] User ${sub.user.telegramId}:`, buyErr.message);
        }
      }
    }

    // 2. Handle Notifications (Alerts)
    const now = Date.now();
    const lastSent = lastAlertSent[code] || 0;

    // Only send alerts every 5 minutes per country
    if (now - lastSent > 5 * 60 * 1000) {
      lastAlertSent[code] = now;

      // Filter out users who already have an auto-reserve subscription for this country
      const autoReservedUserIds = autoSubs.map(s => s.userId);

      const subs = await prisma.notificationSubscription.findMany({
        where: {
          countryCode: code,
          userId: { notIn: autoReservedUserIds }
        },
        include: { user: true }
      });

      if (subs.length > 0) {
        console.log(`[HUNTER ALERT] Stock for ${code} is ${stock}. Notifying ${subs.length} users...`);
        for (const s of subs) {
          if (!s.user || s.user.isBanned || s.user.balance < price) continue;

          const lang = s.user.language || 'en';
          const info = durianApi.getCountryInfo(code, lang);
          const msg = i18n.t(lang, 'alert_notification', {
            flag: info.flag,
            name: info.localizedName,
            price: price.toFixed(2)
          });

          bot.telegram.sendMessage(s.user.telegramId, msg, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[Markup.button.callback(i18n.t(lang, 'alert_buy_btn'), `select_country_${code}_alert`)]]
            }
          }).catch(() => { });

          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
  } catch (err) {
    console.error('[HUNTER BROADCAST ERROR]', err);
  }
});

// Launch the bot
bot.launch().then(() => {
  console.log('[BOT] Pulse SMS Bot is now running!');
}).catch(err => {
  console.error('[BOT ERROR] Failed to launch bot:', err);
});

const texts = {
  en: {
    welcome: "🔰 *Welcome to International Numbers Store* 🔰\n\n{name} 👋\n\n*Choose the appropriate option from the menu:*",
    choose_lang: "❍ Please choose your language\n❍ দয়া করে আপনার भाषा নির্বাচন করুন\n❍ لطفاً زبان خود را انتخاب کنید\n❍ الرجاء اختيار لغتك",
    balance_header: "💰 *Your Current Balance*\n\n• *Available Balance:* {balance}$\n• *Total Purchases:* {purchases}$\n\n💎 *Choose Deposit Method:*",
    stats_header: "📊 *Personal Statistics*\n\n• *Active Numbers:* {active}\n• *Total Purchases:* {count}\n• *Total Purchases:* {total}$\n\n🎯 *Continue Shopping!*",
    invite_header: "🔗 *Invite Friend*\n\nInvite your friends and earn 5% of their purchases!\n\n📎 *Your Invite Link:*\n{link}\n\n📊 *Statistics*\n• 👥 Team Total: {teamCount}\n• Today: {todayCount} (Profit: {todayProfit}$)\n• This Week: {weekCount} (Profit: {weekProfit}$)\n• This Month: {monthCount} (Profit: {monthProfit}$)\n• 💰 Referral Balance: {refBalance}$\n\nThis balance is separate and can be used to buy numbers or withdrawn.",
    withdraw_btn: "Withdraw Profits 💰",
    back_btn: "🔙 Back",
    buy_number_header: "🌍 *Choose Country* 🌍\n\n• Get everything new first!\n• Choose the country to buy a number from:",
    refresh_btn: "🔄 Refresh List",
    binance_btn: "💳 Binance",
    deposit_header: "💎 *Choose Deposit Method:*",
    purchase_success: "🎉 *Purchase Successful!*",
    number_label: "Number",
    country_label: "Country",
    code_label: "Code",
    request_code_btn: "🔄 Request Code",
    retry_btn: "🔄 Retry",
    buy_another_btn: "🛒 Buy Another Number",
    code_not_retrieved: "❌ *The code was not retrieved. Please try again.*",
    withdrawal_success: "✅ Withdrawal Successful!",
    withdrawn_to_balance: "{amount}$ has been added to your main balance.",
    insufficient_ref_balance: "❌ Your referral balance is insufficient.\n• Current balance: {balance}$\n• Minimum required: 1$",
    lang_set_success: "✅ Language set to {lang}",
    welcome_user: "🔰 *Welcome to International Numbers Store* 🔰\n\n*{name} 👋*\n\n*Choose the appropriate option from the menu:*",
    welcome_bot: "🔰 *Welcome to International Numbers Store* 🔰\n\n*Pulse SMS 🩸 👋*\n\n*Choose the appropriate option from the menu:*"
  },
  ar: {
    welcome_user: "🔰 *مرحباً بك في متجر الأرقام الدولي* 🔰\n\n{name} 👋\n\n*اختر الخيار المناسب من القائمة:*",
    welcome_bot: "🔰 *مرحباً بك في متجر الأرقام الدولي* 🔰\n\n*Pulse SMS 🩸 👋*\n\n*اختر الخيار المناسب من القائمة:*",
    lang_set_success: "✅ تم ضبط اللغة على {lang}",
    choose_lang: "❍ Please choose your language\n❍ দয়া করে আপনার भाषा নির্বাচন করুন\n❍ لطفاً زبان خود را انتخاب کنید\n❍ الرجاء اختيار لغتك",
    balance_header: "💰 *رصيدك الحالي*\n\n• *الرصيد المتاح:* {balance}$\n• *إجمالي المشتريات:* {purchases}$\n\n💎 *اختر طريقة الشحن:*",
    stats_header: "📊 *إحصائياتك الشخصية*\n\n• *الأرقام النشطة:* {active}\n• *إجمالي المشتريات:* {count}\n• *إجمالي المشتريات:* {total}$\n\n🎯 *استمر في الشراء!*",
    invite_header: "🔗 *دعوة صديق*\n\n*ادعُ أصدقاءك واربح 5% من مشترياتهم!*\n\n📎 *رابط دعوتك:*\n{link}\n\n*انسخ الرابط وأرسله لأصدقائك، عندما يشترك أحدهم عبر رابطك ويشتري رقماً ستربح 5% من سعر الشراء.*\n\n📊 *إحصائياتك*\n• 👥 *إجمالي فريقك:* {teamCount}\n• *اليوم:* {todayCount} (أرباح: {todayProfit}$)\n• *هذا الأسبوع:* {weekCount} (أرباح: {weekProfit}$)\n• *هذا الشهر:* {monthCount} (أرباح: {monthProfit}$)\n• 💰 *رصيد الإحالات الحالي:* {refBalance}$\n\n*هذا الرصيد منفصل عن رصيدك الرئيسي ويمكن استخدامه لشراء الأرقام أو سحبه*",
    withdraw_btn: "سحب الأرباح 💰",
    back_btn: "🔙 رجوع",
    buy_number_header: "🌍 *اختر الدولة المطلوبة*\n\n• يصلك كل جديد أولًا بأول\n• اختر الدولة المراد شراء رقم منها:",
    refresh_btn: "🔄 تحديث القائمة",
    binance_btn: "💳 باينانس",
    deposit_header: "💎 *اختر طريقة الشحن:*",
    purchase_success: "🎉 *تم الشراء بنجاح!*",
    number_label: "الرقم",
    country_label: "الدولة",
    code_label: "الكود",
    request_code_btn: "🔄 طلب الكود",
    retry_btn: "🔄 إعادة المحاولة",
    buy_another_btn: "🛒 شراء رقم آخر",
    code_not_retrieved: "❌ *لم يتم استلام الكود. يرجى المحاولة مرة أخرى.*",
    withdrawal_success: "✅ تم سحب الأرباح بنجاح!",
    withdrawn_to_balance: "تم إضافة {amount}$ إلى رصيدك الرئيسي.",
    insufficient_ref_balance: "❌ رصيد الإحالات الخاص بك غير كافٍ.\n• الرصيد الحالي: {balance}$\n• الحد الأدنى المطلوب: 1$",
    activation_channel_btn: "📢 قناة التفعيلات"
  },
  fa: {
    welcome: "🔰 به فروشگاه شماره های بین المللی خوش آمدید 🔰\n\n{name} 👋\n\nگزینه مناسب را از منو انتخاب کنید:",
    choose_lang: "❍ Please choose your language\n❍ দয়া করে আপনার ভাষা নির্বাচন করুন\n❍ لطفاً زبان خود را انتخاب کنید\n❍ الرجاء اختيار لغتك",
    // Placeholder (Will update later)
    balance_header: "💰 موجودی فعلی شما\n\n• موجودی در دسترس: {balance}$\n• کل خریدها: {purchases}$\n\n💎 روش واریز را انتخاب کنید:",
  },
  bn: {
    welcome: "🔰 আন্তর্জাতিক নম্বর স্টোরে স্বাগতম 🔰\n\n{name} 👋\n\nমেনু থেকে উপযুক্ত বিকল্পটি বেছে নিন:",
    choose_lang: "❍ Please choose your language\n❍ দয়া করে আপনার ভাষা নির্বাচন করুন\n❍ لطفاً زبان خود را انتخاب کنید\n❍ الرجاء اختيار لغتك",
    // Placeholder (Will update later)
    balance_header: "💰 আপনার বর্তমান ব্যালেন্স\n\n• উপলব্ধ ব্যালেন্স: {balance}$\n• মোট কেনাকাটা: {purchases}$\n\n💎 ডিপোজিট পদ্ধতি বেছে নিন:",
  }
};

const buttons = {
  en: {
    buy_number: "🛒 Buy Number",
    my_balance: "💰 My Balance",
    deposit: "💳 Deposit",
    my_stats: "📊 My Statistics",
    notifications: "⚙️ Notification Settings",
    invite: "🗽 Invite Friend"
  },
  ar: {
    buy_number: "🛒 شراء رقم",
    my_balance: "💰 رصيدي",
    deposit: "💳 شحن الرصيد",
    my_stats: "📊 إحصائياتي",
    notifications: "⚙️ إعدادات التنبيهات",
    invite: "🗽 دعوه صديقك"
  },
  fa: {
    buy_number: "🛒 خرید شماره",
    my_balance: "💰 موجودی من",
    deposit: "💳 واریز",
    my_stats: "📊 آمار من",
    notifications: "⚙️ تنظیمات اعلان",
    invite: "🗽 دعوت از دوستان"
  },
  bn: {
    buy_number: "🛒 নম্বর কিনুন",
    my_balance: "💰 আমার ব্যালেন্স",
    deposit: "💳 ডিপোজিট",
    my_stats: "📊 আমার পরিসংখ্যান",
    notifications: "⚙️ নোটিফিকেশন সেটিংস",
    invite: "🗽 বন্ধুকে আমন্ত্রণ জানান"
  }
};

module.exports = {
  t: (lang, key, params = {}) => {
    let str = (texts[lang] && texts[lang][key]) || (texts['en'][key]) || key;
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
    return str;
  },
  b: (lang, key) => {
    return (buttons[lang] && buttons[lang][key]) || (buttons['en'][key]) || key;
  }
};

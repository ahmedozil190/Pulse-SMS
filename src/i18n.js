const texts = {
  en: {
    welcome: "🔰 <b>Welcome to International Numbers Store</b> 🔰\n\n{name} 👋\n\n<b>Choose the appropriate option from the menu:</b>",
    choose_lang: "❍ Please choose your language\n❍ দয়া করে আপনার ভাষা নির্বাচন করুন\n❍ لطفاً زبان خود را انتخاب کنید\n❍ الرجاء اختيار لغتك",
    balance_header: "💰 <b>Your Current Balance</b>\n\n• <b>Available Balance:</b> {balance}$\n• <b>Total Purchases:</b> {purchases}$\n\n💎 <b>Choose Deposit Method:</b>",
    stats_header: "📊 <b>Personal Statistics</b>\n\n• <b>Active Numbers:</b> {active}\n• <b>Total Purchases:</b> {count}\n• <b>Total Purchases:</b> {total}$\n\n🎯 <b>Continue Shopping!</b>",
    invite_header: "🔗 <b>Invite Friend</b>\n\n<b>Invite your friends and earn 5% of their purchases!</b>\n\n📎 <b>Your Invite Link:</b>\n{link}\n\n<b>Statistics</b>\n• 👥 Team Total: {teamCount}\n• Today: {todayCount} (Profit: {todayProfit}$)\n• This Week: {weekCount} (Profit: {weekProfit}$)\n• This Month: {monthCount} (Profit: {monthProfit}$)\n• 💰 Referral Balance: {refBalance}$\n\nThis balance is separate and can be used to buy numbers or withdrawn.",
    withdraw_btn: "Withdraw Profits 💰",
    back_btn: "🔙 Back",
    buy_number_header: "🌍 <b>Choose Country</b> 🌍\n\n• Get everything new first!\n• Choose the country to buy a number from:",
    refresh_btn: "🔄 Refresh List",
    binance_btn: "💳 Binance",
    deposit_header: "💎 <b>Choose Deposit Method:</b>",
    purchase_success: "🎉 <b>Purchase Successful!</b>",
    number_label: "Number",
    country_label: "Country",
    code_label: "Code",
    request_code_btn: "🔄 Request Code",
    retry_btn: "🔄 Retry",
    buy_another_btn: "🛒 Buy Another Number",
    code_not_retrieved: "❌ <b>The code was not retrieved. Please try again.</b>",
    withdrawal_success: "✅ Withdrawal Successful!",
    withdrawn_to_balance: "{amount}$ has been added to your main balance.",
    insufficient_ref_balance: "❌ Your referral balance is insufficient.\n• Current balance: {balance}$\n• Minimum required: 1$",
    lang_set_success: "✅ Language set to {lang}",
    welcome_user: "🔰 <b>Welcome to International Numbers Store</b> 🔰\n\n<b>{name} 👋</b>\n\n<b>Choose the appropriate option from the menu:</b>",
    welcome_bot: "🔰 <b>Welcome to International Numbers Store</b> 🔰\n\n<b>Pulse SMS 🩸 👋</b>\n\n<b>Choose the appropriate option from the menu:</b>"
  },
  ar: {
    welcome_user: "🔰 <b>مرحباً بك في متجر الأرقام الدولي</b> 🔰\n\n{name} 👋\n\n<b>اختر الخيار المناسب من القائمة:</b>",
    welcome_bot: "🔰 <b>مرحباً بك في متجر الأرقام الدولي</b> 🔰\n\n<b>Pulse SMS 🩸 👋</b>\n\n<b>اختر الخيار المناسب من القائمة:</b>",
    lang_set_success: "✅ تم ضبط اللغة على {lang}",
    choose_lang: "❍ Please choose your language\n❍ দয়া করে আপনার ভাষা নির্বাচন করুন\n❍ لطفاً زبان خود را انتخاب کنید\n❍ الرجاء اختيار لغتك",
    balance_header: "💰 <b>رصيدك الحالي</b>\n\n• <b>الرصيد المتاح:</b> {balance}$\n• <b>إجمالي المشتريات:</b> {purchases}$\n\n💎 <b>اختر طريقة الشحن:</b>",
    stats_header: "📊 <b>إحصائياتك الشخصية</b>\n\n• <b>الأرقام النشطة:</b> {active}\n• <b>إجمالي المشتريات:</b> {count}\n• <b>إجمالي المشتريات:</b> {total}$\n\n🎯 <b>استمر في الشراء!</b>",
    invite_header: "🔗 <b>دعوة صديق</b>\n\n<b>ادعُ أصدقاءك واربح 5% من مشترياتهم!</b>\n\n📎 <b>رابط دعوتك:</b>\n{link}\n\n<b>انسخ الرابط وأرسله لأصدقائك، عندما يشترك أحدهم عبر رابطك ويشتري رقماً ستربح 5% من سعر الشراء.</b>\n\n📊 <b>إحصائياتك</b>\n• 👥 <b>إجمالي فريقك:</b> {teamCount}\n• <b>اليوم:</b> {todayCount} (أرباح: {todayProfit}$)\n• <b>هذا الأسبوع:</b> {weekCount} (أرباح: {weekProfit}$)\n• <b>هذا الشهر:</b> {monthCount} (أرباح: {monthProfit}$)\n• 💰 <b>رصيد الإحالات الحالي:</b> {refBalance}$\n\n<b>هذا الرصيد منفصل عن رصيدك الرئيسي ويمكن استخدامه لشراء الأرقام أو سحبه</b>",
    withdraw_btn: "سحب الأرباح 💰",
    back_btn: "🔙 رجوع",
    buy_number_header: "🌍 <b>اختر الدولة المطلوبة</b>\n\n• يصلك كل جديد أولًا بأول\n• اختر الدولة المراد شراء رقم منها:",
    refresh_btn: "🔄 تحديث القائمة",
    binance_btn: "💳 باينانس",
    deposit_header: "💎 <b>اختر طريقة الشحن:</b>",
    purchase_success: "🎉 <b>تم الشراء بنجاح!</b>",
    number_label: "الرقم",
    country_label: "الدولة",
    code_label: "الكود",
    request_code_btn: "🔄 طلب الكود",
    retry_btn: "🔄 إعادة المحاولة",
    buy_another_btn: "🛒 شراء رقم آخر",
    code_not_retrieved: "❌ <b>لم يتم استلام الكود. يرجى المحاولة مرة أخرى.</b>",
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

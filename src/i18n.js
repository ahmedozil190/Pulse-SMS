const texts = {
  en: {
    welcome: "<b>🔰 Welcome to International Numbers Store 🔰</b>\n\n<b>Pulse SMS 🩸 👋</b>\n\n<b>Choose the appropriate option from the menu:</b>",
    choose_lang: "❍ Please choose your language\n❍ দয়া করে আপনার ভাষা নির্বাচন করুন\n❍ لطفاً زبان خود را انتخاب کنید\n❍ الرجاء اختيار لغتك",
    balance_header: "💰 <b>Your Current Balance</b>\n\n• <b>Available Balance:</b> {balance}$\n• <b>Total Purchases:</b> {purchases}$\n\n💎 <b>Choose Deposit Method:</b>",
    stats_header: "📊 <b>Your Personal Statistics</b>\n\n• <b>Active Numbers:</b> {active}\n• <b>Total Purchases:</b> {count}\n• <b>Total Spent:</b> {total}$\n\n🎯 <b>Continue Shopping!</b>",
    invite_header: "<b>🔗 Invite a Friend</b>\n\nInvite your friends and earn 5% of their purchases!\n\n📎 Your invite link:\n<code>{link}</code>\n\nCopy the link and send it to your friends. When they join through your link and buy a number, you'll earn 5% of the purchase price.\n\n<b>📊 Your Statistics</b>\n• 👥 Your total team: {teamCount}\n• Today: {todayCount} (Earnings: {todayProfit}$)\n• This week: {weekCount} (Earnings: {weekProfit}$)\n• This month: {monthCount} (Earnings: {monthProfit}$)\n• 💰 Current referral balance: {refBalance}$\n\nThis balance is separate from your main balance and can be used to buy numbers or withdraw\n\n📅 Date: {date}",
    withdraw_btn: "💰 Withdraw Earnings",
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
    welcome_user: "<b>🔰 Welcome to International Numbers Store 🔰</b>\n\n<b>Pulse SMS 🩸 👋</b>\n\n<b>Choose the appropriate option from the menu:</b>",
    welcome_bot: "<b>🔰 Welcome to International Numbers Store 🔰</b>\n\n<b>Pulse SMS 🩸 👋</b>\n\n<b>Choose the appropriate option from the menu:</b>"
  },
  ar: {
    welcome_user: "<b>🔰 مرحباً بك في متجر الأرقام الدولي 🔰</b>\n\n<b>Pulse SMS 🩸 👋</b>\n\n<b>اختر الخيار المناسب من القائمة:</b>",
    welcome_bot: "<b>🔰 مرحباً بك في متجر الأرقام الدولي 🔰</b>\n\n<b>Pulse SMS 🩸 👋</b>\n\n<b>اختر الخيار المناسب من القائمة:</b>",
    lang_set_success: "✅ تم ضبط اللغة على {lang}",
    choose_lang: "❍ Please choose your language\n❍ দয়া করে আপনার ভাষা নির্বাচন করুন\n❍ لطفاً زبان خود را انتخاب کنید\n❍ الرجاء اختيار لغتك",
    balance_header: "💰 <b>رصيدك الحالي</b>\n\n• <b>الرصيد المتاح:</b> {balance}$\n• <b>إجمالي المشتريات:</b> {purchases}$\n\n💎 <b>اختر طريقة الشحن:</b>",
    stats_header: "📊 <b>إحصائياتك الشخصية</b>\n\n• <b>الأرقام النشطة:</b> {active}\n• <b>إجمالي المشتريات:</b> {count}\n• <b>إجمالي المشتريات:</b> {total}$\n\n🎯 <b>استمر في الشراء!</b>",
    invite_header: "<b>🔗 دعوة صديق</b>\n\nادعُ أصدقاءك واربح 5% من مشترياتهم!\n\n📎 رابط دعوتك:\n<code>{link}</code>\n\nانسخ الرابط وأرسله لأصدقائك، عندما يشترك أحدهم عبر رابطك ويشتري رقماً ستربح 5% من سعر الشراء.\n\n<b>📊 إحصائياتك</b>\n• 👥 إجمالي فريقك: {teamCount}\n• اليوم: {todayCount} (أرباح: {todayProfit}$)\n• هذا الأسبوع: {weekCount} (أرباح: {weekProfit}$)\n• هذا الشهر: {monthCount} (أرباح: {monthProfit}$)\n• 💰 رصيد الإحالات الحالي: {refBalance}$\n\nهذا الرصيد منفصل عن رصيدك الرئيسي ويمكن استخدامه لشراء الأرقام أو سحبه\n\n📅 التاريخ: {date}",
    withdraw_btn: "💰 سحب الأرباح",
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
    welcome_user: "<b>🔰 به فروشگاه اعداد بین المللی خوش آمدید 🔰</b>\n\n<b>Pulse SMS 🩸 👋</b>\n\n<b>گزینه مناسب را از منو انتخاب کنید:</b>",
    welcome_bot: "<b>🔰 به فروشگاه اعداد بین المللی خوش آمدید 🔰</b>\n\n<b>Pulse SMS 🩸 👋</b>\n\n<b>گزینه مناسب را از منو انتخاب کنید:</b>",
    choose_lang: "❍ Please choose your language\n❍ দয়া করে আপনার ভাষা নির্বাচন করুন\n❍ لطفاً زبان خود را انتخاب کنید\n❍ الرجاء اختيار لغتك",
    invite_header: "<b>🔗 دعوت دوست</b>\n\nدوستان خود را دعوت کنید و ۵٪ از خریدهایشان را کسب کنید!\n\n📎 لینک دعوت شما:\n<code>{link}</code>\n\nلینک را کپی کرده و برای دوستانتان ارسال کنید. وقتی از طریق لینک شما عضو شوند و شماره‌ای بخرند، ۵٪ از قیمت خرید را به دست خواهید آورد.\n\n<b>📊 آمار شما</b>\n• 👥 کل تیم شما: {teamCount}\n• امروز: {todayCount} (درآمد: {todayProfit}$)\n• این هفته: {weekCount} (درآمد: {weekProfit}$)\n• این ماه: {monthCount} (درآمد: {monthProfit}$)\n• 💰 موجودی referrals: {refBalance}$\n\nاین موجودی جدا از موجودی اصلی شماست و برای خرید شماره یا برداشت قابل استفاده است\n\n📅 تاریخ: {date}",
    withdraw_btn: "💰 برداشت سود",
    back_btn: "🔙 بازگشت",
    balance_header: "💰 موجودی فعلی شما\n\n• موجودی در دسترس: {balance}$\n• کل خریدها: {purchases}$\n\n💎 روش واریز را انتخاب کنید:",
  },
  bn: {
    welcome_user: "<b>🔰 আন্তর্জাতিক নম্বর স্টোরে স্বাগতম 🔰</b>\n\n<b>Pulse SMS 🩸 👋</b>\n\n<b>মেনু থেকে উপযুক্ত विकल्प নির্বাচন করুন:</b>",
    welcome_bot: "<b>🔰 আন্তর্জাতিক নম্বর স্টোরে স্বাগতম 🔰</b>\n\n<b>Pulse SMS 🩸 👋</b>\n\n<b>মেনু থেকে উপযুক্ত विकल्प নির্বাচন করুন:</b>",
    choose_lang: "❍ Please choose your language\n❍ দয়া করে আপনার ভাষা নির্বাচন করুন\n❍ لطفاً زبان خود را انتخاب کنید\n❍ الرجاء اختيار লগتك",
    invite_header: "<b>🔗 বন্ধুকে আমন্ত্রণ জানান</b>\n\nআপনার বন্ধুদের আমন্ত্রণ জানান এবং তাদের কেনাকাটার ৫% উপার্জন করুন!\n\n📎 আপনার আমন্ত্রণ লিঙ্ক:\n<code>{link}</code>\n\nলিঙ্কটি কপি করে আপনার বন্ধুদের কাছে পাঠান। তারা যখন আপনার লিঙ্কের মাধ্যমে যোগ দেয় এবং একটি নম্বর কেনে, আপনি কেনার মূল্যের ৫% উপার্জন করবেন।\n\n<b>📊 আপনার পরিসংখ্যান</b>\n• 👥 আপনার মোট দল: {teamCount}\n• আজ: {todayCount} (আয়: {todayProfit}$)\n• এই সপ্তাহ: {weekCount} (আয়: {weekProfit}$)\n• এই মাস: {monthCount} (আয়: {monthProfit}$)\n• 💰 বর্তমান রেফারেল ব্যালেন্স: {refBalance}$\n\nএই ব্যালেন্স আপনার মূল ব্যালেন্স থেকে আলাদা এবং নম্বর কেনা বা উত্তোলনের জন্য ব্যবহার করা যাবে\n\n📅 তারিখ: {date}",
    withdraw_btn: "💰 অর্থ উত্তলন",
    back_btn: "🔙 ফিরে যান",
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
    buy_number: "خرید شماره 🛒",
    my_balance: "موجودی من 💰",
    deposit: "شارژ حساب 💳",
    my_stats: "آمار من 📊",
    notifications: "تنظیمات هشدارها ⚙️",
    invite: "ادعُ أصدقاءك 🗽"
  },
  bn: {
    buy_number: "🛒 নম্বর কিনুন",
    my_balance: "💰 আমার ব্যালেন্স",
    deposit: "💳 ডিপোজিট",
    my_stats: "📊আমার পরিসংখ্যান ",
    notifications: "⚙️ নোটিফিকেশন সেটিংস",
    invite: "🗽 তোমার বন্ধুদের আমন্ত্রণ জানাও"
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

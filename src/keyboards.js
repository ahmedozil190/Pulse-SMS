const { Markup } = require('telegraf');
const durianApi = require('./api/durian');

const keyboards = {
  mainMenu: Markup.inlineKeyboard([
    [
      Markup.button.callback('🛒 Buy Number', 'action_buy_number'),
      Markup.button.callback('💰 My Balance', 'action_balance')
    ],
    [
      Markup.button.callback('💳 Deposit', 'action_deposit'),
      Markup.button.callback('📊 My Statistics', 'action_stats')
    ],
    [
      Markup.button.callback('⚙️ Notification Settings', 'action_settings'),
      Markup.button.callback('🗽 Invite Friend', 'action_invite')
    ]
  ]),

  cancelButton: Markup.inlineKeyboard([
    [Markup.button.callback('❌ Cancel', 'action_cancel')]
  ]),

  depositMethods: Markup.inlineKeyboard([
    [Markup.button.callback('💳 Binance', 'deposit_binance')],
    [Markup.button.callback('🔙 Back', 'action_main_menu')]
  ]),

  backToMain: Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back to Menu', 'action_main_menu')]
  ]),

  /**
   * Generates a dynamic keyboard for countries
   * @param {Object} distribution - Data returned from API { code: stock }
   */
  buildCountryKeyboard: (distribution) => {
    const buttons = [];
    const codes = Object.keys(distribution).filter(c => c !== ""); // Skip empty keys

    // Sort by stock descending or just take first X
    // For now, let's take all and chunk them
    codes.forEach(code => {
      const info = durianApi.getCountryInfo(code);
      const stock = distribution[code];
      const label = `${info.flag} ${info.name} (${stock}) 0.25$`;
      buttons.push(Markup.button.callback(label, `select_country_${code}`));
    });

    const rows = [];
    // Chunk buttons into rows of 2
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }

    // Add control buttons
    rows.push([Markup.button.callback('🔄 Refresh List', 'action_refresh_countries')]);
    rows.push([Markup.button.callback('🔙 Back', 'action_main_menu')]);

    return Markup.inlineKeyboard(rows);
  },

  languageSelect: Markup.inlineKeyboard([
    [
      Markup.button.callback('🇪🇬 العربية', 'set_lang_ar'),
      Markup.button.callback('🇺🇸 English', 'set_lang_en')
    ],
    [
      Markup.button.callback('🇮🇷 فارسی', 'set_lang_fa'),
      Markup.button.callback('🇧🇩 বাংলা', 'set_lang_bn')
    ]
  ])
};

module.exports = keyboards;

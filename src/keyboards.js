const { Markup } = require('telegraf');
const durianApi = require('./api/durian');
const i18n = require('./i18n');
const hunter = require('./services/hunter');

const keyboards = {
  mainMenu: (lang) => Markup.inlineKeyboard([
    [
      Markup.button.callback(i18n.b(lang, 'buy_number'), 'action_buy_number'),
      Markup.button.callback(i18n.b(lang, 'my_balance'), 'action_balance')
    ],
    [
      Markup.button.callback(i18n.b(lang, 'deposit'), 'action_deposit'),
      Markup.button.callback(i18n.b(lang, 'my_stats'), 'action_stats')
    ],
    [
      Markup.button.callback(i18n.b(lang, 'notifications'), 'action_settings'),
      Markup.button.callback(i18n.b(lang, 'invite'), 'action_invite')
    ]
  ]),

  cancelButton: (lang) => Markup.inlineKeyboard([
    [Markup.button.callback(`❌ ${i18n.t(lang, 'back_btn')}`, 'action_cancel')]
  ]),

  depositMethods: (lang) => Markup.inlineKeyboard([
    [Markup.button.callback(i18n.t(lang, 'binance_btn'), 'deposit_binance')],
    [Markup.button.callback(`${i18n.t(lang, 'back_btn')}`, 'action_main_menu')]
  ]),

  backToMain: (lang) => Markup.inlineKeyboard([
    [Markup.button.callback(i18n.t(lang, 'back_btn'), 'action_main_menu')]
  ]),

  /**
   * Generates a dynamic keyboard for countries (Elite Hunting Style)
   * @param {Object} distribution - Data returned from API { code: stock }
   * @param {string} lang - Language code
   * @param {Object} configMap - Map of country configs from the database { code: { isEnabled, price } }
   */
  buildCountryKeyboard: (distribution, lang, configMap = {}) => {
    const buttons = [];
    
    // 1. Filter for 'Real-time' Low Stock (1-25) and ensure country is globally enabled
    const codes = Object.keys(distribution)
      .filter(c => c !== "" && distribution[c] > 0 && distribution[c] <= 25)
      .filter(c => {
        // If config exists, must be enabled. If no config, default to true.
        const cfg = configMap[c];
        return cfg ? cfg.isEnabled : true;
      })
      .sort((a, b) => {
        // 2. Sort Logic: Fresh Arrivals (🔥) first, then by highest stock
        const aFresh = hunter.isFresh(a) ? 1 : 0;
        const bFresh = hunter.isFresh(b) ? 1 : 0;
        if (aFresh !== bFresh) return bFresh - aFresh;
        return distribution[b] - distribution[a];
      })
      .slice(0, 50);

    codes.forEach(code => {
      const info = durianApi.getCountryInfo(code);
      const stock = distribution[code];
      const cfg = configMap[code];
      const price = cfg ? cfg.price : 0.15;
      
      // 3. Match Competitor Label: Flag Name (Stock) Price$
      const label = `${info.flag} ${info.name} (${stock}) ${price}$`;
      
      buttons.push(Markup.button.callback(label, `select_country_${code}`));
    });

    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }

    // Add navigation buttons
    rows.push([Markup.button.callback(i18n.t(lang, 'refresh_btn'), 'action_refresh_countries')]);
    rows.push([Markup.button.callback(i18n.t(lang, 'back_btn'), 'action_main_menu')]);

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

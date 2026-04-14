const { Markup } = require('telegraf');
const durianApi = require('./api/durian');
const i18n = require('./i18n');

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
   * Generates a dynamic keyboard for countries
   * @param {Object} distribution - Data returned from API { code: stock }
   */
  buildCountryKeyboard: (distribution, lang) => {
    const buttons = [];
    const codes = Object.keys(distribution)
      .filter(c => c !== "" && distribution[c] > 0)
      .sort((a, b) => distribution[b] - distribution[a])
      .slice(0, 50); 

    codes.forEach(code => {
      const info = durianApi.getCountryInfo(code);
      const stock = distribution[code];
      const label = `${info.flag} ${info.name} (${stock})`;
      buttons.push(Markup.button.callback(label, `select_country_${code}`));
    });

    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }

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

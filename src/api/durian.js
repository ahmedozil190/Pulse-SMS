const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const BASE_URL = 'https://api.durianrcs.com/out/ext_api/';
const credentialParams = `name=${process.env.DURIAN_USERNAME}&ApiKey=${process.env.DURIAN_API_KEY}`;

const COUNTRY_MAP = {
  "af": { "name": "Afghanistan", "flag": "🇦🇫" },
  "al": { "name": "Albania", "flag": "🇦🇱" },
  "dz": { "name": "Algeria", "flag": "🇩🇿" },
  "as": { "name": "American Samoa", "flag": "🇦🇸" },
  "ad": { "name": "Andorra", "flag": "🇦🇩" },
  "ao": { "name": "Angola", "flag": "🇦🇴" },
  "ai": { "name": "Anguilla", "flag": "🇦🇮" },
  "aq": { "name": "Antarctica", "flag": "🇦🇶" },
  "ag": { "name": "Antigua and Barbuda", "flag": "🇦🇬" },
  "ar": { "name": "Argentina", "flag": "🇦🇷" },
  "am": { "name": "Armenia", "flag": "🇦🇲" },
  "aw": { "name": "Aruba", "flag": "🇦🇼" },
  "au": { "name": "Australia", "flag": "🇦🇺" },
  "at": { "name": "Austria", "flag": "🇦🇹" },
  "az": { "name": "Azerbaijan", "flag": "🇦🇿" },
  "bs": { "name": "Bahamas", "flag": "🇧🇸" },
  "bh": { "name": "Bahrain", "flag": "🇧🇭" },
  "bd": { "name": "Bangladesh", "flag": "🇧🇩" },
  "bb": { "name": "Barbados", "flag": "🇧🇧" },
  "by": { "name": "Belarus", "flag": "🇧🇾" },
  "be": { "name": "Belgium", "flag": "🇧🇪" },
  "bz": { "name": "Belize", "flag": "🇧🇿" },
  "bj": { "name": "Benin", "flag": "🇧🇯" },
  "bm": { "name": "Bermuda", "flag": "🇧🇲" },
  "bt": { "name": "Bhutan", "flag": "🇧🇹" },
  "bo": { "name": "Bolivia", "flag": "🇧🇴" },
  "ba": { "name": "Bosnia and Herzegovina", "flag": "🇧🇦" },
  "bw": { "name": "Botswana", "flag": "🇧🇼" },
  "bv": { "name": "Bouvet Island", "flag": "🇧🇻" },
  "br": { "name": "Brazil", "flag": "🇧🇷" },
  "io": { "name": "British Indian Ocean Territory", "flag": "🇮🇴" },
  "bn": { "name": "Brunei Darussalam", "flag": "🇧🇳" },
  "bg": { "name": "Bulgaria", "flag": "🇧🇬" },
  "bf": { "name": "Burkina Faso", "flag": "🇧🇫" },
  "bi": { "name": "Burundi", "flag": "🇧🇮" },
  "kh": { "name": "Cambodia", "flag": "🇰🇭" },
  "cm": { "name": "Cameroon", "flag": "🇨🇲" },
  "ca": { "name": "Canada", "flag": "🇨🇦" },
  "cv": { "name": "Cape Verde", "flag": "🇨🇻" },
  "ky": { "name": "Cayman Islands", "flag": "🇰🇾" },
  "cf": { "name": "Central African Republic", "flag": "🇨🇫" },
  "td": { "name": "Chad", "flag": "🇹🇩" },
  "cl": { "name": "Chile", "flag": "🇨🇱" },
  "cn": { "name": "China", "flag": "🇨🇳" },
  "cx": { "name": "Christmas Island", "flag": "🇨🇽" },
  "cc": { "name": "Cocos (Keeling) Islands", "flag": "🇨🇨" },
  "co": { "name": "Colombia", "flag": "🇨🇴" },
  "km": { "name": "Comoros", "flag": "🇰🇲" },
  "cg": { "name": "Congo", "flag": "🇨🇬" },
  "cd": { "name": "Congo, Democratic Republic of the", "flag": "🇨🇩" },
  "ck": { "name": "Cook Islands", "flag": "🇨🇰" },
  "cr": { "name": "Costa Rica", "flag": "🇨🇷" },
  "ci": { "name": "Cote D'Ivoire", "flag": "🇨🇮" },
  "hr": { "name": "Croatia", "flag": "🇭🇷" },
  "cu": { "name": "Cuba", "flag": "🇨🇺" },
  "cy": { "name": "Cyprus", "flag": "🇨🇾" },
  "cz": { "name": "Czech Republic", "flag": "🇨🇿" },
  "dk": { "name": "Denmark", "flag": "🇩🇰" },
  "dj": { "name": "Djibouti", "flag": "🇩🇯" },
  "dm": { "name": "Dominica", "flag": "🇩🇲" },
  "do": { "name": "Dominican Republic", "flag": "🇩🇴" },
  "ec": { "name": "Ecuador", "flag": "🇪🇨" },
  "eg": { "name": "Egypt", "flag": "🇪🇬" },
  "sv": { "name": "El Salvador", "flag": "🇸🇻" },
  "gq": { "name": "Equatorial Guinea", "flag": "🇬🇶" },
  "er": { "name": "Eritrea", "flag": "🇪🇷" },
  "ee": { "name": "Estonia", "flag": "🇪🇪" },
  "et": { "name": "Ethiopia", "flag": "🇪🇹" },
  "fk": { "name": "Falkland Islands (Malvinas)", "flag": "🇫🇰" },
  "fo": { "name": "Faroe Islands", "flag": "🇫🇴" },
  "fj": { "name": "Fiji", "flag": "🇫🇯" },
  "fi": { "name": "Finland", "flag": "🇫🇮" },
  "fr": { "name": "France", "flag": "🇫🇷" },
  "gf": { "name": "French Guiana", "flag": "🇬🇫" },
  "pf": { "name": "French Polynesia", "flag": "🇵🇫" },
  "tf": { "name": "French Southern Territories", "flag": "🇹🇫" },
  "ga": { "name": "Gabon", "flag": "🇬🇦" },
  "gm": { "name": "Gambia", "flag": "🇬🇲" },
  "ge": { "name": "Georgia", "flag": "🇬🇪" },
  "de": { "name": "Germany", "flag": "🇩🇪" },
  "gh": { "name": "Ghana", "flag": "🇬🇭" },
  "gi": { "name": "Gibraltar", "flag": "🇬🇮" },
  "gr": { "name": "Greece", "flag": "🇬🇷" },
  "gl": { "name": "Greenland", "flag": "🇬🇱" },
  "gd": { "name": "Grenada", "flag": "🇬🇩" },
  "gp": { "name": "Guadeloupe", "flag": "🇬🇵" },
  "gu": { "name": "Guam", "flag": "🇬🇺" },
  "gt": { "name": "Guatemala", "flag": "🇬🇹" },
  "gg": { "name": "Guernsey", "flag": "🇬🇬" },
  "gn": { "name": "Guinea", "flag": "🇬🇳" },
  "gw": { "name": "Guinea-Bissau", "flag": "🇬🇼" },
  "gy": { "name": "Guyana", "flag": "🇬🇾" },
  "ht": { "name": "Haiti", "flag": "🇭🇹" },
  "hm": { "name": "Heard Island and Mcdonald Islands", "flag": "🇭🇲" },
  "va": { "name": "Holy See (Vatican City State)", "flag": "🇻🇦" },
  "hn": { "name": "Honduras", "flag": "🇭🇳" },
  "hk": { "name": "Hong Kong", "flag": "🇭🇰" },
  "hu": { "name": "Hungary", "flag": "🇭🇺" },
  "is": { "name": "Iceland", "flag": "🇮🇸" },
  "in": { "name": "India", "flag": "🇮🇳" },
  "id": { "name": "Indonesia", "flag": "🇮🇩" },
  "ir": { "name": "Iran, Islamic Republic Of", "flag": "🇮🇷" },
  "iq": { "name": "Iraq", "flag": "🇮🇶" },
  "ie": { "name": "Ireland", "flag": "🇮🇪" },
  "im": { "name": "Isle of Man", "flag": "🇮🇲" },
  "il": { "name": "Israel", "flag": "🇮🇱" },
  "it": { "name": "Italy", "flag": "🇮🇹" },
  "jm": { "name": "Jamaica", "flag": "🇯🇲" },
  "jp": { "name": "Japan", "flag": "🇯🇵" },
  "je": { "name": "Jersey", "flag": "🇯🇪" },
  "jo": { "name": "Jordan", "flag": "🇯🇴" },
  "kz": { "name": "Kazakhstan", "flag": "🇰🇿" },
  "ke": { "name": "Kenya", "flag": "🇰🇪" },
  "ki": { "name": "Kiribati", "flag": "🇰🇮" },
  "kp": { "name": "Korea, Democratic People\'s Republic of", "flag": "🇰🇵" },
  "kr": { "name": "Korea, Republic of", "flag": "🇰🇷" },
  "kw": { "name": "Kuwait", "flag": "🇰🇼" },
  "kg": { "name": "Kyrgyzstan", "flag": "🇰🇬" },
  "la": { "name": "Lao People\'s Democratic Republic", "flag": "🇱🇦" },
  "lv": { "name": "Latvia", "flag": "🇱🇻" },
  "lb": { "name": "Lebanon", "flag": "🇱🇧" },
  "ls": { "name": "Lesotho", "flag": "🇱🇸" },
  "lr": { "name": "Liberia", "flag": "🇱🇷" },
  "ly": { "name": "Libyan Arab Jamahiriya", "flag": "🇱🇾" },
  "li": { "name": "Liechtenstein", "flag": "🇱🇮" },
  "lt": { "name": "Lithuania", "flag": "🇱🇹" },
  "lu": { "name": "Luxembourg", "flag": "🇱🇺" },
  "mo": { "name": "Macao", "flag": "🇲🇴" },
  "mk": { "name": "Macedonia, The Former Yugoslav Republic of", "flag": "🇲🇰" },
  "mg": { "name": "Madagascar", "flag": "🇲🇬" },
  "mw": { "name": "Malawi", "flag": "🇲🇼" },
  "my": { "name": "Malaysia", "flag": "🇲🇾" },
  "mv": { "name": "Maldives", "flag": "🇲🇻" },
  "ml": { "name": "Mali", "flag": "🇲🇱" },
  "mt": { "name": "Malta", "flag": "🇲🇹" },
  "mh": { "name": "Marshall Islands", "flag": "🇲🇭" },
  "mq": { "name": "Martinique", "flag": "🇲🇶" },
  "mr": { "name": "Mauritania", "flag": "🇲🇷" },
  "mu": { "name": "Mauritius", "flag": "🇲🇺" },
  "yt": { "name": "Mayotte", "flag": "🇾🇹" },
  "mx": { "name": "Mexico", "flag": "🇲🇽" },
  "fm": { "name": "Micronesia, Federated States of", "flag": "🇫🇲" },
  "md": { "name": "Moldova, Republic of", "flag": "🇲🇩" },
  "mc": { "name": "Monaco", "flag": "🇲🇨" },
  "mn": { "name": "Mongolia", "flag": "🇲🇳" },
  "me": { "name": "Montenegro", "flag": "🇲🇪" },
  "ms": { "name": "Montserrat", "flag": "🇲🇸" },
  "ma": { "name": "Morocco", "flag": "🇲🇦" },
  "mz": { "name": "Mozambique", "flag": "🇲🇿" },
  "mm": { "name": "Myanmar", "flag": "🇲🇲" },
  "na": { "name": "Namibia", "flag": "🇳🇦" },
  "nr": { "name": "Nauru", "flag": "🇳🇷" },
  "np": { "name": "Nepal", "flag": "🇳🇵" },
  "nl": { "name": "Netherlands", "flag": "🇳🇱" },
  "an": { "name": "Netherlands Antilles", "flag": "🇦🇳" },
  "nc": { "name": "New Caledonia", "flag": "🇳🇨" },
  "nz": { "name": "New Zealand", "flag": "🇳🇿" },
  "ni": { "name": "Nicaragua", "flag": "🇳🇮" },
  "ne": { "name": "Niger", "flag": "🇳🇪" },
  "ng": { "name": "Nigeria", "flag": "🇳🇬" },
  "nu": { "name": "Niue", "flag": "🇳🇺" },
  "nf": { "name": "Norfolk Island", "flag": "🇳🇫" },
  "mp": { "name": "Northern Mariana Islands", "flag": "🇲🇵" },
  "no": { "name": "Norway", "flag": "🇳🇴" },
  "om": { "name": "Oman", "flag": "🇴🇲" },
  "pk": { "name": "Pakistan", "flag": "🇵🇰" },
  "pw": { "name": "Palau", "flag": "🇵🇼" },
  "ps": { "name": "Palestinian Territory, Occupied", "flag": "🇵🇸" },
  "pa": { "name": "Panama", "flag": "🇵🇦" },
  "pg": { "name": "Papua New Guinea", "flag": "🇵🇬" },
  "py": { "name": "Paraguay", "flag": "🇵🇾" },
  "pe": { "name": "Peru", "flag": "🇵🇪" },
  "ph": { "name": "Philippines", "flag": "🇵🇭" },
  "pn": { "name": "Pitcairn", "flag": "🇵🇳" },
  "pl": { "name": "Poland", "flag": "🇵🇱" },
  "pt": { "name": "Portugal", "flag": "🇵🇹" },
  "pr": { "name": "Puerto Rico", "flag": "🇵🇷" },
  "qa": { "name": "Qatar", "flag": "🇶🇦" },
  "re": { "name": "Reunion", "flag": "🇷🇪" },
  "ro": { "name": "Romania", "flag": "🇷🇴" },
  "ru": { "name": "Russian Federation", "flag": "🇷🇺" },
  "rw": { "name": "Rwanda", "flag": "🇷🇼" },
  "sh": { "name": "Saint Helena", "flag": "🇸🇭" },
  "kn": { "name": "Saint Kitts and Nevis", flag: "🇰🇳" },
  "lc": { "name": "Saint Lucia", flag: "🇱🇨" },
  "pm": { "name": "Saint Pierre and Miquelon", flag: "🇵🇲" },
  "vc": { "name": "Saint Vincent and the Grenadines", flag: "🇻🇨" },
  "ws": { "name": "Samoa", flag: "🇼🇸" },
  "sm": { "name": "San Marino", flag: "🇸🇲" },
  "st": { "name": "Sao Tome and Principe", flag: "🇸🇹" },
  "sa": { "name": "Saudi Arabia", flag: "🇸🇦" },
  "sn": { "name": "Senegal", flag: "🇸🇳" },
  "rs": { "name": "Serbia", flag: "🇷🇸" },
  "sc": { "name": "Seychelles", flag: "🇸🇨" },
  "sl": { "name": "Sierra Leone", flag: "🇸🇱" },
  "sg": { "name": "Singapore", flag: "🇸🇬" },
  "sk": { "name": "Slovakia", flag: "🇸🇰" },
  "si": { "name": "Slovenia", flag: "🇸🇮" },
  "sb": { "name": "Solomon Islands", flag: "🇸🇧" },
  "so": { "name": "Somalia", flag: "🇸🇴" },
  "za": { "name": "South Africa", flag: "🇿🇦" },
  "gs": { "name": "South Georgia and the South Sandwich Islands", flag: "🇬🇸" },
  "es": { "name": "Spain", flag: "🇪🇸" },
  "lk": { "name": "Sri Lanka", flag: "🇱🇰" },
  "sd": { "name": "Sudan", flag: "🇸🇩" },
  "sr": { "name": "Suriname", flag: "🇸🇷" },
  "sj": { "name": "Svalbard and Jan Mayen", flag: "🇸🇯" },
  "sz": { "name": "Swaziland", flag: "🇸🇿" },
  "se": { "name": "Sweden", flag: "🇸🇪" },
  "ch": { "name": "Switzerland", flag: "🇨🇭" },
  "sy": { "name": "Syrian Arab Republic", flag: "🇸🇾" },
  "tw": { "name": "Taiwan, Province of China", flag: "🇹🇼" },
  "tj": { "name": "Tajikistan", flag: "🇹🇯" },
  "tz": { "name": "Tanzania, United Republic of", flag: "🇹🇿" },
  "th": { "name": "Thailand", flag: "🇹🇭" },
  "tl": { "name": "Timor-Leste", flag: "🇹🇱" },
  "tg": { "name": "Togo", flag: "🇹🇬" },
  "tk": { "name": "Tokelau", flag: "🇹🇰" },
  "to": { "name": "Tonga", flag: "🇹🇴" },
  "tt": { "name": "Trinidad and Tobago", flag: "🇹🇹" },
  "tn": { "name": "Tunisia", flag: "🇹🇳" },
  "tr": { "name": "Turkey", flag: "🇹🇷" },
  "tm": { "name": "Turkmenistan", flag: "🇹🇲" },
  "tc": { "name": "Turks and Caicos Islands", flag: "🇹🇨" },
  "tv": { "name": "Tuvalu", flag: "🇹🇻" },
  "ug": { "name": "Uganda", flag: "🇺🇬" },
  "ua": { "name": "Ukraine", flag: "🇺🇦" },
  "ae": { "name": "United Arab Emirates", flag: "🇦🇪" },
  "gb": { "name": "United Kingdom", flag: "🇬🇧" },
  "us": { "name": "United States", flag: "🇺🇸" },
  "um": { "name": "United States Minor Outlying Islands", flag: "🇺🇲" },
  "uy": { "name": "Uruguay", flag: "🇺🇾" },
  "uz": { "name": "Uzbekistan", flag: "🇺🇿" },
  "vu": { "name": "Vanuatu", flag: "🇻🇺" },
  "ve": { "name": "Venezuela", flag: "🇻🇪" },
  "vn": { "name": "Viet Nam", flag: "🇻🇳" },
  "vg": { "name": "Virgin Islands, British", flag: "🇻🇬" },
  "vi": { "name": "Virgin Islands, U.S.", flag: "🇻🇮" },
  "wf": { "name": "Wallis and Futuna", flag: "🇼🇫" },
  "eh": { "name": "Western Sahara", flag: "🇪🇭" },
  "ye": { "name": "Yemen", flag: "🇾🇪" },
  "zm": { "name": "Zambia", flag: "🇿🇲" },
  "zw": { "name": "Zimbabwe", flag: "🇿🇼" }
};

class DurianAPI {
  /**
   * Internal helper for GET requests
   */
  async _get(endpoint, params = '') {
    try {
      const url = `${BASE_URL}${endpoint}?${credentialParams}${params ? '&' + params : ''}`;
      console.log(`[Durian API] GET ${endpoint}`);
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`[Durian API] Error in ${endpoint}:`, error.message);
      return { code: 500, msg: "Network error", data: null };
    }
  }

  /**
   * Get main account balance and info
   */
  async getUserInfo() {
    return this._get('getUserInfo');
  }

  /**
   * Request a new phone number
   * @param {string} pid - Project ID (e.g. '0257' for Telegram)
   * @param {string} cuy - Country code (e.g. 'bo', optional)
   */
  async getMobile(pid, cuy = '') {
    // num=1, noblack=0, serial=2 (single)
    const params = `pid=${pid}&num=1&noblack=0&serial=2${cuy ? `&cuy=${cuy}` : ''}`;
    return this._get('getMobile', params);
  }

  /**
   * Check for received SMS code
   * @param {string} pid - Project ID
   * @param {string} pn - Phone number returned from getMobile
   */
  async getMsg(pid, pn) {
    const params = `pid=${pid}&pn=${pn}&serial=2`;
    return this._get('getMsg', params);
  }

  /**
   * Release/cancel a phone number
   */
  async releaseNumber(pid, pn) {
    const params = `pid=${pid}&pn=${pn}&serial=2`;
    return this._get('passMobile', params);
  }

  /**
   * Add a phone number to blacklist (if SMS didn't arrive)
   */
  async blacklistNumber(pid, pn) {
    const params = `pid=${pid}&pn=${pn}`;
    return this._get('addBlack', params);
  }

  /**
   * Query available country distribution
   */
  async getCountryDistribution(pid = null) {
    const params = pid ? `pid=${pid}` : '';
    return this._get('getCountryPhoneNum', params);
  }

  /**
   * Get metadata info for a country code
   */
  getCountryInfo(code) {
    return COUNTRY_MAP[code.toLowerCase()] || { name: code.toUpperCase(), flag: '🏳️' };
  }

  /**
   * Get all supported countries
   */
  getAllCountries() {
    return COUNTRY_MAP;
  }
}

module.exports = new DurianAPI();

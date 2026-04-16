const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const BASE_URL = 'https://api.durianrcs.com/out/ext_api/';
const credentialParams = `name=${process.env.DURIAN_USERNAME}&ApiKey=${process.env.DURIAN_API_KEY}`;

const COUNTRY_MAP = {
  "af": { "name": "Afghanistan", "name_ar": "أفغانستان", "name_fa": "افغانستان", "name_bn": "আফগানিস্তান", "flag": "🇦🇫" },
  "al": { "name": "Albania", "name_ar": "ألبانيا", "name_fa": "آلبانی", "name_bn": "আলবেনিয়া", "flag": "🇦🇱" },
  "dz": { "name": "Algeria", "name_ar": "الجزائر", "name_fa": "الجزایر", "name_bn": "আলজেরিয়া", "flag": "🇩🇿" },
  "as": { "name": "American Samoa", "name_ar": "ساموا الأمريكية", "name_fa": "ساموآی آمریکا", "name_bn": "আমেরিকান সামোয়া", "flag": "🇦🇸" },
  "ad": { "name": "Andorra", "name_ar": "أندورا", "name_fa": "آندورا", "name_bn": "আন্ডোরা", "flag": "🇦🇩" },
  "ao": { "name": "Angola", "name_ar": "أنغولا", "name_fa": "آنگولا", "name_bn": "অ্যাঙ্গোলা", "flag": "🇦🇴" },
  "ai": { "name": "Anguilla", "name_ar": "أنغويلا", "name_fa": "آنگویلا", "name_bn": "অ্যাঙ্গুইলা", "flag": "🇦🇮" },
  "aq": { "name": "Antarctica", "name_ar": "القارة القطبية الجنوبية", "name_fa": "قطب جنوب", "name_bn": "অ্যান্টার্কটিকা", "flag": "🇦🇶" },
  "ag": { "name": "Antigua and Barbuda", "name_ar": "أنتيغوا وبربودا", "name_fa": "آنتیگوا و باربودا", "name_bn": "অ্যান্টিগুয়া ও বারবুডা", "flag": "🇦🇬" },
  "ar": { "name": "Argentina", "name_ar": "الأرجنتين", "name_fa": "آرژانتین", "name_bn": "আর্জেন্টিনা", "flag": "🇦🇷" },
  "am": { "name": "Armenia", "name_ar": "أرمينيا", "name_fa": "ارمنستان", "name_bn": "আর্মেনিয়া", "flag": "🇦🇲" },
  "aw": { "name": "Aruba", "name_ar": "أروبا", "name_fa": "آروبا", "name_bn": "আরুবা", "flag": "🇦🇼" },
  "au": { "name": "Australia", "name_ar": "أستراليا", "name_fa": "استرالیا", "name_bn": "অস্ট্রেলিয়া", "flag": "🇦🇺" },
  "at": { "name": "Austria", "name_ar": "النمسا", "name_fa": "اتریش", "name_bn": "অস্ট্রিয়া", "flag": "🇦🇹" },
  "az": { "name": "Azerbaijan", "name_ar": "أذربيجان", "name_fa": "آذربایجان", "name_bn": "আজারবাইজান", "flag": "🇦🇿" },
  "bs": { "name": "Bahamas", "name_ar": "الباهاما", "name_fa": "باهاما", "name_bn": "বাহামা", "flag": "🇧🇸" },
  "bh": { "name": "Bahrain", "name_ar": "البحرين", "name_fa": "بحرین", "name_bn": "বাহরাইন", "flag": "🇧🇭" },
  "bd": { "name": "Bangladesh", "name_ar": "بنغلاديش", "name_fa": "بنگلادش", "name_bn": "বাংলাদেশ", "flag": "🇧🇩" },
  "bb": { "name": "Barbados", "name_ar": "باربادوس", "name_fa": "باربادوس", "name_bn": "বার্বাডোজ", "flag": "🇧🇧" },
  "by": { "name": "Belarus", "name_ar": "بيلاروسيا", "name_fa": "بلاروس", "name_bn": "বেলারুশ", "flag": "🇧🇾" },
  "be": { "name": "Belgium", "name_ar": "بلجيكا", "name_fa": "بلژیک", "name_bn": "বেলজিয়াম", "flag": "🇧🇪" },
  "bz": { "name": "Belize", "name_ar": "بليز", "name_fa": "بلیز", "name_bn": "বেলিজ", "flag": "🇧🇿" },
  "bj": { "name": "Benin", "name_ar": "بنين", "name_fa": "بنین", "name_bn": "বেনিন", "flag": "🇧🇯" },
  "bm": { "name": "Bermuda", "name_ar": "برمودا", "name_fa": "برمودا", "name_bn": "বারমুডা", "flag": "🇧🇲" },
  "bt": { "name": "Bhutan", "name_ar": "بوتان", "name_fa": "بوتان", "name_bn": "ভুটান", "flag": "🇧🇹" },
  "bo": { "name": "Bolivia", "name_ar": "بوليفيا", "name_fa": "بولیوی", "name_bn": "বলিভিয়া", "flag": "🇧🇴" },
  "ba": { "name": "Bosnia and Herzegovina", "name_ar": "البوسنة والهرسك", "name_fa": "بوسنی و هرزگوین", "name_bn": "বসনিয়া ও হার্জেগোভিনা", "flag": "🇧🇦" },
  "bw": { "name": "Botswana", "name_ar": "بوتسوانا", "name_fa": "بوتسوانا", "name_bn": "বতসোয়ানা", "flag": "🇧🇼" },
  "bv": { "name": "Bouvet Island", "name_ar": "جزيرة بوفيه", "name_fa": "جزیره بووه", "name_bn": "বুভেট দ্বীপ", "flag": "🇧🇻" },
  "br": { "name": "Brazil", "name_ar": "البرازيل", "name_fa": "برزیل", "name_bn": "ব্রাজিল", "flag": "🇧🇷" },
  "io": { "name": "British Indian Ocean Territory", "name_ar": "إقليم المحيط الهندي البريطاني", "name_fa": "قلمرو اقیانوس هند بریتانیا", "name_bn": "ব্রিটিশ ভারত মহাসাগরীয় অঞ্চল", "flag": "🇮🇴" },
  "bn": { "name": "Brunei Darussalam", "name_ar": "بروناي", "name_fa": "برونئی", "name_bn": "ব্রুনাই", "flag": "🇧🇳" },
  "bg": { "name": "Bulgaria", "name_ar": "بلغاريا", "name_fa": "بلغارستان", "name_bn": "বুলগেরিয়া", "flag": "🇧🇬" },
  "bf": { "name": "Burkina Faso", "name_ar": "بوركينا فاسو", "name_fa": "بورکینافاسو", "name_bn": "বুরকিনা ফাসো", "flag": "🇧🇫" },
  "bi": { "name": "Burundi", "name_ar": "بوروندي", "name_fa": "بوروندی", "name_bn": "বুরুন্ডি", "flag": "🇧🇮" },
  "kh": { "name": "Cambodia", "name_ar": "كمبوديا", "name_fa": "کامبوج", "name_bn": "কম্বোডিয়া", "flag": "🇰🇭" },
  "cm": { "name": "Cameroon", "name_ar": "الكاميرون", "name_fa": "کامرون", "name_bn": "ক্যামেরুন", "flag": "🇨🇲" },
  "ca": { "name": "Canada", "name_ar": "كندا", "name_fa": "کانادا", "name_bn": "কানাডা", "flag": "🇨🇦" },
  "cv": { "name": "Cape Verde", "name_ar": "الرأس الأخضر", "name_fa": "کیپ ورد", "name_bn": "কেপ ভার্দে", "flag": "🇨🇻" },
  "ky": { "name": "Cayman Islands", "name_ar": "جزر كايمان", "name_fa": "جزایر کیمن", "name_bn": "কেম্যান দ্বীপপুঞ্জ", "flag": "🇰🇾" },
  "cf": { "name": "Central African Republic", "name_ar": "جمهورية أفريقيا الوسطى", "name_fa": "جمهوری آفریقای مرکزی", "name_bn": "মধ্য আফ্রিকান প্রজাতন্ত্র", "flag": "🇨🇫" },
  "td": { "name": "Chad", "name_ar": "تشاد", "name_fa": "چاد", "name_bn": "চাদ", "flag": "🇹🇩" },
  "cl": { "name": "Chile", "name_ar": "تشيلي", "name_fa": "شیلی", "name_bn": "চিলি", "flag": "🇨🇱" },
  "cn": { "name": "China", "name_ar": "الصين", "name_fa": "چین", "name_bn": "চীন", "flag": "🇨🇳" },
  "cx": { "name": "Christmas Island", "name_ar": "جزيرة الكريسماس", "name_fa": "جزیره کریسمس", "name_bn": "ক্রিসমাস দ্বীপ", "flag": "🇨🇽" },
  "cc": { "name": "Cocos (Keeling) Islands", "name_ar": "جزر كوكوس", "name_fa": "جزایر کوکوس", "name_bn": "কোকোস দ্বীপপুঞ্জ", "flag": "🇨🇨" },
  "co": { "name": "Colombia", "name_ar": "كولومبيا", "name_fa": "کلمبیا", "name_bn": "কলম্বিয়া", "flag": "🇨🇴" },
  "km": { "name": "Comoros", "name_ar": "جزر القمر", "name_fa": "کومور", "name_bn": "কমোরোস", "flag": "🇰🇲" },
  "cg": { "name": "Congo", "name_ar": "الكونغو", "name_fa": "کنگو", "name_bn": "কঙ্গো", "flag": "🇨🇬" },
  "cd": { "name": "Congo, Democratic Republic of the", "name_ar": "جمهورية الكونغو الديمقراطية", "name_fa": "جمهوری دموکراتیک کنگو", "name_bn": "কঙ্গো প্রজাতন্ত্র", "flag": "🇨🇩" },
  "ck": { "name": "Cook Islands", "name_ar": "جزر كوك", "name_fa": "جزایر کوک", "name_bn": "কুক দ্বীপপুঞ্জ", "flag": "🇨🇰" },
  "cr": { "name": "Costa Rica", "name_ar": "كوستاريكا", "name_fa": "کاستاریکا", "name_bn": "কোস্টারিকা", "flag": "🇨🇷" },
  "ci": { "name": "Cote D'Ivoire", "name_ar": "ساحل العاج", "name_fa": "ساحل عاج", "name_bn": "আইভরি কোস্ট", "flag": "🇨🇮" },
  "hr": { "name": "Croatia", "name_ar": "كرواتيا", "name_fa": "کرواسی", "name_bn": "ক্রোয়েশিয়া", "flag": "🇭🇷" },
  "cu": { "name": "Cuba", "name_ar": "كوبا", "name_fa": "کوبا", "name_bn": "কিউবা", "flag": "🇨🇺" },
  "cy": { "name": "Cyprus", "name_ar": "قبرص", "name_fa": "قبرس", "name_bn": "সাইপ্রাস", "flag": "🇨🇾" },
  "cz": { "name": "Czech Republic", "name_ar": "جمهورية التشيك", "name_fa": "جمهوری چک", "name_bn": "চেক প্রজাতন্ত্র", "flag": "🇨🇿" },
  "dk": { "name": "Denmark", "name_ar": "الدنمارك", "name_fa": "دانمارک", "name_bn": "ডেনমার্ক", "flag": "🇩🇰" },
  "dj": { "name": "Djibouti", "name_ar": "جيبوتي", "name_fa": "جیبوتی", "name_bn": "জিবুতি", "flag": "🇩🇯" },
  "dm": { "name": "Dominica", "name_ar": "دومينيكا", "name_fa": "دومینیکا", "name_bn": "ডোমিনিকা", "flag": "🇩🇲" },
  "do": { "name": "Dominican Republic", "name_ar": "جمهورية الدومينيكان", "name_fa": "جمهوری دومینیکن", "name_bn": "ডোমিনিকান প্রজাতন্ত্র", "flag": "🇩🇴" },
  "ec": { "name": "Ecuador", "name_ar": "الإكوادور", "name_fa": "اکوادور", "name_bn": "ইকুয়েডর", "flag": "🇪🇨" },
  "eg": { "name": "Egypt", "name_ar": "مصر", "name_fa": "مصر", "name_bn": "মিশর", "flag": "🇪🇬" },
  "sv": { "name": "El Salvador", "name_ar": "السلفادور", "name_fa": "السالوادور", "name_bn": "এল সালভাদর", "flag": "🇸🇻" },
  "gq": { "name": "Equatorial Guinea", "name_ar": "غينيا الاستوائية", "name_fa": "گینه استوایی", "name_bn": "নিরক্ষীয় গিনি", "flag": "🇬🇶" },
  "er": { "name": "Eritrea", "name_ar": "إريتريا", "name_fa": "اریتره", "name_bn": "ইরিত্রিয়া", "flag": "🇪🇷" },
  "ee": { "name": "Estonia", "name_ar": "إستونيا", "name_fa": "استونی", "name_bn": "এস্তোনিয়া", "flag": "🇪🇪" },
  "et": { "name": "Ethiopia", "name_ar": "إثيوبيا", "name_fa": "اتیوپی", "name_bn": "ইথিওপিয়া", "flag": "🇪🇹" },
  "fk": { "name": "Falkland Islands (Malvinas)", "name_ar": "جزر فوكلاند", "name_fa": "جزایر فالکلند", "name_bn": "ফকল্যান্ড দ্বীপপুঞ্জ", "flag": "🇫🇰" },
  "fo": { "name": "Faroe Islands", "name_ar": "جزر فارو", "name_fa": "جزایر فارو", "name_bn": "ফ্যারো দ্বীপপুঞ্জ", "flag": "🇫🇴" },
  "fj": { "name": "Fiji", "name_ar": "فيجي", "name_fa": "فیجی", "name_bn": "ফিজি", "flag": "🇫🇯" },
  "fi": { "name": "Finland", "name_ar": "فنلندا", "name_fa": "فنلاند", "name_bn": "ফিনল্যান্ড", "flag": "🇫🇮" },
  "fr": { "name": "France", "name_ar": "فرنسا", "name_fa": "فرانسه", "name_bn": "ফ্রান্স", "flag": "🇫🇷" },
  "gf": { "name": "French Guiana", "name_ar": "غويانا الفرنسية", "name_fa": "گویان فرانسه", "name_bn": "ফরাসি গায়ানা", "flag": "🇬🇫" },
  "pf": { "name": "French Polynesia", "name_ar": "بولينيزيا الفرنسية", "name_fa": "پلی نزی فرانسه", "name_bn": "ফরাসি পলিনেশিয়া", "flag": "🇵🇫" },
  "tf": { "name": "French Southern Territories", "name_ar": "الأقاليم الجنوبية الفرنسية", "name_fa": "سرزمین‌های جنوبی فرانسه", "name_bn": "ফরাসি দক্ষিণাঞ্চল", "flag": "🇹🇫" },
  "ga": { "name": "Gabon", "name_ar": "الغابون", "name_fa": "گابن", "name_bn": "গ্যাবন", "flag": "🇬🇦" },
  "gm": { "name": "Gambia", "name_ar": "غامبيا", "name_fa": "گامبیا", "name_bn": "গাম্বিয়া", "flag": "🇬🇲" },
  "ge": { "name": "Georgia", "name_ar": "جورجيا", "name_fa": "گرجستان", "name_bn": "জর্জিয়া", "flag": "🇬🇪" },
  "de": { "name": "Germany", "name_ar": "ألمانيا", "name_fa": "آلمان", "name_bn": "জার্মানি", "flag": "🇩🇪" },
  "gh": { "name": "Ghana", "name_ar": "غانا", "name_fa": "غنا", "name_bn": "ঘানা", "flag": "🇬🇭" },
  "gi": { "name": "Gibraltar", "name_ar": "جبل طارق", "name_fa": "جبل الطارق", "name_bn": "জিব্রাল্টার", "flag": "🇬🇮" },
  "gr": { "name": "Greece", "name_ar": "اليونان", "name_fa": "یونان", "name_bn": "গ্রিস", "flag": "🇬🇷" },
  "gl": { "name": "Greenland", "name_ar": "جرينلاند", "name_fa": "گرینلند", "name_bn": "গ্রিনল্যান্ড", "flag": "🇬🇱" },
  "gd": { "name": "Grenada", "name_ar": "غرينادا", "name_fa": "گرنادا", "name_bn": "গ্রেনাডা", "flag": "🇬🇩" },
  "gp": { "name": "Guadeloupe", "name_ar": "غوادلوب", "name_fa": "گوادلوپ", "name_bn": "গুয়াদেলুপ", "flag": "🇬🇵" },
  "gu": { "name": "Guam", "name_ar": "غوام", "name_fa": "گوام", "name_bn": "গুয়াম", "flag": "🇬🇺" },
  "gt": { "name": "Guatemala", "name_ar": "غواتيمالا", "name_fa": "گواتمالا", "name_bn": "গুয়াতেমালা", "flag": "🇬🇹" },
  "gg": { "name": "Guernsey", "name_ar": "غيرنزي", "name_fa": "گرنزی", "name_bn": "গার্নসি", "flag": "🇬🇬" },
  "gn": { "name": "Guinea", "name_ar": "غينيا", "name_fa": "گینه", "name_bn": "গিনি", "flag": "🇬🇳" },
  "gw": { "name": "Guinea-Bissau", "name_ar": "غينيا بيساو", "name_fa": "گینه بیسائو", "name_bn": "গিনি-বিসাউ", "flag": "🇬🇼" },
  "gy": { "name": "Guyana", "name_ar": "غويانا", "name_fa": "گویان", "name_bn": "গিয়ানা", "flag": "🇬🇾" },
  "ht": { "name": "Haiti", "name_ar": "هايتي", "name_fa": "هائیتی", "name_bn": "হাইতি", "flag": "🇭🇹" },
  "hm": { "name": "Heard Island and Mcdonald Islands", "name_ar": "جزيرة هيرد وجزر ماكدونالد", "name_fa": "جزیره هرد و مک‌دونالد", "name_bn": "হার্ড এবং ম্যাকডোনাল্ড দ্বীপপুঞ্জ", "flag": "🇭🇲" },
  "va": { "name": "Holy See (Vatican City State)", "name_ar": "الفاتيكان", "name_fa": "واتیکان", "name_bn": "ভ্যাটিকান", "flag": "🇻🇦" },
  "hn": { "name": "Honduras", "name_ar": "هندوراس", "name_fa": "هندوراس", "name_bn": "হন্ডুরাস", "flag": "🇭🇳" },
  "hk": { "name": "Hong Kong", "name_ar": "هونغ كونغ", "name_fa": "هنگ کنگ", "name_bn": "হংকং", "flag": "🇭🇰" },
  "hu": { "name": "Hungary", "name_ar": "المجر", "name_fa": "مجارستان", "name_bn": "হাঙ্গেরি", "flag": "🇭🇺" },
  "is": { "name": "Iceland", "name_ar": "آيسلندا", "name_fa": "ایسلند", "name_bn": "আইসল্যান্ড", "flag": "🇮🇸" },
  "in": { "name": "India", "name_ar": "الهند", "name_fa": "هند", "name_bn": "ভারত", "flag": "🇮🇳" },
  "id": { "name": "Indonesia", "name_ar": "إندونيسيا", "name_fa": "اندونزی", "name_bn": "ইন্দোনেশিয়া", "flag": "🇮🇩" },
  "ir": { "name": "Iran, Islamic Republic Of", "name_ar": "إيران", "name_fa": "ایران", "name_bn": "ইরান", "flag": "🇮🇷" },
  "iq": { "name": "Iraq", "name_ar": "العراق", "name_fa": "عراق", "name_bn": "ইরাক", "flag": "🇮🇶" },
  "ie": { "name": "Ireland", "name_ar": "أيرلندا", "name_fa": "ایرلند", "name_bn": "আয়ারল্যান্ড", "flag": "🇮🇪" },
  "im": { "name": "Isle of Man", "name_ar": "جزيرة مان", "name_fa": "جزیره من", "name_bn": "আইল অফ ম্যান", "flag": "🇮🇲" },
  "il": { "name": "Israel", "name_ar": "إسرائيل", "name_fa": "اسرائیل", "name_bn": "ইসরায়েল", "flag": "🇮🇱" },
  "it": { "name": "Italy", "name_ar": "إيطاليا", "name_fa": "ایتالیا", "name_bn": "ইতালি", "flag": "🇮🇹" },
  "jm": { "name": "Jamaica", "name_ar": "جامايكا", "name_fa": "جامائیکا", "name_bn": "জ্যামাইকা", "flag": "🇯🇲" },
  "jp": { "name": "Japan", "name_ar": "اليابان", "name_fa": "ژاپن", "name_bn": "জাপান", "flag": "🇯🇵" },
  "je": { "name": "Jersey", "name_ar": "جيرزي", "name_fa": "جرزی", "name_bn": "জার্সি", "flag": "🇯🇪" },
  "jo": { "name": "Jordan", "name_ar": "الأردن", "name_fa": "اردن", "name_bn": "জর্ডান", "flag": "🇯🇴" },
  "kz": { "name": "Kazakhstan", "name_ar": "كازاخستان", "name_fa": "قزاقستان", "name_bn": "কাজাখস্তান", "flag": "🇰🇿" },
  "ke": { "name": "Kenya", "name_ar": "كينيا", "name_fa": "کنیا", "name_bn": "কেনিয়া", "flag": "🇰🇪" },
  "ki": { "name": "Kiribati", "name_ar": "كيريباتي", "name_fa": "کیریباتی", "name_bn": "কিরিবাতি", "flag": "🇰🇮" },
  "kp": { "name": "Korea, Democratic People\'s Republic of", "name_ar": "كوريا الشمالية", "name_fa": "کره شمالی", "name_bn": "উত্তর কোরিয়া", "flag": "🇰🇵" },
  "kr": { "name": "Korea, Republic of", "name_ar": "كوريا الجنوبية", "name_fa": "کره جنوبی", "name_bn": "দক্ষিণ কোরিয়া", "flag": "🇰🇷" },
  "kw": { "name": "Kuwait", "name_ar": "الكويت", "name_fa": "کویت", "name_bn": "কুয়েত", "flag": "🇰🇼" },
  "kg": { "name": "Kyrgyzstan", "name_ar": "قيرغيزستان", "name_fa": "قرقیزستان", "name_bn": "কিরঘিজস্তান", "flag": "🇰🇬" },
  "la": { "name": "Lao People\'s Democratic Republic", "name_ar": "لاوس", "name_fa": "لائوس", "name_bn": "লাওস", "flag": "🇱🇦" },
  "lv": { "name": "Latvia", "name_ar": "لاتفيا", "name_fa": "لتونی", "name_bn": "লাটভিয়া", "flag": "🇱🇻" },
  "lb": { "name": "Lebanon", "name_ar": "لبنان", "name_fa": "لبنان", "name_bn": "লেবানন", "flag": "🇱🇧" },
  "ls": { "name": "Lesotho", "name_ar": "ليسوتو", "name_fa": "لسوتو", "name_bn": "লেসোথো", "flag": "🇱🇸" },
  "lr": { "name": "Liberia", "name_ar": "ليبيريا", "name_fa": "لیبریا", "name_bn": "লাইবেরিয়া", "flag": "🇱🇷" },
  "ly": { "name": "Libyan Arab Jamahiriya", "name_ar": "ليبيا", "name_fa": "لیبی", "name_bn": "লিবিয়া", "flag": "🇱🇾" },
  "li": { "name": "Liechtenstein", "name_ar": "ليختنشتاين", "name_fa": "لیختن اشتاین", "name_bn": "লিশটেনস্টাইন", "flag": "🇱🇮" },
  "lt": { "name": "Lithuania", "name_ar": "ليتوانيا", "name_fa": "لیتوانی", "name_bn": "লিথুয়ানিয়া", "flag": "🇱🇹" },
  "lu": { "name": "Luxembourg", "name_ar": "لوكسمبورغ", "name_fa": "لوکزامبورگ", "name_bn": "লুক্সেমবার্গ", "flag": "🇱🇺" },
  "mo": { "name": "Macao", "name_ar": "ماكاو", "name_fa": "ماکائو", "name_bn": "ম্যাকাও", "flag": "🇲🇴" },
  "mk": { "name": "Macedonia, The Former Yugoslav Republic of", "name_ar": "مقدونيا", "name_fa": "مقدونیه", "name_bn": "ম্যাসেডোনিয়া", "flag": "🇲🇰" },
  "mg": { "name": "Madagascar", "name_ar": "مدغشقر", "name_fa": "ماداگاسکار", "name_bn": "মাদাগাস্কার", "flag": "🇲🇬" },
  "mw": { "name": "Malawi", "name_ar": "مالاوي", "name_fa": "مالاوی", "name_bn": "মালাউই", "flag": "🇲🇼" },
  "my": { "name": "Malaysia", "name_ar": "ماليزيا", "name_fa": "مالزی", "name_bn": "মালয়েশিয়া", "flag": "🇲🇾" },
  "mv": { "name": "Maldives", "name_ar": "المالديف", "name_fa": "مالدیو", "name_bn": "মালদ্বীপ", "flag": "🇲🇻" },
  "ml": { "name": "Mali", "name_ar": "مالي", "name_fa": "مالی", "name_bn": "মালি", "flag": "🇲🇱" },
  "mt": { "name": "Malta", "name_ar": "مالطا", "name_fa": "مالت", "name_bn": "মাল্টা", "flag": "🇲🇹" },
  "mh": { "name": "Marshall Islands", "name_ar": "جزر مارشال", "name_fa": "جزایر مارشال", "name_bn": "মার্শাল দ্বীপপুঞ্জ", "flag": "🇲🇭" },
  "mq": { "name": "Martinique", "name_ar": "مارتينيك", "name_fa": "مارتینيك", "name_bn": "মার্টিনিক", "flag": "🇲🇶" },
  "mr": { "name": "Mauritania", "name_ar": "موريتانيا", "name_fa": "موریتانی", "name_bn": "মৌরিতানিয়া", "flag": "🇲🇷" },
  "mu": { "name": "Mauritius", "name_ar": "موريشيوس", "name_fa": "موریس", "name_bn": "মরিশাস", "flag": "🇲🇺" },
  "yt": { "name": "Mayotte", "name_ar": "مايوت", "name_fa": "مایوت", "name_bn": "মায়োত", "flag": "🇾🇹" },
  "mx": { "name": "Mexico", "name_ar": "المكسيك", "name_fa": "مکزیک", "name_bn": "মেক্সিকো", "flag": "🇲🇽" },
  "fm": { "name": "Micronesia, Federated States of", "name_ar": "ميكرونيزيا", "name_fa": "میکرونزی", "name_bn": "মাইক্রোনেশিয়া", "flag": "🇫🇲" },
  "md": { "name": "Moldova, Republic of", "name_ar": "مولدوفا", "name_fa": "مولداوی", "name_bn": "মলদোভা", "flag": "🇲🇩" },
  "mc": { "name": "Monaco", "name_ar": "موناكو", "name_fa": "موناکو", "name_bn": "মোনাকো", "flag": "🇲🇨" },
  "mn": { "name": "Mongolia", "name_ar": "منغوليا", "name_fa": "مغولستان", "name_bn": "মঙ্গোলিয়া", "flag": "🇲🇳" },
  "me": { "name": "Montenegro", "name_ar": "الجبل الأسود", "name_fa": "مونته نگرو", "name_bn": "মন্টিনিগ্রো", "flag": "🇲🇪" },
  "ms": { "name": "Montserrat", "name_ar": "مونتسرات", "name_fa": "مونتسرات", "name_bn": "মন্টসেরাট", "flag": "🇲🇸" },
  "ma": { "name": "Morocco", "name_ar": "المغرب", "name_fa": "مراکش", "name_bn": "মরক্কো", "flag": "🇲🇦" },
  "mz": { "name": "Mozambique", "name_ar": "موزمبيق", "name_fa": "موزامبیک", "name_bn": "মোজাম্বিক", "flag": "🇲🇿" },
  "mm": { "name": "Myanmar", "name_ar": "ميانمار", "name_fa": "میانمار", "name_bn": "মিয়ানمار", "flag": "🇲🇲" },
  "na": { "name": "Namibia", "name_ar": "ناميبيا", "name_fa": "نامیبیا", "name_bn": "নামিবিয়া", "flag": "🇳🇦" },
  "nr": { "name": "Nauru", "name_ar": "ناورو", "name_fa": "نائورو", "name_bn": "নাউরু", "flag": "🇳🇷" },
  "np": { "name": "Nepal", "name_ar": "نيبال", "name_fa": "نپال", "name_bn": "নেপাল", "flag": "🇳🇵" },
  "nl": { "name": "Netherlands", "name_ar": "هولندا", "name_fa": "هلند", "name_bn": "নেদারল্যান্ডস", "flag": "🇳🇱" },
  "an": { "name": "Netherlands Antilles", "name_ar": "جزر الأنتيل الهولندية", "name_fa": "آنتیل هلند", "name_bn": "নেদারল্যান্ডস এন্টিলস", "flag": "🇦🇳" },
  "nc": { "name": "New Caledonia", "name_ar": "كاليدونيا الجديدة", "name_fa": "کالدونیای جدید", "name_bn": "নিউ ক্যালেডোনিয়া", "flag": "🇳🇨" },
  "nz": { "name": "New Zealand", "name_ar": "نيوزيلندا", "name_fa": "نیوزیلند", "name_bn": "নিউজিল্যান্ড", "flag": "🇳🇿" },
  "ni": { "name": "Nicaragua", "name_ar": "نيكاراغوا", "name_fa": "نیکاراگوئه", "name_bn": "নিকারাগুয়া", "flag": "🇳🇮" },
  "ne": { "name": "Niger", "name_ar": "النيجر", "name_fa": "نیجر", "name_bn": "নাইজার", "flag": "🇳🇪" },
  "ng": { "name": "Nigeria", "name_ar": "نيجيريا", "name_fa": "نیجریه", "name_bn": "নাইজেরিয়া", "flag": "🇳🇬" },
  "nu": { "name": "Niue", "name_ar": "نييوي", "name_fa": "نیووی", "name_bn": "নিউয়ে", "flag": "🇳🇺" },
  "nf": { "name": "Norfolk Island", "name_ar": "جزيرة نورفولك", "name_fa": "جزیره نورفولک", "name_bn": "নরফোক দ্বীপ", "flag": "🇳🇫" },
  "mp": { "name": "Northern Mariana Islands", "name_ar": "جزر ماريانا الشمالية", "name_fa": "جزایر ماریانای شمالی", "name_bn": "উত্তর মারিয়ানা দ্বীপপুঞ্জ", "flag": "🇲🇵" },
  "no": { "name": "Norway", "name_ar": "النرويج", "name_fa": "نروژ", "name_bn": "নরওয়ে", "flag": "🇳🇴" },
  "om": { "name": "Oman", "name_ar": "عُمان", "name_fa": "عمان", "name_bn": "ওমান", "flag": "🇴🇲" },
  "pk": { "name": "Pakistan", "name_ar": "باكستان", "name_fa": "پاکستان", "name_bn": "পাকিস্তান", "flag": "🇵🇰" },
  "pw": { "name": "Palau", "name_ar": "بالاو", "name_fa": "پالائو", "name_bn": "পালাউ", "flag": "🇵🇼" },
  "ps": { "name": "Palestinian Territory, Occupied", "name_ar": "فلسطين", "name_fa": "فلسطین", "name_bn": "ফিলিস্তিন", "flag": "🇵🇸" },
  "pa": { "name": "Panama", "name_ar": "بنما", "name_fa": "پاناما", "name_bn": "পানামা", "flag": "🇵🇦" },
  "pg": { "name": "Papua New Guinea", "name_ar": "بابوا غينيا الجديدة", "name_fa": "پاپوآ گینه نو", "name_bn": "পাপুয়া নিউ গিনি", "flag": "🇵🇬" },
  "py": { "name": "Paraguay", "name_ar": "باراغواي", "name_fa": "پاراگوئه", "name_bn": "প্যারাগুয়ে", "flag": "🇵🇾" },
  "pe": { "name": "Peru", "name_ar": "بيرو", "name_fa": "پرو", "name_bn": "পেরু", "flag": "🇵🇪" },
  "ph": { "name": "Philippines", "name_ar": "الفلبين", "name_fa": "فیلیپین", "name_bn": "ফিলিপাইন", "flag": "🇵🇭" },
  "pn": { "name": "Pitcairn", "name_ar": "جزر بيتكيرن", "name_fa": "جزایر پیتکرن", "name_bn": "পিটকেয়ার্ন", "flag": "🇵🇳" },
  "pl": { "name": "Poland", "name_ar": "بولندا", "name_fa": "لهستان", "name_bn": "পোল্যান্ড", "flag": "🇵🇱" },
  "pt": { "name": "Portugal", "name_ar": "البرتغال", "name_fa": "پرتغال", "name_bn": "পর্তুগাল", "flag": "🇵🇹" },
  "pr": { "name": "Puerto Rico", "name_ar": "بورتوريكو", "name_fa": "پورتوریکو", "name_bn": "পুয়ের্তো রিকো", "flag": "🇵🇷" },
  "qa": { "name": "Qatar", "name_ar": "قطر", "name_fa": "قطر", "name_bn": "কাতার", "flag": "🇶🇦" },
  "re": { "name": "Reunion", "name_ar": "لا ريونيون", "name_fa": "رئونیون", "name_bn": "রিইউনিয়ন", "flag": "🇷🇪" },
  "ro": { "name": "Romania", "name_ar": "رومانيا", "name_fa": "رومانی", "name_bn": "রোমানিয়া", "flag": "🇷🇴" },
  "ru": { "name": "Russian Federation", "name_ar": "روسيا", "name_fa": "روسیه", "name_bn": "রাশিয়া", "flag": "🇷🇺" },
  "rw": { "name": "Rwanda", "name_ar": "رواندا", "name_fa": "رواندا", "name_bn": "রুয়ান্ডা", "flag": "🇷🇼" },
  "sh": { "name": "Saint Helena", "name_ar": "سانت هيلينا", "name_fa": "سنت هلن", "name_bn": "সেন্ট হেলেনা", "flag": "🇸🇭" },
  "kn": { "name": "Saint Kitts and Nevis", "name_ar": "سانت كيتس ونيفيس", "name_fa": "سنت کیتس و نویس", "name_bn": "সেন্ট কিটস ও নেভিস", "flag": "🇰🇳" },
  "lc": { "name": "Saint Lucia", "name_ar": "سانت لوسيا", "name_fa": "سنت لوسیا", "name_bn": "সেন্ট লুসিয়া", "flag": "🇱🇨" },
  "pm": { "name": "Saint Pierre and Miquelon", "name_ar": "سان بيير وميكلون", "name_fa": "سنت پیر و میکلون", "name_bn": "সেন্ট পিয়ের ও মিকুয়েলন", "flag": "🇵🇲" },
  "vc": { "name": "Saint Vincent and the Grenadines", "name_ar": "سانت فنسنت والغرينادين", "name_fa": "سنت وینسنت و گرنادین‌ها", "name_bn": "সেন্ট ভিনসেন্ট ও গ্রেনাডাইনস", "flag": "🇻🇨" },
  "ws": { "name": "Samoa", "name_ar": "ساموا", "name_fa": "ساموآ", "name_bn": "সামোয়া", "flag": "🇼🇸" },
  "sm": { "name": "San Marino", "name_ar": "سان مارينو", "name_fa": "سان مارینو", "name_bn": "সান মারিনো", "flag": "🇸🇲" },
  "st": { "name": "Sao Tome and Principe", "name_ar": "ساو تومي وبرينسيب", "name_fa": "سائوتومه و پرنسیپ", "name_bn": "সাও টোমে ও প্রিন্সিপি", "flag": "🇸🇹" },
  "sa": { "name": "Saudi Arabia", "name_ar": "السعودية", "name_fa": "عربستان", "name_bn": "সৌদি আরব", "flag": "🇸🇦" },
  "sn": { "name": "Senegal", "name_ar": "السنغال", "name_fa": "سنگال", "name_bn": "সেনেগাল", "flag": "🇸🇳" },
  "rs": { "name": "Serbia", "name_ar": "صربيا", "name_fa": "صربستان", "name_bn": "সার্বিয়া", "flag": "🇷🇸" },
  "sc": { "name": "Seychelles", "name_ar": "سيشل", "name_fa": "سیشل", "name_bn": "সেশেলস", "flag": "🇸🇨" },
  "sl": { "name": "Sierra Leone", "name_ar": "سيراليون", "name_fa": "سیرالئون", "name_bn": "সিয়েরা লিওন", "flag": "🇸🇱" },
  "sg": { "name": "Singapore", "name_ar": "سنغافورة", "name_fa": "سنگاپور", "name_bn": "সিঙ্গাপুর", "flag": "🇸🇬" },
  "sk": { "name": "Slovakia", "name_ar": "سلوفاكيا", "name_fa": "اسلواکی", "name_bn": "স্লোভাকিয়া", "flag": "🇸🇰" },
  "si": { "name": "Slovenia", "name_ar": "سلوفينيا", "name_fa": "اسلوونی", "name_bn": "স্লোভেনিয়া", "flag": "🇸🇮" },
  "sb": { "name": "Solomon Islands", "name_ar": "جزر سليمان", "name_fa": "جزایر سلیمان", "name_bn": "সলোমন দ্বীপপুঞ্জ", "flag": "🇸🇧" },
  "so": { "name": "Somalia", "name_ar": "الصومال", "name_fa": "سومالی", "name_bn": "সোমালিয়া", "flag": "🇸🇴" },
  "za": { "name": "South Africa", "name_ar": "جنوب أفريقيا", "name_fa": "آفریقای جنوبی", "name_bn": "দক্ষিণ আফ্রিকা", "flag": "🇿🇦" },
  "gs": { "name": "South Georgia and the South Sandwich Islands", "name_ar": "جورجيا الجنوبية وجزر ساندويتش الجنوبية", "name_fa": "جورجیای جنوبی و جزایر ساندویچ جنوبی", "name_bn": "দক্ষিণ জর্জিয়া ও দক্ষিণ স্যান্ডউইচ দ্বীপপুঞ্জ", "flag": "🇬🇸" },
  "es": { "name": "Spain", "name_ar": "إسبانيا", "name_fa": "اسپانیا", "name_bn": "স্পেন", "flag": "🇪🇸" },
  "lk": { "name": "Sri Lanka", "name_ar": "سريلانكا", "name_fa": "سری‌لانکا", "name_bn": "শ্রীলঙ্কা", "flag": "🇱🇰" },
  "sd": { "name": "Sudan", "name_ar": "السودان", "name_fa": "سودان", "name_bn": "সুদান", "flag": "🇸🇩" },
  "sr": { "name": "Suriname", "name_ar": "سورينام", "name_fa": "سورینام", "name_bn": "সুরিনাম", "flag": "🇸🇷" },
  "sj": { "name": "Svalbard and Jan Mayen", "name_ar": "سفالبارد ويان ماين", "name_fa": "سوالبارد و یان ماین", "name_bn": "স্বালবার্ড ও জান মায়েন", "flag": "🇸🇯" },
  "sz": { "name": "Swaziland", "name_ar": "إسواتيني", "name_fa": "سوازیلند", "name_bn": "ইসোয়াতিনি", "flag": "🇸🇿" },
  "se": { "name": "Sweden", "name_ar": "السويد", "name_fa": "سوئد", "name_bn": "সুইডেন", "flag": "🇸🇪" },
  "ch": { "name": "Switzerland", "name_ar": "سويسرا", "name_fa": "سوئیس", "name_bn": "সুইজারল্যান্ড", "flag": "🇨🇭" },
  "sy": { "name": "Syrian Arab Republic", "name_ar": "سوريا", "name_fa": "سوریه", "name_bn": "সিরিয়া", "flag": "🇸🇾" },
  "tw": { "name": "Taiwan, Province of China", "name_ar": "تايوان", "name_fa": "تایوان", "name_bn": "তাইওয়ান", "flag": "🇹🇼" },
  "tj": { "name": "Tajikistan", "name_ar": "طاجيكستان", "name_fa": "تاجیکستان", "name_bn": "তাজিকিস্তান", "flag": "🇹🇯" },
  "tz": { "name": "Tanzania, United Republic of", "name_ar": "تنزانيا", "name_fa": "تانزانیا", "name_bn": "তাঞ্জানিয়া", "flag": "🇹🇿" },
  "th": { "name": "Thailand", "name_ar": "تايلاند", "name_fa": "تایلند", "name_bn": "থাইল্যান্ড", "flag": "🇹🇭" },
  "tl": { "name": "Timor-Leste", "name_ar": "تيمور الشرقية", "name_fa": "تیمور شرقی", "name_bn": "পূর্ব তিমুর", "flag": "🇹🇱" },
  "tg": { "name": "Togo", "name_ar": "توغو", "name_fa": "توگو", "name_bn": "টোগো", "flag": "🇹🇬" },
  "tk": { "name": "Tokelau", "name_ar": "توكيلاو", "name_fa": "توکلائو", "name_bn": "টোকেলাউ", "flag": "🇹🇰" },
  "to": { "name": "Tonga", "name_ar": "تونغا", "name_fa": "تونگا", "name_bn": "টোঙ্গা", "flag": "🇹🇴" },
  "tt": { "name": "Trinidad and Tobago", "name_ar": "ترينيداد وتوباغو", "name_fa": "ترینیداد و توباگو", "name_bn": "ত্রিনিদাদ ও টোবাগো", "flag": "🇹🇹" },
  "tn": { "name": "Tunisia", "name_ar": "تونس", "name_fa": "تونس", "name_bn": "তিউনিসিয়া", "flag": "🇹🇳" },
  "tr": { "name": "Turkey", "name_ar": "تركيا", "name_fa": "ترکیه", "name_bn": "তুরস্ক", "flag": "🇹🇷" },
  "tm": { "name": "Turkmenistan", "name_ar": "تركمانستان", "name_fa": "ترکمنستان", "name_bn": "তুর্কমেনিস্তান", "flag": "🇹🇲" },
  "tc": { "name": "Turks and Caicos Islands", "name_ar": "جزر توركس وكايكوس", "name_fa": "جزایر تورکس و کایکوس", "name_bn": "টার্কস ও কাইকোস দ্বীপপুঞ্জ", "flag": "🇹🇨" },
  "tv": { "name": "Tuvalu", "name_ar": "توفالو", "name_fa": "تووالو", "name_bn": "টুভালু", "flag": "🇹🇻" },
  "ug": { "name": "Uganda", "name_ar": "أوغندا", "name_fa": "اوگاندا", "name_bn": "উগান্ডা", "flag": "🇺🇬" },
  "ua": { "name": "Ukraine", "name_ar": "أوكرانيا", "name_fa": "اوکراین", "name_bn": "ইউক্রেন", "flag": "🇺🇦" },
  "ae": { "name": "United Arab Emirates", "name_ar": "الإمارات العربية المتحدة", "name_fa": "امارات متحده عربی", "name_bn": "সংযুক্ত আরব আমিরাত", "flag": "🇦🇪" },
  "gb": { "name": "United Kingdom", "name_ar": "المملكة المتحدة", "name_fa": "انگلستان", "name_bn": "যুক্তরাজ্য", "flag": "🇬🇧" },
  "us": { "name": "United States", "name_ar": "الولايات المتحدة", "name_fa": "ایالات متحده آمریکا", "name_bn": "যুক্তরাষ্ট্র", "flag": "🇺🇸" },
  "um": { "name": "United States Minor Outlying Islands", "name_ar": "جزر الولايات المتحدة الصغيرة النائية", "name_fa": "جزایر کوچک حاشیه‌ای ایالات متحده", "name_bn": "যুক্তরাষ্ট্রের ক্ষুদ্র বহির্দৃষ্টি দ্বীপপুঞ্জ", "flag": "🇺🇲" },
  "uy": { "name": "Uruguay", "name_ar": "أوروغواي", "name_fa": "اروگوئه", "name_bn": "উরুগুয়ে", "flag": "🇺🇾" },
  "uz": { "name": "Uzbekistan", "name_ar": "أوزبكستان", "name_fa": "ازبکستان", "name_bn": "উজবেকিস্তান", "flag": "🇺🇿" },
  "vu": { "name": "Vanuatu", "name_ar": "فانواتو", "name_fa": "وانواتو", "name_bn": "ভানুয়াতু", "flag": "🇻🇺" },
  "ve": { "name": "Venezuela", "name_ar": "فنزويلا", "name_fa": "ونزوئلا", "name_bn": "ভেনেজুয়েলা", "flag": "🇻🇪" },
  "vn": { "name": "Viet Nam", "name_ar": "فيتنام", "name_fa": "ویتنام", "name_bn": "ভিয়েতনাম", "flag": "🇻🇳" },
  "vg": { "name": "Virgin Islands, British", "name_ar": "جزر العذراء البريطانية", "name_fa": "جزایر ویرجین بریتانیا", "name_bn": "ব্রিটিশ ভার্জিন দ্বীপপুঞ্জ", "flag": "🇻🇬" },
  "vi": { "name": "Virgin Islands, U.S.", "name_ar": "جزر العذراء الأمريكية", "name_fa": "جزایر ویرجین آمریکا", "name_bn": "মার্কিন ভার্জিন দ্বীপপুঞ্জ", "flag": "🇻🇮" },
  "wf": { "name": "Wallis and Futuna", "name_ar": "واليس وفوتونا", "name_fa": "والیس و فوتونا", "name_bn": "ওয়ালিস ও ফুটুনা", "flag": "🇼🇫" },
  "eh": { "name": "Western Sahara", "name_ar": "الصحراء الغربية", "name_fa": "صحرای غربی", "name_bn": "পশ্চিম সাহারা", "flag": "🇪🇭" },
  "ye": { "name": "Yemen", "name_ar": "اليمن", "name_fa": "یمن", "name_bn": "ইয়েমেন", "flag": "🇾🇪" },
  "zm": { "name": "Zambia", "name_ar": "زامبيا", "name_fa": "زامبیا", "name_bn": "জাম্বিয়া", "flag": "🇿🇲" },
  "zw": { "name": "Zimbabwe", "name_ar": "زيمبابوي", "name_fa": "زیمبابوه", "name_bn": "জিম্বাবুয়ে", "flag": "🇿🇼" }
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
  getCountryInfo(code, lang = 'en') {
    const info = COUNTRY_MAP[code.toLowerCase()] || { name: code.toUpperCase(), flag: '🏳️' };
    const localizedName = info[`name_${lang}`] || info.name;
    return { ...info, localizedName };
  }


  /**
   * Get all supported countries
   */
  getAllCountries() {
    return COUNTRY_MAP;
  }
}

module.exports = new DurianAPI();

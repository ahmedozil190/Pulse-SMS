const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const BASE_URL = 'https://api.durianrcs.com/out/ext_api/';
const credentialParams = `name=${process.env.DURIAN_USERNAME}&ApiKey=${process.env.DURIAN_API_KEY}`;

async function checkPid(pid) {
  try {
    const url = `${BASE_URL}getCountryPhoneNum?${credentialParams}&pid=${pid}`;
    const response = await axios.get(url);
    if (response.data.code === 200 && response.data.data) {
      const data = response.data.data;
      if (Object.keys(data).length > 0) {
        // Look for Italy (it) or Poland (pl) with low stock
        if (data.it || data.it === 0) {
           console.log(`[PID ${pid}] Found Italy: ${data.it}`);
        }
        if (data.pl < 10 && data.pl > 0) {
           console.log(`[PID ${pid}] Found Poland: ${data.pl}`);
        }
      }
    }
  } catch (e) {}
}

async function find() {
  console.log("Searching for high-quality Telegram PID...");
  // Try a common range
  for (let i = 200; i < 400; i++) {
    const pid = i.toString().padStart(4, '0');
    await checkPid(pid);
  }
}

find();

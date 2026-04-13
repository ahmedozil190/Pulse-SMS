const durianApi = require('../src/api/durian');

async function check() {
  console.log("Checking User Info...");
  const userInfo = await durianApi.getUserInfo();
  console.log(JSON.stringify(userInfo, null, 2));

  console.log("\nChecking Country Distribution for Telegram (0257)...");
  const countries = await durianApi.getCountryDistribution('0257');
  console.log(JSON.stringify(countries, null, 2));

  console.log("\nChecking getProjectPrice for Telegram (0257)...");
  const priceInfo = await durianApi._get('getProjectPrice', 'pid=0257');
  console.log(JSON.stringify(priceInfo, null, 2));

  console.log("\nChecking getCountryList...");
  const countryList = await durianApi._get('getCountryList');
  console.log(JSON.stringify(countryList, null, 2));
}

check();

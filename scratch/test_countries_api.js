const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const durianApi = require('./src/api/durian.js');

async function test() {
  const allCountryMap = durianApi.getAllCountries();
  const configs = await prisma.countryConfig.findMany();
  const configMap = configs.reduce((acc, c) => ({ ...acc, [c.countryCode]: c }), {});

  const countries = [];
  Object.keys(allCountryMap).forEach(code => {
    const info = allCountryMap[code];
    const config = configMap[code] || { isEnabled: true, price: 0.25 };
    
    countries.push({
      code,
      name: info.name,
      flag: info.flag,
      stock: 0,
      isEnabled: config.isEnabled,
      price: config.price
    });
  });

  console.log("Found countries:", countries.length);
  if (countries.length > 0) {
    console.log("First country:", countries[0]);
  }
}
test();

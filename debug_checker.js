const prisma = require('./src/db/prisma');

async function debugSettings() {
  const settings = await prisma.globalSetting.findMany({
    where: {
      key: { in: ['checker_api_id', 'checker_api_hash', 'checker_session'] }
    }
  });

  console.log('--- Checker Settings in DB ---');
  settings.forEach(s => {
    console.log(`${s.key}: ${s.value.substring(0, 10)}... (Length: ${s.value.length})`);
  });
  console.log('------------------------------');
  process.exit(0);
}

debugSettings();

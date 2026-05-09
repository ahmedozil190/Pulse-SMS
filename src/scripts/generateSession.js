const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const dotenv = require("dotenv");
dotenv.config();

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

(async () => {
  if (!apiId || !apiHash) {
    console.log("Please set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first!");
    process.exit(1);
  }

  console.log("Starting...");
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Please enter your phone number: "),
    password: async () => await input.text("Please enter your password (if any): "),
    phoneCode: async () => await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });

  console.log("\n--------------------------------------------------");
  console.log("SUCCESS! Here is your STRING_SESSION:");
  console.log("Save this in your .env as TELEGRAM_STRING_SESSION");
  console.log("--------------------------------------------------");
  console.log(client.session.save());
  console.log("--------------------------------------------------\n");
  
  process.exit(0);
})();

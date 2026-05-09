const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const dotenv = require('dotenv');
const prisma = require('../db/prisma');
dotenv.config();

class CheckerService {
  constructor() {
    this.apiId = parseInt(process.env.TELEGRAM_API_ID);
    this.apiHash = process.env.TELEGRAM_API_HASH;
    this.stringSession = new StringSession(process.env.TELEGRAM_STRING_SESSION || "");
    this.client = null;
    this.isReady = false;
  }

  async init() {
    try {
      // 1. Try to fetch from Database first (GlobalSettings table)
      const dbApiId = await prisma.globalSetting.findUnique({ where: { key: 'checker_api_id' } });
      const dbApiHash = await prisma.globalSetting.findUnique({ where: { key: 'checker_api_hash' } });
      const dbSession = await prisma.globalSetting.findUnique({ where: { key: 'checker_session' } });

      this.apiId = dbApiId ? parseInt(dbApiId.value) : parseInt(process.env.TELEGRAM_API_ID);
      this.apiHash = dbApiHash ? dbApiHash.value : process.env.TELEGRAM_API_HASH;
      
      const sessionValue = dbSession ? dbSession.value : (process.env.TELEGRAM_STRING_SESSION || "");
      this.stringSession = new StringSession(sessionValue);

      if (!this.apiId || isNaN(this.apiId)) {
        return { success: false, message: 'Invalid or missing API_ID' };
      }
      if (!this.apiHash) {
        return { success: false, message: 'Missing API_HASH' };
      }
      if (!sessionValue) {
        return { success: false, message: 'Missing STRING_SESSION' };
      }

      this.client = new TelegramClient(this.stringSession, this.apiId, this.apiHash, {
        connectionRetries: 3,
        timeout: 10000,
      });

      await this.client.connect();
      this.isReady = await this.client.isUserAuthorized();
      
      if (this.isReady) {
        console.log('[Checker] Telegram Checker Service is READY');
        return { success: true, message: 'Service is ONLINE' };
      } else {
        console.warn('[Checker] Telegram Checker Service is NOT AUTHORIZED.');
        return { success: false, message: 'Session is invalid or expired' };
      }
    } catch (err) {
      console.error('[Checker] Initialization Error:', err.message);
      return { success: false, message: `Connection Error: ${err.message}` };
    }
  }

  /**
   * Check if a number is Banned or Registered
   * @param {string} phoneNumber 
   * @returns {Promise<{ status: 'CLEAN' | 'REGISTERED' | 'BANNED' | 'ERROR', error?: string }>}
   */
  async checkNumber(phoneNumber) {
    if (!this.isReady) {
      return { status: 'ERROR', error: 'Service not ready' };
    }

    const cleanPhone = phoneNumber.replace('+', '');

    try {
      // 1. Check if registered (Import Contact trick - no SMS sent)
      const contactResult = await this.client.invoke(
        new Api.contacts.ImportContacts({
          contacts: [
            new Api.InputPhoneContact({
              clientId: BigInt(Math.floor(Math.random() * 1000000)),
              phone: cleanPhone,
              firstName: "Checker",
              lastName: ""
            })
          ]
        })
      );

      const isRegistered = contactResult.users.length > 0;
      
      // If found, delete the contact to stay clean
      if (isRegistered) {
        await this.client.invoke(
          new Api.contacts.DeleteContacts({
            id: [contactResult.users[0].id]
          })
        );
        return { status: 'REGISTERED' };
      }

      // 2. Check if Banned (Requires SendCode - sends SMS if clean!)
      // Note: We only do this if NOT registered to minimize SMS spam
      try {
        await this.client.invoke(
          new Api.auth.SendCode({
            phoneNumber: phoneNumber,
            apiId: this.apiId,
            apiHash: this.apiHash,
            settings: new Api.CodeSettings({})
          })
        );
        // If it succeeds, it means it's a valid new number
        return { status: 'CLEAN' };
      } catch (err) {
        if (err.errorMessage === 'PHONE_NUMBER_BANNED') {
          return { status: 'BANNED' };
        }
        if (err.errorMessage === 'FLOOD_WAIT_X') {
            console.warn('[Checker] Flood Wait encountered during check');
            return { status: 'CLEAN' }; // Assume clean if flooded to avoid blocking?
        }
        // Other errors (like INVALID_PHONE_NUMBER)
        return { status: 'ERROR', error: err.errorMessage };
      }

    } catch (err) {
      console.error(`[Checker] Check Failed for ${phoneNumber}:`, err.message);
      return { status: 'ERROR', error: err.message };
    }
  }
}

module.exports = new CheckerService();

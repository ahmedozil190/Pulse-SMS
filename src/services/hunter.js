const durianApi = require('../api/durian');
const prisma = require('../db/prisma');

class HunterService {
  constructor() {
    this.liveDistribution = {};
    this.freshArrivals = {}; // { code: expiryTimestamp }
    this.stuckStock = {}; // { code: stuckAmount }
    this.lastNotified = {}; // { code: lastTimestamp } to prevent spam
    this.onFreshArrival = null;
    this.lastUpdated = null;
    this.interval = null;
    this.pid = '0257'; // Telegram Project ID
  }

  /**
   * Start the background poller
   * @param {Function} callback - Callback for fresh arrivals
   */
  start(intervalMs = 5000, callback = null) {
    if (this.interval) return;
    this.onFreshArrival = callback;

    console.log(`[Hunter] Starting Live Stock Monitor (Interval: ${intervalMs}ms)`);

    // Initial fetch
    this.poll();

    this.interval = setInterval(() => {
      this.poll();
    }, intervalMs);
  }

  /**
   * Fetch current stock from API and detect fresh arrivals
   */
  async poll() {
    try {
      // Pick any active account to poll for stock
      const acc = await prisma.providerAccount.findFirst({ where: { isActive: true } });
      if (!acc) {
        console.warn('[Hunter] Skipping poll: No active provider accounts found.');
        this.liveDistribution = {}; // Clear stock so countries disappear
        return;
      }

      const response = await durianApi.getCountryDistribution(this.pid, acc);
      if (response.code === 200 && response.data) {
        const newData = response.data;
        const oldData = this.liveDistribution;
        const now = Date.now();

        // Clean up stuck stock if the API natively reports 0 or omits the country
        Object.keys(this.stuckStock).forEach(code => {
          if (!newData[code] || newData[code] === 0) {
            delete this.stuckStock[code];
          }
        });

        // Detect stock increases (Fresh Arrivals) and handle stuck stock
        Object.keys(newData).forEach(code => {
          const actualApiStock = newData[code];

          // If this country has stuck stock, check if we got a new drop
          if (this.stuckStock[code] !== undefined) {
            if (actualApiStock > this.stuckStock[code]) {
              // New stock dropped! Clear stuck cache.
              delete this.stuckStock[code];
            } else {
              // Stock is still stuck (or decreased without a new drop). Hide it.
              newData[code] = 0;
            }
          }

          const newStock = newData[code];
          const oldStock = oldData[code] || 0;

          // If stock increased and it's not a huge jump (avoid initial load noise)
          if (newStock > oldStock && Object.keys(oldData).length > 0) {
            this.freshArrivals[code] = now + (2 * 60 * 1000); // Mark as fresh for 2 minutes

            // Trigger notification callback whenever stock increases
            if (this.onFreshArrival) {
              this.onFreshArrival(code, newStock);
            }
          }
        });

        // Cleanup expired fresh arrivals
        Object.keys(this.freshArrivals).forEach(code => {
          if (this.freshArrivals[code] < now) {
            delete this.freshArrivals[code];
          }
        });

        this.liveDistribution = newData;
        this.lastUpdated = new Date();
      }
    } catch (error) {
      console.error('[Hunter] Polling error:', error.message);
    }
  }

  /**
   * Get the latest verified stock
   */
  getLiveDistribution() {
    return this.liveDistribution;
  }

  /**
   * Check if a country has fresh arrivals (FIRE icon)
   */
  isFresh(code) {
    return !!this.freshArrivals[code];
  }

  /**
   * Manually mark a country as out of stock (e.g., when purchase fails)
   */
  markOutOfStock(code, currentStock = 0) {
    if (this.liveDistribution && this.liveDistribution[code] !== undefined) {
      this.liveDistribution[code] = 0;
    }
    if (this.freshArrivals && this.freshArrivals[code]) {
      delete this.freshArrivals[code];
    }
    if (currentStock > 0) {
      this.stuckStock[code] = currentStock;
    }
  }
}

module.exports = new HunterService();

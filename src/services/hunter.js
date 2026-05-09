const durianApi = require('../api/durian');

class HunterService {
  constructor() {
    this.liveDistribution = {};
    this.freshArrivals = {}; // { code: expiryTimestamp }
    this.outOfStockCache = {}; // { code: expiryTimestamp }
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
      const response = await durianApi.getCountryDistribution(this.pid);
      if (response.code === 200 && response.data) {
        const newData = response.data;
        const oldData = this.liveDistribution;
        const now = Date.now();

        // Enforce out of stock cache to prevent buggy API from immediately restoring 0-stock countries
        Object.keys(this.outOfStockCache).forEach(code => {
          if (this.outOfStockCache[code] > now) {
            newData[code] = 0;
          } else {
            delete this.outOfStockCache[code];
          }
        });

        // Detect stock increases (Fresh Arrivals)
        Object.keys(newData).forEach(code => {
          const newStock = newData[code];
          const oldStock = oldData[code] || 0;

          // If stock increased and it's not a huge jump (avoid initial load noise)
          if (newStock > oldStock && Object.keys(oldData).length > 0) {
            this.freshArrivals[code] = now + (2 * 60 * 1000); // Mark as fresh for 2 minutes
            
            // Trigger notification callback if cooldown passed (5 minutes)
            const lastNotif = this.lastNotified[code] || 0;
            if (this.onFreshArrival && (now - lastNotif > 5 * 60 * 1000)) {
              this.lastNotified[code] = now;
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
  markOutOfStock(code) {
    if (this.liveDistribution && this.liveDistribution[code] !== undefined) {
      this.liveDistribution[code] = 0;
    }
    if (this.freshArrivals && this.freshArrivals[code]) {
      delete this.freshArrivals[code];
    }
    // Cache the out-of-stock state for 3 minutes to ignore buggy API responses
    this.outOfStockCache[code] = Date.now() + (3 * 60 * 1000);
  }
}

module.exports = new HunterService();

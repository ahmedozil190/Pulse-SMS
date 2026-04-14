const durianApi = require('../api/durian');

class HunterService {
  constructor() {
    this.liveDistribution = {};
    this.freshArrivals = {}; // { code: expiryTimestamp }
    this.lastUpdated = null;
    this.interval = null;
    this.pid = '0257'; // Telegram Project ID
  }

  /**
   * Start the background poller
   * @param {number} intervalMs - Polling interval in ms
   */
  start(intervalMs = 5000) {
    if (this.interval) return;
    
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

        // Detect stock increases (Fresh Arrivals)
        Object.keys(newData).forEach(code => {
          const newStock = newData[code];
          const oldStock = oldData[code] || 0;

          // If stock increased and it's not a huge jump (avoid initial load noise)
          if (newStock > oldStock && Object.keys(oldData).length > 0) {
            this.freshArrivals[code] = now + (2 * 60 * 1000); // Mark as fresh for 2 minutes
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
}

module.exports = new HunterService();

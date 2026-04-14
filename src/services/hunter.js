const durianApi = require('../api/durian');

class HunterService {
  constructor() {
    this.liveDistribution = {};
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
   * Stop the poller
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Fetch current stock from API
   */
  async poll() {
    try {
      const response = await durianApi.getCountryDistribution(this.pid);
      if (response.code === 200 && response.data) {
        // Filter out zero stock immediately to keep the 'Live' state clean
        const newData = {};
        Object.keys(response.data).forEach(code => {
          if (response.data[code] > 0) {
            newData[code] = response.data[code];
          }
        });
        
        this.liveDistribution = newData;
        this.lastUpdated = new Date();
        // console.log(`[Hunter] Live distribution updated. Found ${Object.keys(newData).length} active countries.`);
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
}

module.exports = new HunterService();

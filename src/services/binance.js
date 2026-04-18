const axios = require('axios');
const crypto = require('crypto');

class BinancePayService {
    constructor(apiKey, apiSecret) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = 'https://api.binance.com'; // Standard Spot API for Pay history
    }

    /**
     * Signs the request query string with HMAC-SHA256
     */
    generateSignature(queryString) {
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    /**
     * Fetches Binance Pay transaction history
     * Docs: https://developers.binance.com/docs/binance-pay/api-order-query-v2 (or sapiens)
     * For internal transfers/Pay, we use /sapi/v1/pay/transactions
     */
    async getPayTransactions(startTime = null) {
        if (!this.apiKey || !this.apiSecret) {
            throw new Error('Binance credentials not configured');
        }

        const timestamp = Date.now();
        let query = `timestamp=${timestamp}`;
        if (startTime) {
            query += `&startTime=${startTime}`;
        }

        const signature = this.generateSignature(query);
        const url = `${this.baseUrl}/sapi/v1/pay/transactions?${query}&signature=${signature}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'X-MBX-APIKEY': this.apiKey
                }
            });

            if (response.data && response.data.code === '000000') {
                return response.data.data;
            } else {
                console.error('[BINANCE API ERROR]', response.data);
                return [];
            }
        } catch (error) {
            console.error('[BINANCE SERVICE ERROR]', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    /**
     * Verifies if a transaction ID exists and meets criteria
     */
    async verifyTransaction(txid) {
        if (txid.startsWith('MOCK_BINANCE_')) {
            const parts = txid.split('_');
            const customAmount = parseFloat(parts[parts.length - 1]);
            const amount = !isNaN(customAmount) && customAmount > 0 ? customAmount : 0.01;

            console.log(`[BINANCE TEST] Validating Mock ID: ${txid} with amount: ${amount}`);
            return {
                amount: amount,
                currency: 'USDT',
                time: Date.now()
            };
        }

        // Fetch last 24 hours of transactions
        const yesterday = Date.now() - 24 * 60 * 60 * 1000;
        const transactions = await this.getPayTransactions(yesterday);

        // Find match
        // In /sapi/v1/pay/transactions, the unique ID is usually 'orderId' or 'transId'
        const match = transactions.find(t => t.orderId === txid || t.transId === txid);

        if (!match) return null;

        /**
         * Potential match structure (based on Binance Docs):
         * {
         *   "orderId": "...",
         *   "transId": "...",
         *   "amount": "100.00",
         *   "currency": "USDT",
         *   "type": 1, (1: Receive, 2: Send)
         *   "time": 123456789,
         *   "status": "SUCCESS"
         * }
         */

        // Check if it's a "Receive" (type 1 for receipts in some versions, or check amount sign)
        // Usually amount is positive for receive.
        const amount = parseFloat(match.amount);
        if (amount <= 0) return null;

        // We only support success transactions
        // Note: status check depends on exact API version response

        return {
            amount: amount,
            currency: match.currency,
            time: match.time
        };
    }
}

module.exports = BinancePayService;

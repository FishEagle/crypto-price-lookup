//API documentation: https://www.coingecko.com/en/api/documentation
export class CoinGeckoClient {
	constructor() {
	}

	#apiUrl = "https://api.coingecko.com/api/v3";
	#pingUrl = "/ping";
	#coinsListUrl = "/coins/list";

	#getCoinHistoryUrl = (id, date) => {
		//convert date to string (dd-mm-yyyy format) - note: January is month 0 ; use slice to ensure day and month are 2 digits long
		const dateString = `0${date.getDate()}`.slice(-2) + '-'
						 + `0${date.getMonth() + 1}`.slice(-2) + '-'
						 + `${date.getFullYear()}`;
		console.log(`dateString = ${dateString}`); //TEST
		return `/coins/${id}/history?date=${dateString}&localization=false`;
	};

	#getCoinsMarketsUrl = (vs_currency, pageSize, page) => {
		return `/coins/markets?vs_currency=${vs_currency}&order=market_cap_desc&per_page=${pageSize}&page=${page}`;
	}

	//note: the Promise returned from fetch() won’t reject on HTTP error statuses (unlike jQuery.ajax()), 
	//		will only reject on network failure or if anything prevented the request from completing
	//		the ok property of the response will be set to false if the response isn’t in the range 200–299

	ping() {
		//fetch first returns a promise that resolves with a Response object (a representation of the entire HTTP response).
		//the response.json() method returns a second promise that resolves with the result of parsing the response body text as JSON.
		//this should be handled by the caller, e.g. .then(data => console.log(data))
		return fetch(`${this.#apiUrl}${this.#pingUrl}`).then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error !! status: ${response.status}`);
			}
			return response.json();
		});
	}

	coinsList() {
		return fetch(`${this.#apiUrl}${this.#coinsListUrl}`).then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error !! status: ${response.status}`);
			}
			return response.json();
		});
	}

	/**
	 * Use this to obtain all the coins market data (price, market cap, volume)
	 * @param {string} vs_currency - The target currency of market data (usd, eur, jpy, etc.)
	 * @param {number} pageSize - Valid values: 1..250
	 * @param {number} page - Page number of results to return
	 */
	coinsMarkets(vs_currency, pageSize, page) {
		return fetch(`${this.#apiUrl}${this.#getCoinsMarketsUrl(vs_currency, pageSize, page)}`).then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error !! status: ${response.status}`);
			}
			return response.json();
		});
	}

	/**
	 * Get historical data (name, price, market, stats) at a given date for a coin
	 * @param {string} id - pass the coin id (can be obtained from coinsList()) eg. bitcoin
	 * @param {Date} date - The date of data snapshot
	 */
	coinHistory(id, date) {
		return fetch(`${this.#apiUrl}${this.#getCoinHistoryUrl(id, date)}`).then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error !! status: ${response.status}`);
			}
			return response.json();
		});
	}
}//main class
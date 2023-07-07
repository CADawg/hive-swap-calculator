import BigNumber from "bignumber.js";

/**
 * CoinData is the data returned from the backend about various coins
 * @typedef {{usd:string,usd_24h_change:string,btc:string,btc_24h_change:string,last_updated_at:number,hive:string,network_percentage_fee:string,network_flat_fee:string,name:string,symbol:string,swap_symbol:string}} CoinData
 * @typedef {(CoinData[]|null)} CoinDataArrayOrNull
 * */

/**
 * ParsedCoinData is the data returned from the backend about various coins with big numbers instead of strings
 * @typedef {{usd:BigNumber,usd_24h_change:BigNumber,btc:BigNumber,btc_24h_change:BigNumber,last_updated_at:number,hive:BigNumber,network_percentage_fee:BigNumber,network_flat_fee:BigNumber,name:string,symbol:string,swap_symbol:string}} ParsedCoinData
 * @typedef {(ParsedCoinData[]|null)} ParsedCoinDataArrayOrNull
 */

/**
 * GetCoinsData fetches the data from the backend and returns it
 * @returns {ParsedCoinDataArrayOrNull} The data from the backend
 */
export default async function GetCoinsData() {
    const response = await fetch('http://localhost:8080/prices');
    /** @type {CoinDataArrayOrNull} */
    let data = await response.json();

    if (data === null) return null;

    /** @type {ParsedCoinDataArrayOrNull} */
    let parsedData = [];

    for (let i = 0; i < data.length; i++) {
        parsedData.push(ConvertCoinsDataToBigNumbers(data[i]));
    }

    return parsedData;
}

/**
 * ConvertCoinsDataToBigNumbers converts the string values in the coins data to big numbers
 * @param {(CoinData)} value string to convert
 * @returns {(ParsedCoinData)} The data from the backend with big numbers instead of strings
 */
function ConvertCoinsDataToBigNumbers(value) {
    return {
        usd: new BigNumber(value.usd),
        usd_24h_change: new BigNumber(value.usd_24h_change),
        btc: new BigNumber(value.btc),
        btc_24h_change: new BigNumber(value.btc_24h_change),
        last_updated_at: value.last_updated_at,
        hive: new BigNumber(value.hive),
        network_percentage_fee: new BigNumber(value.network_percentage_fee),
        network_flat_fee: new BigNumber(value.network_flat_fee),
        name: value.name,
        symbol: value.symbol,
        swap_symbol: value.swap_symbol
    }
}
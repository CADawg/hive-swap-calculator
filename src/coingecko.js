import BigNumber from "bignumber.js";

export default async function GetCoinGeckoData() {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=hive,bitcoin,litecoin,dogecoin,ethereum,tether,binancecoin,binance-usd,wax,matic-network,bitcoin-cash,basic-attention-token,eos&vs_currencies=usd,btc&include_24hr_change=true&include_last_updated_at=true&precision=full');
    const data = await response.json();

    // need to convert usd prices to hive prices
    const hivePrice = data.hive.usd;

    // convert all prices to hive prices
    for (const coin in data) {
        if (!Object.prototype.hasOwnProperty.call(data, coin)) {
            continue;
        }

        data[coin].hive = BigNumber(data[coin].usd).div(BigNumber(hivePrice)).toNumber();
    }

    return data;
}
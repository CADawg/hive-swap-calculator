import BigNumber from "bignumber.js";

/**
 * Order is the data returned from the backend about an order
*/
export type Order = {
    account: string,
    expiration: Number,
    price: string,
    quantity: string,
    symbol: string,
    timestamp: Number,
    txId: string,
    _id: Number,
    profit_percentage: string
};

/**
 * ParsedOrder is the data returned from the backend about an order with big numbers instead of strings
 */
export type ParsedOrder = {
    account: string,
    expiration: Number,
    price: BigNumber,
    quantity: BigNumber,
    symbol: string,
    timestamp: Number,
    txId: string,
    _id: Number,
    profit_percentage: BigNumber,
    profit_per_hive?: BigNumber,
    network_fixed_fee?: BigNumber,
};

export interface ParsedOrderWithProfitData extends ParsedOrder {
    profit_per_hive: BigNumber
}

export interface ParsedOrderWithCoinData extends ParsedOrder {
    profit_per_hive: BigNumber, // not optional
    coin_data: ParsedCoinData
}

export interface ParsedCoinWithOrderProfit extends ParsedCoinData {
    coin_data: ParsedCoinData,
    buy_orders: ParsedOrderWithProfitData[],
    sell_orders: ParsedOrderWithProfitData[]
}

/**
 * CoinData is the data returned from the backend about various coins
 * */
export type CoinData = {
    usd: string,
    usd_24h_change: string,
    btc: string,
    btc_24h_change: string,
    last_updated_at: number,
    hive: string,
    network_percentage_fee: string,
    network_flat_fee: string,
    name: string,
    symbol: string,
    swap_symbol: string,
    buy_orders: Order[],
    sell_orders: Order[]
};

export type CoinDataArrayOrNull = CoinData[] | null;

/**
 * ParsedCoinData is the data returned from the backend about various coins with big numbers instead of strings
 */
export type ParsedCoinData = {
    usd: BigNumber,
    usd_24h_change: BigNumber,
    btc: BigNumber,
    btc_24h_change: BigNumber,
    last_updated_at: number,
    hive: BigNumber,
    network_percentage_fee: BigNumber,
    network_flat_fee: BigNumber,
    name: string,
    symbol: string,
    swap_symbol: string,
    buy_orders: ParsedOrder[],
    sell_orders: ParsedOrder[]
};

export type ParsedCoinDataArrayOrNull = ParsedCoinData[] | null;

/**
 * GetCoinsData fetches the data from the backend and returns it
 */
export default async function GetCoinsData(): Promise<ParsedCoinDataArrayOrNull> {
    const response = await fetch('http://localhost:8080/prices');
    let data = await response.json() as CoinDataArrayOrNull;

    if (data === null) return null;

    let parsedData: ParsedCoinDataArrayOrNull = [];

    for (let i = 0; i < data.length; i++) {
        parsedData.push(ConvertCoinsDataToBigNumbers(data[i]));
    }

    return parsedData;
}

/**
 * ConvertCoinsDataToBigNumbers converts the string values in the coins data to big numbers
 */
function ConvertCoinsDataToBigNumbers(value: CoinData): ParsedCoinData {
    let buyOrders = [];
    let sellOrders = [];

    if (value.buy_orders) {
        for (let i = 0; i < value.buy_orders.length; i++) {
            buyOrders.push(ConvertOrdersToBigNumbers(value.buy_orders[i]));
        }
    }

    if (value.sell_orders) {
        for (let i = 0; i < value.sell_orders.length; i++) {
            sellOrders.push(ConvertOrdersToBigNumbers(value.sell_orders[i]));
        }
    }

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
        swap_symbol: value.swap_symbol,
        buy_orders: buyOrders,
        sell_orders: sellOrders
    }
}

/**
 * ConvertOrdersToBigNumbers converts the string values in the orders to big numbers
 */
function ConvertOrdersToBigNumbers(value: Order): ParsedOrder {
    return {
        account: value.account,
        expiration: value.expiration,
        price: BigNumber(value.price),
        quantity: BigNumber(value.quantity),
        symbol: value.symbol,
        timestamp: value.timestamp,
        txId: value.txId,
        _id: value._id,
        profit_percentage: BigNumber(value.profit_percentage)
    }
}
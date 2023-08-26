import {
    ParsedCoinData,
    ParsedCoinWithOrderProfit,
    ParsedOrderWithCoinData,
    ParsedOrderWithProfitData
} from "./coindata.ts";
import BigNumber from "bignumber.js";

export function ConvertCoinDataWithOrderToOrderWithCoinData(processedCoinsData: ParsedCoinWithOrderProfit[], orderSide: "buy" | "sell") {
    // orders we can take (array of order with coin data embedded)
    let orderOptions: ParsedOrderWithCoinData[] = [];

    // add all orders to orderOptions
    for (let i = 0; i < processedCoinsData.length; i++) {
        let coin = processedCoinsData[i];

        let orders = orderSide === "buy" ? coin.buy_orders : coin.sell_orders;

        for (let j = 0; j < orders.length; j++) {
            let orderWithCoin = orders[j] as ParsedOrderWithCoinData;

            orderWithCoin.coin_data = coin;

            orderOptions.push(orderWithCoin as ParsedOrderWithCoinData)
        }
    }

    return orderOptions;
}

export function GetCoinsWithProcessedOrders(coinsData: ParsedCoinData[], orderSide: "buy" | "sell", currency: "HIVE" | "SWAP.HIVE" | undefined, defaultEngineSwapPenalty: BigNumber) : ParsedCoinWithOrderProfit[] {
    let processedCoinsData: ParsedCoinWithOrderProfit[] = [];

    // work out profit post deposit/withdrawal (minus each coin's deposit/withdrawal fee)
    for (let i = 0; i < coinsData.length; i++) {
        let coin = {...coinsData[i]} as ParsedCoinData;

        let orders = orderSide === "buy" ? coin.buy_orders : coin.sell_orders;

        let newOrders : ParsedOrderWithProfitData[] = [];

        // we want to buy hive or swap.hive with usd/other crypto
        for (let j = 0; j < orders.length; j++) {
            let order = orders[j];

            // get the total amount of hive we will put in or get out of this order
            let netValueOfOrder = order.price.times(order.quantity);

            // subtract hive engine fees for swapping between hive and swap.hive (if applicable - defaultXPenalty will be 0 otherwise)
            netValueOfOrder = netValueOfOrder.times(BigNumber(1).minus(currency === 'HIVE' ? defaultEngineSwapPenalty : BigNumber(0)));

            // subtract network deposit/withdrawal fee (it's provided as a % decimal i.e. 0.75 = 0.75%)
            netValueOfOrder = netValueOfOrder.times(BigNumber(1).minus(BigNumber(coin.network_percentage_fee.div(BigNumber(100)))));

            // we can get this from the coin data when we embed the coin data in  orders in the next step
            // add fixed fee data to be used later
            //if (orderSide === "sell") {
            //    // fixed fee only applies if we're going from hive -> other currency
            //    order.network_fixed_fee = coin.network_flat_fee;
            //} else {
            //    order.network_fixed_fee = BigNumber(0);
            //}

            if (orderSide === "buy") {
                // work out hive in equivalent of coin price and divide it by the amount of hive we will get out
                let hiveSwapRatio = netValueOfOrder.div(order.quantity.times(coin.hive));

                // calc profit
                order.profit_per_hive = hiveSwapRatio.minus(BigNumber(1));
                order.profit_percentage = order.profit_per_hive.times(BigNumber(100));
            } else {
                // work out hive in equivalent of coin price and divide it by the amount of hive we will get out
                let hiveSwapRatio = netValueOfOrder.div(order.quantity.times(coin.hive));

                // calc profit
                order.profit_per_hive = hiveSwapRatio.minus(BigNumber(1));
                order.profit_percentage = order.profit_per_hive.times(BigNumber(100));
            }

            newOrders.push(order as ParsedOrderWithProfitData);
        }

        if (orderSide == "buy") {
            coin.buy_orders = newOrders.filter((order) => order.profit_per_hive.gt(0));
        } else {
            coin.sell_orders = newOrders.filter((order) => order.profit_per_hive.gt(0));
        }

        processedCoinsData.push(coin as ParsedCoinWithOrderProfit);
    }

    return processedCoinsData;
}
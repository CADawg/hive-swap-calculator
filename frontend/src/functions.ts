import {
    Currency,
    OrderSide,
    OrderWithDepth,
    ParsedCoinData,
    ParsedCoinWithOrderProfit,
    ParsedOrderWithProfitData
} from "./coindata.ts";
import BigNumber from "bignumber.js";
import {BestRoute, RouteCurrency} from "./app.tsx";

// Calculate the most profitable orders to fill the entire "currentAmountCurrency"
const calcBestOrders = (
    orders: OrderWithDepth[],
    currentAmountCurrency: BigNumber
): OrderWithDepth[] => {
    // Sort orders by their calculated profitability in descending order
    const sortedOrders = orders.sort((a, b) => {
        const profitabilityA = a.Profit_Per_Hive.multipliedBy(a.Depth);
        const profitabilityB = b.Profit_Per_Hive.multipliedBy(b.Depth);
        return profitabilityB.minus(profitabilityA).toNumber();
    });

    let remainingAmount = currentAmountCurrency;
    let bestOrders: OrderWithDepth[] = [];
    let usedCoins = new Set<string>(); // Store the IDs of coins whose orders have been selected

    for (const order of sortedOrders) {
        if (remainingAmount.lte(0)) {
            break; // Stop if we've reached the total amount needed
        }

        if (!usedCoins.has(order.Coin.symbol)) {
            const amountToUse = BigNumber.min(order.Depth, remainingAmount); // Amount for this order to be used

            // Clone the current order and adjust the Depth
            const adjustedOrder = { ...order, Depth: amountToUse };
            bestOrders.push(adjustedOrder);

            remainingAmount = remainingAmount.minus(amountToUse); // Update remaining amount
            usedCoins.add(order.Coin.symbol); // Mark this coin as used
        }
    }

    return bestOrders;
};

// This function takes an amount of hive, gets the best routes for that amount of hive, and returns the best routes - if it is on the sell side it has to include the coin.network_fixed_fee in the calculation for the maximum purchasable amount
// to see if it is still profitable
export function GetBestRoutesForGivenAmountOfToken(coinsWithOrders: ParsedCoinWithOrderProfit[], orderSide: OrderSide, currency: Currency, amountCurrency: BigNumber, defaultEngineSwapPenalty: BigNumber): BestRoute[] {
    let currentAmountCurrency = amountCurrency;
    let bestRoutes: BestRoute[] = [];

    // convert the data, so it is ordered in a fashion of order depth (volume) and profit per hive up to the amount of hive we have
    let ordersByCoinsAndDepth: OrderWithDepth[] = [];
    let maxCurrentCurrency = BigNumber(0);

    for (let c = 0; c < coinsWithOrders.length; c++) {
        let orders = orderSide === "buy" ? coinsWithOrders[c].sell_orders : coinsWithOrders[c].buy_orders;



        // order by "profit per hive" descending
        orders.sort((a, b) => {
            return a.profit_per_hive.comparedTo(b.profit_per_hive);
        });

        // we need a better algo now
        // as when the stack has say 2.6 at 1500 and then 2.5 at 3000 depth it will take both, but it can only choose to take one as the stacks are additive - meaning taking a lower stack makes a higher stack unavailable as part of the quantity has been used elsewhere
        // so we need to work out the most profitable route


        let currentOrderStack: ParsedOrderWithProfitData[] = [];

        for (let o = 0; o < orders.length; o++) {
            let order = orders[o];
            let toBreak = false;

            if (order.profit_per_hive.gt(0)) {
                // do other checks here

                let totalVolumeExistingStack = BigNumber(0);

                for (let i = 0; i < currentOrderStack.length; i++) {
                    totalVolumeExistingStack = totalVolumeExistingStack.plus(currentOrderStack[i].quantity.times(currentOrderStack[i].price));
                }

                if (totalVolumeExistingStack.plus(order.quantity.times(order.price)).lte(currentAmountCurrency)) {
                    // we can do the whole amount
                    maxCurrentCurrency = currentAmountCurrency;
                } else {
                    if (totalVolumeExistingStack.plus(order.quantity.times(order.price)).minus(currentAmountCurrency).lt(BigNumber(10))) {
                        break // not worth doing
                    }

                    maxCurrentCurrency = currentAmountCurrency.minus(totalVolumeExistingStack);
                    toBreak = true;
                }

                currentOrderStack.push(order);

                // here we need to calculate what we can add and what the network fee removes from the profit
                let orderByDepth: OrderWithDepth = {
                    Coin: coinsWithOrders[c],
                    Orders: currentOrderStack,
                    Depth: maxCurrentCurrency,
                    Profit_Per_Hive: BigNumber(0)
                };

                // average profit per hive at this depth
                let profitPerHive = BigNumber(0);

                // current quantity for correctly weighting the average calculation
                let currentHiveQuantity = BigNumber(0);

                // add to profit per hive averaging based on the amount of hive we have vs the current order's quantity
                for (let i = 0; i < currentOrderStack.length; i++) {
                    let order = currentOrderStack[i];

                    // add this order to the profit per hive by doing the following calc:
                    // if maxCurrentCurrency > order.quantity * order.price then (profitPerHive * currentHiveQuantity) + (order.profit_per_hive * (order.quantity * order.price))
                    // else (profitPerHive * currentHiveQuantity) + (order.profit_per_hive * maxCurrentCurrency)

                    if (maxCurrentCurrency.gt(order.quantity.times(order.price))) {
                        profitPerHive = profitPerHive.times(currentHiveQuantity).plus(order.profit_per_hive.times(order.quantity.times(order.price))).div(currentHiveQuantity.plus(order.quantity.times(order.price)));
                    } else {
                        profitPerHive = profitPerHive.times(currentHiveQuantity).plus(order.profit_per_hive.times(maxCurrentCurrency)).div(currentHiveQuantity.plus(maxCurrentCurrency));
                    }

                    currentHiveQuantity = currentHiveQuantity.plus(order.quantity.times(order.price));
                }

                // subtract network fixed fee from profit per hive
                let netFlatFee = orderSide === "buy" ? BigNumber(0) : coinsWithOrders[c].network_flat_fee;

                // need to do it in a weighted manner however
                profitPerHive = profitPerHive.minus(netFlatFee.div(currentHiveQuantity));

                orderByDepth.Profit_Per_Hive = profitPerHive;

                ordersByCoinsAndDepth.push(orderByDepth);

                if (toBreak) {
                    break;
                }
            } else {
                break;
            }
        }
    }
    if (ordersByCoinsAndDepth.length > 0) {
        console.log(ordersByCoinsAndDepth);
    }

    // get hive coin
    let hiveCoin = coinsWithOrders.find((coin) => coin.symbol === "HIVE");

    if (typeof hiveCoin === 'undefined') {
        console.error("Broken!");
        return bestRoutes;
    }

    ordersByCoinsAndDepth.push({
        Coin: hiveCoin,
        Orders: [{
            symbol: currency ?? "HIVE",
            account: "",
            expiration: Number(new BigNumber(Date.now()).plus(1000000).div(1000).toFixed(0)),
            price: BigNumber(1),
            quantity: BigNumber("10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
            profit_per_hive: currency === 'SWAP.HIVE' ? defaultEngineSwapPenalty.times(-1) : BigNumber(0),
            profit_percentage: currency === 'SWAP.HIVE' ? defaultEngineSwapPenalty.times(-1) : BigNumber(0),
            timestamp: Number(new BigNumber(Date.now()).div(1000).toFixed(0)),
            txId: "",
            _id: 0
        }],
        Depth: BigNumber("10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        Profit_Per_Hive: currency === 'SWAP.HIVE' ? defaultEngineSwapPenalty.times(-1) : BigNumber(0)
    });

    // sort by profit per hive descending
    ordersByCoinsAndDepth = calcBestOrders(ordersByCoinsAndDepth, currentAmountCurrency);

    let hiveLeft = currentAmountCurrency;

    const currencyHive = coinsWithOrders.find((coin) => coin.symbol === "HIVE");
    const hiveToUSDMultiplier = currencyHive ? currencyHive.usd : new BigNumber(0); // Assuming usd is the property with USD value

    for (let i = 0; i < ordersByCoinsAndDepth.length; i++) {
        let orderOption: OrderWithDepth = ordersByCoinsAndDepth[i];
        let coinSymbol = orderOption.Coin.symbol;

        if (hiveLeft.isLessThanOrEqualTo(0)) {
            break; // Stop if no more Hive left
        }

        for (let j = 0; j < orderOption.Orders.length; j++) {
            let individualOrder = orderOption.Orders[j];

            if (hiveLeft.isLessThanOrEqualTo(0)) {
                break; // Stop if no more Hive left
            }

            let from: RouteCurrency;
            let to: RouteCurrency;

            if (orderSide === "sell") {
                from = {
                    symbol: 'HIVE',
                    amount: individualOrder.quantity,
                    amountHive: individualOrder.quantity,
                    amountUSD: individualOrder.quantity.times(hiveToUSDMultiplier),
                };
                to = {
                    symbol: coinSymbol,
                    amount: individualOrder.quantity.dividedBy(individualOrder.profit_per_hive),
                    amountHive: individualOrder.quantity,
                    amountUSD: individualOrder.quantity.times(hiveToUSDMultiplier).dividedBy(individualOrder.profit_per_hive),
                };
            } else {  // "buy"
                from = {
                    symbol: coinSymbol,
                    amount: individualOrder.quantity.dividedBy(individualOrder.profit_per_hive),
                    amountHive: individualOrder.quantity,
                    amountUSD: individualOrder.quantity.times(hiveToUSDMultiplier).dividedBy(individualOrder.profit_per_hive),
                };
                to = {
                    symbol: 'HIVE',
                    amount: individualOrder.quantity,
                    amountHive: individualOrder.quantity,
                    amountUSD: individualOrder.quantity.times(hiveToUSDMultiplier),
                };
            }

            bestRoutes.push({
                from,
                to,
                percentageProfit: individualOrder.profit_per_hive.multipliedBy(100),
            });

            // Subtract from hive left
            hiveLeft = hiveLeft.minus(individualOrder.quantity);
        }
    }

    // group bestroutes by from symbol
    let groupedBestRoutes: BestRoute[][] = [];

    for (let i = 0; i < bestRoutes.length; i++) {
        let route = bestRoutes[i];

        let index = groupedBestRoutes.findIndex((group) => group[0].from.symbol === route.from.symbol);

        if (index === -1) {
            groupedBestRoutes.push([route]);
        } else {
            groupedBestRoutes[index].push(route);
        }
    }

    // add and average
    let averagedBestRoutes: BestRoute[] = [];

    for (let i = 0; i < groupedBestRoutes.length; i++) {
        let group = groupedBestRoutes[i];

        let from = group[0].from;
        let to = group[0].to;
        let percentageProfit = BigNumber(0);

        for (let j = 0; j < group.length; j++) {
            let route = group[j];

            percentageProfit = percentageProfit.plus(route.percentageProfit);
        }

        percentageProfit = percentageProfit.div(group.length);

        averagedBestRoutes.push({
            from,
            to,
            percentageProfit
        });
    }


    return averagedBestRoutes;
}

export function GetCoinsWithProcessedOrders(coinsData: ParsedCoinData[], orderSide: OrderSide, currency: Currency, defaultEngineSwapPenalty: BigNumber) : ParsedCoinWithOrderProfit[] {
    let processedCoinsData: ParsedCoinWithOrderProfit[] = [];

    // work out profit post deposit/withdrawal (minus each coin's deposit/withdrawal fee)
    for (let i = 0; i < coinsData.length; i++) {
        let coin = {...coinsData[i]} as ParsedCoinData;

        let orders = orderSide === "buy" ? coin.sell_orders : coin.buy_orders;

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

        if (orderSide === "buy") {
            coin.sell_orders = newOrders.filter((order) => order.profit_per_hive.gt(0));
            coin.buy_orders = [];
        } else {
            coin.buy_orders = newOrders.filter((order) => order.profit_per_hive.gt(0));
            coin.sell_orders = [];
        }

        processedCoinsData.push(coin as ParsedCoinWithOrderProfit);
    }

    return processedCoinsData;
}
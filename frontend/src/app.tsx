import 'bulma/css/bulma.min.css';
import {useEffect, useState} from "preact/compat";
import GetCoinsData, {
    CoinData,
    ParsedCoinData,
    ParsedCoinDataArrayOrNull, ParsedCoinWithOrderProfit,
    ParsedOrderWithCoinData, ParsedOrderWithProfitData
} from "./coindata.ts";
import BigNumber from "bignumber.js";
import {JSX} from "preact";
import * as React from "preact/compat";

function AtoZSort(a: ParsedCoinData|CoinData, b: ParsedCoinData|CoinData): number {
    if (a.symbol < b.symbol) {
        return -1;
    } else if (a.symbol > b.symbol) {
        return 1;
    } else {
        return 0;
    }
}

function SmartCurrencyFormat(value: BigNumber, currency: string): string {
    currency = currency.toLowerCase();

    if (currency.startsWith("swap.")) {
        currency = currency.substring(5);
    }

    switch (currency) {
        case "usd":
            if (value.lt(1)) {
                return value.toFixed(3);
            } else if (value.lt(10)) {
                return value.toFixed(2);
            } else if (value.lt(100)) {
                return value.toFixed(1);
            } else {
                return value.toFixed(0);
            }
        case "hive" || "steem":
            if (value.lt(1)) {
                return value.toFixed(3);
            } else if (value.lt(10)) {
                return value.toFixed(2);
            } else if (value.lt(100)) {
                return value.toFixed(1);
            } else {
                return value.toFixed(0);
            }
        default:
            if (value.lt(1)) {
                return value.toFixed(5);
            } else if (value.lt(10)) {
                return value.toFixed(4);
            } else if (value.lt(100)) {
                return value.toFixed(3);
            } else if (value.lt(1000)) {
                return value.toFixed(2);
            } else if (value.lt(10000)) {
                return value.toFixed(1);
            } else {
                return value.toFixed(0);
            }
    }
}

/**
 * The best route to cash out your coins
 */
export type BestRoute = {
    from: RouteCurrency,
    to: RouteCurrency,
    percentageProfit: BigNumber,
};

export type RouteCurrency = {
    symbol: string,
    amount: BigNumber,
    amountHive: BigNumber,
    amountUSD: BigNumber,
}


export function App(): JSX.Element {
    let [currency, setCurrency] = useState<"HIVE"|"SWAP.HIVE">('HIVE');
    let [depositCost, setDepositCost] = useState<number>(0.75);
    let [depositAmount, setDepositAmount] = useState<number>(10);
    let [coinsData, setCoinsData] = useState<ParsedCoinDataArrayOrNull>(null);
    let [orderSide, setOrderSide] = useState<"buy"|"sell">('buy');
    let [bestRoutes, setBestRoutes] = useState<BestRoute[]>([]);

    useEffect(() => {
        const updateCoinsData = async () => setCoinsData(await GetCoinsData());

        updateCoinsData().then(() => {
        });

        const interval = setInterval(() => {
            updateCoinsData().then(() => {
            });
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    /**
     * Calculates the best route to cash out your coins
     * */
    const calculateBestRoute = () => {
        // work out default penalty (do we need to deposit/withdraw from engine)
        let defaultEngineSwapPenalty = BigNumber(depositCost).div(BigNumber(100))
        let feeAppliedToHiveDeposits = currency === "SWAP.HIVE" ? defaultEngineSwapPenalty : BigNumber(0);

        if (coinsData === null || typeof coinsData === 'undefined' || coinsData.length === 0) {
            return;
        }

        let hiveAmountOut = BigNumber(depositAmount);

        let processedCoinsData : ParsedCoinWithOrderProfit[] = [];

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

                // subtract fixed fee todo: do this for the whole coin (adds a bunch of complexity)
                if (orderSide === "sell") {
                    // fixed fee only applies if we're going from hive -> other currency
                    netValueOfOrder = netValueOfOrder.minus(BigNumber(coin.network_flat_fee));
                }

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

        // from here we should only use processedCoinsData and not coinsData

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

        // order by profit per hive
        orderOptions.sort((a, b) => {
            return b.profit_per_hive.minus(a.profit_per_hive).toNumber();
        });

        // print best routes until we run out of hive (group all orders by coin)
        let hiveLeft = hiveAmountOut;

        // best routes in order of profit
        let bestRoutesUngrouped: BestRoute[] = [];

        while (hiveLeft.gt(0)) {
            // pop the best order
            let orderOption = orderOptions.shift();

            if (typeof orderOption === 'undefined' || !orderOption.profit_per_hive.gte(feeAppliedToHiveDeposits.times(-1))) {
                // the rest is just hive

                let hiveCoinData = processedCoinsData.find((coin) => coin.symbol === "HIVE");

                let amountOut = currency === "SWAP.HIVE" ? hiveLeft.times(BigNumber(1).minus(defaultEngineSwapPenalty)) : hiveLeft;

                // add to best routes
                bestRoutesUngrouped.push({
                    from: {
                        symbol: "HIVE",
                        amount: hiveLeft,
                        amountHive: hiveLeft,
                        amountUSD: hiveCoinData?.usd.times(hiveLeft) ?? BigNumber(0),
                    },
                    to: {
                        symbol: currency,
                        amount: amountOut,
                        amountHive: amountOut,
                        amountUSD: hiveCoinData?.usd.times(amountOut) ?? BigNumber(0),
                    },
                    percentageProfit: amountOut.div(hiveLeft).minus(BigNumber(1)).times(BigNumber(100)),
                });

                break;
            }

            if (orderOption.coin_data.network_flat_fee.gt(0) && hiveLeft.lt(orderOption.quantity.times(orderOption.price))) {
                // we would need to recalculate the flat fee based on the reduced quantity, and we don't want to compute that right now
                continue;
            }

            let fromCoin = "";
            let toCoin = "";

            let hiveMultiplier = BigNumber(1);
            let hiveToUSDMultiplier = coinsData.filter(coin => coin.symbol === "HIVE")[0].usd ?? BigNumber(1);

            if (orderSide === "buy") {
                fromCoin = orderOption.symbol;
                toCoin = currency;

                hiveMultiplier = coinsData.filter(coin => coin.swap_symbol === fromCoin)[0].hive ?? BigNumber(1);
            } else {
                fromCoin = currency;
                toCoin = orderOption.symbol;

                hiveMultiplier = coinsData.filter(coin => coin.swap_symbol === toCoin)[0].hive ?? BigNumber(1);
            }

            let amountHiveInOrOut = orderOption.quantity.times(orderOption.price);

            if (hiveLeft.lt(amountHiveInOrOut)) {
                // we don't have enough hive to buy this much of the other coin
                amountHiveInOrOut = hiveLeft;
            }

            let amountTokenInOrOut = amountHiveInOrOut.div(orderOption.price);

            if (fromCoin === currency) {
                bestRoutesUngrouped.push({
                    from: {
                        symbol: fromCoin,
                        amount: amountHiveInOrOut,
                        amountHive: amountHiveInOrOut,
                        amountUSD: amountHiveInOrOut.times(hiveToUSDMultiplier),
                    },
                    to: {
                        symbol: toCoin,
                        amount: amountTokenInOrOut,
                        amountHive: amountTokenInOrOut.times(hiveMultiplier),
                        amountUSD: amountTokenInOrOut.times(orderOption.coin_data.usd),
                    },
                    percentageProfit: orderOption.profit_percentage
                });
            } else {
                bestRoutesUngrouped.push({
                    from: {
                        symbol: fromCoin,
                        amount: amountTokenInOrOut,
                        amountHive: amountTokenInOrOut.times(hiveMultiplier),
                        amountUSD: amountTokenInOrOut.times(orderOption.coin_data.usd),
                    },
                    to: {
                        symbol: toCoin,
                        amount: amountHiveInOrOut,
                        amountHive: amountHiveInOrOut,
                        amountUSD: amountHiveInOrOut.times(hiveToUSDMultiplier),
                    },
                    percentageProfit: orderOption.profit_percentage
                });
            }

            // subtract from hive left
            hiveLeft = hiveLeft.minus(amountHiveInOrOut);
        }

        // group best routes by coin
        let bestRoutesGrouped = [];

        for (let i = 0; i < bestRoutesUngrouped.length; i++) {
            const route = bestRoutesUngrouped[i];

            let found = false;

            for (let j = 0; j < bestRoutesGrouped.length; j++) {
                const groupedRoute = bestRoutesGrouped[j];

                if (groupedRoute.from.symbol === route.from.symbol && groupedRoute.to.symbol === route.to.symbol) {
                    groupedRoute.from.amount = groupedRoute.from.amount.plus(route.from.amount);
                    groupedRoute.from.amountHive = groupedRoute.from.amountHive.plus(route.from.amountHive);
                    groupedRoute.from.amountUSD = groupedRoute.from.amountUSD.plus(route.from.amountUSD);

                    groupedRoute.to.amount = groupedRoute.to.amount.plus(route.to.amount);
                    groupedRoute.to.amountHive = groupedRoute.to.amountHive.plus(route.to.amountHive);
                    groupedRoute.to.amountUSD = groupedRoute.to.amountUSD.plus(route.to.amountUSD);

                    groupedRoute.percentageProfit = groupedRoute.to.amountHive.div(groupedRoute.from.amountHive).minus(1).abs();

                    found = true;
                    break;
                }
            }

            if (!found) {
                bestRoutesGrouped.push(route);
            }
        }

        setBestRoutes(bestRoutesGrouped);
    };

    useEffect(() => {
        calculateBestRoute();
    }, [depositCost, depositAmount, orderSide, coinsData, currency]);

    useEffect(() => {
        calculateBestRoute();
    }, []); // on page load


    const onCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.currentTarget.value === "HIVE" || e.currentTarget.value === "SWAP.HIVE") {
            setCurrency(e.currentTarget.value);
        }

        return;
    };

    const onAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isNaN(Number(e.currentTarget.value))) {
            setDepositAmount(Number(e.currentTarget.value));
        } else {
            setDepositAmount(depositAmount);
        }
    }

    return (
        <div>
            <nav className="navbar is-info" role="navigation" aria-label="main navigation">
                <div className="navbar-brand">
                    <a className="navbar-item" href="#">
                        <h1 className="title has-text-light">HIO</h1>
                    </a>
                </div>
                <div className="navbar-menu">
                    <div className="navbar-start">
                    </div>
                </div>
            </nav>

            {/* a dark hero with a sidebar to the right showing coin values, a form input in the middle for a composite field of (hive value, currency [swap.hive or hive]), cost of hive deposits to engine and a panel for the best way to cash out your coins (including multiple routes) */}
            <section className="hero is-dark is-fullheight-with-navbar">
                <div className="hero-body">
                    <div className="container">
                        <div className="columns">
                            <div className="column is-one-quarter">
                                <div className="box has-background-success-dark">
                                    <h2 className="title">Coin Values</h2>
                                    {/* if coinsData show $price, hive price and % change (round % to 2dp, prices to 3dp) - single line for each + green or red for percent */}
                                    {coinsData && coinsData.sort(AtoZSort).map(coin => {
                                        return <div className="box has-background-grey-darker p-1 m-1"><p
                                            className="has-text-light">
                                            <strong>{coin.symbol}</strong> ${SmartCurrencyFormat(coin.usd, "usd")} / {SmartCurrencyFormat(coin.hive, "hive")} HIVE <strong
                                            className={coin.usd_24h_change.gt(0) ? "has-text-success" : "has-text-danger"}>({coin.usd_24h_change.toFixed(2)}%)</strong>
                                        </p></div>
                                    })}

                                    {/* need CoinGecko reference to comply with terms */}
                                    <p className="has-text-light">Powered by <a href="https://www.coingecko.com/en/api"
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="is-underlined">CoinGecko
                                        API</a>
                                    </p>
                                    <p class="has-text-white">HBD -&gt; Hive Prices From the Internal Market</p>
                                </div>
                            </div>

                            <div className="column">
                                <div className="box has-background-info">
                                    <h2 className="title">Hive Value</h2>
                                    <label className="label">Amount of coins to {orderSide}</label>
                                    <div className="field has-addons">
                                        <div className="control">
                                            <button className={"button " + (orderSide === "buy" ? "is-primary" : "is-dark")} onClick={() => setOrderSide("buy")}>Buy</button>
                                        </div>
                                        <div className="control">
                                            <button className={"button " + (orderSide === "sell" ? "is-danger" : "is-dark")} onClick={() => setOrderSide("sell")}>Sell</button>
                                        </div>
                                        <div className="control is-expanded">
                                            <input className="input" type="text" placeholder="100" value={depositAmount} onChange={onAmountChange} />
                                            <p className="help">The amount of {currency} you want to {orderSide}.</p>
                                        </div>
                                        <div className="control">
                                            <div className="select">
                                                <select value={currency} onChange={onCurrencyChange}>
                                                    <option>HIVE</option>
                                                    <option>SWAP.HIVE</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="field">
                                        <label className="label">Hive-Engine Deposit/Withdrawal Cost
                                            (%)</label>
                                        <div className="control">
                                            <input className="input" type="text" value={depositCost}
                                                   onChange={e => setDepositCost(Number(e.currentTarget.value))}
                                                   placeholder="Deposit/Withdrawal Cost"/>
                                            <p className="help">The cost
                                                of depositing and withdrawing SWAP.HIVE to and from hive-engine.
                                                This is used to calculate the best route.</p>
                                        </div>
                                    </div>

                                    {/* coloured box for best route information */}
                                    <div className="box is-dark has-background-info-dark">
                                        <h2 className="title has-text-success-light">Best Route</h2>
                                        {/* display the best routes */}
                                        {bestRoutes && bestRoutes.map(route => {
                                            return <div className="box has-background-grey-darker p-1 m-1"><p
                                                className="has-text-light">
                                                {SmartCurrencyFormat(route.from.amount, route.from.symbol)} <strong> {route.from.symbol}</strong> <span style={{display: route.from.amountHive.isEqualTo(route.from.amount) ? "none" : "inline"}}>(~ {SmartCurrencyFormat(route.from.amountHive, "hive")} HIVE)</span> (~ {SmartCurrencyFormat(route.from.amountUSD, "usd")} USD) -&gt; {SmartCurrencyFormat(route.to.amount, route.to.symbol)} <strong> {route.to.symbol}</strong> <span style={{display: route.to.amountHive.isEqualTo(route.to.amount) ? "none" : "inline"}}>(~ {SmartCurrencyFormat(route.to.amountHive, "hive")} HIVE)</span> (~ {SmartCurrencyFormat(route.to.amountUSD, "usd")} USD) <strong
                                                className={route.percentageProfit.lt(0) ? "has-text-danger" : "has-text-success"}>({route.percentageProfit.toFixed(2)}%)</strong>
                                            </p></div>
                                        })}
                                    </div>
                                    <p class="has-text-light has-text-weight-bold">If you enjoy using this app, please consider voting <a href="https://hivel.ink/@cadawg" class="is-underlined">@cadawg</a> as a <a href="https://vote.hive.uno/@cadawg" class="is-underlined">Hive Witness</a> or <a href="https://votify.vercel.app/cadengine" class="is-underlined">Hive-Engine Witness</a></p>
                                    <p class="has-text-light" style="font-size: 0.8em;">
                                        Disclaimer: The app's suggested routes for cryptocurrency withdrawal and deposits are provided for informational purposes only and should not be considered financial advice. Users should be aware of potential risks such as faulty calculations, outdated market data, and the possibility of prices and orders changing before completing a deposit or withdrawal. The app does not guarantee accuracy or timeliness of information, and users are responsible for their own research and decision-making.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

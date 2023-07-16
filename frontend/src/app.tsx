import 'bulma/css/bulma.min.css';
import {useEffect, useState} from "preact/compat";
import GetCoinsData, {CoinData, ParsedCoinData, ParsedCoinDataArrayOrNull, ParsedOrder} from "./coindata.ts";
import BigNumber from "bignumber.js";
import {JSX} from "preact";

function AtoZSort(a: ParsedCoinData|CoinData, b: ParsedCoinData|CoinData): number {
    if (a.symbol < b.symbol) {
        return -1;
    } else if (a.symbol > b.symbol) {
        return 1;
    } else {
        return 0;
    }
}

function SmartCurrencyFormat(value: BigNumber, isUSD: boolean): string {
    if (isUSD) {
        // format: 3dp if < 1, 2dp if < 10, 1dp if < 100, 0dp if > 100
        if (value.lt(1)) {
            return value.toFixed(3);
        } else if (value.lt(10)) {
            return value.toFixed(2);
        } else if (value.lt(100)) {
            return value.toFixed(1);
        } else {
            return value.toFixed(0);
        }
    }

    // format: 3dp if < 10, 2dp if < 100, 1dp if < 1000, 0dp if > 1000
    if (value.lt(10)) {
        return value.toFixed(3);
    } else if (value.lt(100)) {
        return value.toFixed(2);
    } else if (value.lt(1000)) {
        return value.toFixed(1);
    } else {
        return value.toFixed(0);
    }
}

/**
 * The best route to cash out your coins
 */
export type BestRoute = {
    from: string,
    to: string,
    amountHive: BigNumber,
    percentageProfit: BigNumber,
    outHiveEquivalent: BigNumber
};


export function App(): JSX.Element {
    let [currency, setCurrency] = useState<"HIVE"|"SWAP.HIVE">('HIVE');
    let [depositCost, setDepositCost] = useState<number>(1);
    let [depositAmount, setDepositAmount] = useState<number>(1);
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
        let defaultHivePenalty = BigNumber(0);
        let defaultSwapHivePenalty = BigNumber(0);

        if (currency === 'HIVE') {
            // if we are buying coins, we need to deposit hive to the engine
            defaultSwapHivePenalty = BigNumber(depositCost).div(BigNumber(100));
        }

        if (currency === 'SWAP.HIVE') {
            defaultHivePenalty = BigNumber(depositCost).div(BigNumber(100));
        }

        if (coinsData === null || typeof coinsData === 'undefined' || coinsData.length === 0) {
            return;
        }

        let hiveAmountOut = BigNumber(depositAmount).times(BigNumber(1).minus(defaultHivePenalty));

        // work out profit post deposit/withdrawal (minus each coin's deposit/withdrawal fee)
        for (let i = 0; i < coinsData.length; i++) {
            let coin = coinsData[i];

            let orders = orderSide === "buy" ? coin.buy_orders : coin.sell_orders;

            // we want to buy hive or swap.hive with usd/other crypto
            for (let j = 0; j < orders.length; j++) {
                let order = orders[j];

                // add up profit
                let netValueOfOrder = order.price.times(order.quantity);

                // subtract fees
                if (currency === 'HIVE') {
                    // subtract hive withdrawal fee
                    netValueOfOrder = netValueOfOrder.times(BigNumber(1).minus(defaultHivePenalty));
                } else {
                    // subtract swap.hive withdrawal fee
                    netValueOfOrder = netValueOfOrder.times(BigNumber(1).minus(defaultSwapHivePenalty));
                }

                // subtract network deposit/withdrawal fee
                netValueOfOrder = netValueOfOrder.times(BigNumber(1).minus(BigNumber(coin.network_percentage_fee.div(BigNumber(100)))));

                // subtract fixed fee (we should really do this for the whole coin but that adds a bunch of complexity)
                netValueOfOrder = netValueOfOrder.minus(BigNumber(coin.network_flat_fee));

                order.HiveOutPerHiveIn = netValueOfOrder.div(order.quantity.times(coin.hive));

                // calc profit
                order.profit_per_coin = order.HiveOutPerHiveIn.minus(BigNumber(1));
            }
        }

        // orders we can take (array of order with coin data embedded)
        let orderOptions: {coin: ParsedCoinData, order: ParsedOrder}[] = [];

        for (let i = 0; i < coinsData.length; i++) {
            const coin = coinsData[i];

            if (orderSide === "buy") {
                for (let j = 0; j < coin.buy_orders.length; j++) {
                    const order = coin.buy_orders[j];

                    if (order.profit_per_coin?.gt(0)) {
                        orderOptions.push({
                            coin: coin,
                            order: order
                        });
                    }
                }
            } else {
                for (let j = 0; j < coin.sell_orders.length; j++) {
                    const order = coin.sell_orders[j];

                    if (order.profit_per_coin.gt(0)) {
                        orderOptions.push({
                            coin: coin,
                            order: order
                        });
                    }
                }
            }
        }

        // order by profit per hive
        orderOptions.sort((a, b) => {
            if (orderSide === "buy") {
                return b.order.profit_per_coin.minus(a.order.profit_per_coin);
            } else {
                return a.order.profit_per_coin.minus(b.order.profit_per_coin);
            }
        });

        // print best routes until we run out of hive (group all orders by coin)
        let hiveLeft = hiveAmountOut;

        /**
         * @type {BestRoute[]}
         */
        let bestRoutesUngrouped = [];

        while (hiveLeft.gt(0) && orderOptions.length > 0) {
            // pop the best order
            let orderOption = orderOptions.shift();

            if (orderOption.order.profit_per_coin.lte(0.001)) {
                // the rest is just hive

                // add to best routes
                bestRoutesUngrouped.push({
                    from: "HIVE",
                    to: "HIVE",
                    amountHive: hiveLeft,
                    amountInHiveEquivalent: hiveLeft,
                    amountOtherCoinIn: hiveLeft,
                    outHiveEquivalent: hiveLeft,
                    percentageProfit: BigNumber(0)
                });

                break;
            }

            if (orderOption.coin.network_flat_fee.gt(0) && hiveLeft.lt(orderOption.order.quantity.times(orderOption.order.price))) {
                // we would need to recalculate the flat fee based on the reduced quantity, and we don't want to compute that right now
                continue;
            }

            let fromCoin = "";
            let toCoin = "";

            let hiveMultiplier = BigNumber(1);

            if (orderSide === "buy") {
                fromCoin = orderOption.coin.symbol;
                toCoin = "HIVE";

                hiveMultiplier = coinsData.filter(coin => coin.symbol === fromCoin)[0].hive;
            } else {
                fromCoin = "HIVE";
                toCoin = orderOption.coin.symbol;

                hiveMultiplier = coinsData.filter(coin => coin.symbol === toCoin)[0].hive;
            }

            let amountOtherCoinIn = orderOption.order.quantity.times(orderOption.order.price);

            if (hiveLeft.lt(amountOtherCoinIn)) {
                // we don't have enough hive to buy this much of the other coin
                amountOtherCoinIn = hiveLeft.div(orderOption.order.price);
            }

            // add to best routes
            bestRoutesUngrouped.push({
                from: fromCoin,
                to: toCoin,
                amountOtherCoinIn: amountOtherCoinIn,
                amountInHiveEquivalent: amountOtherCoinIn.times(hiveMultiplier),
                outHiveEquivalent: amountOtherCoinIn.times(orderOption.order.price),
                percentageProfit: orderOption.order.profit_per_coin,
            });

            // subtract from hive left
            hiveLeft = hiveLeft.minus(amountOtherCoinIn.times(orderOption.order.price));
        }

        // group best routes by coin
        let bestRoutesGrouped = [];

        for (let i = 0; i < bestRoutesUngrouped.length; i++) {
            const route = bestRoutesUngrouped[i];

            let found = false;

            for (let j = 0; j < bestRoutesGrouped.length; j++) {
                const groupedRoute = bestRoutesGrouped[j];

                if (groupedRoute.from === route.from && groupedRoute.to === route.to) {
                    groupedRoute.amountOtherCoinIn = groupedRoute.amountOtherCoinIn.plus(route.amountOtherCoinIn);
                    groupedRoute.outHiveEquivalent = groupedRoute.outHiveEquivalent.plus(route.outHiveEquivalent);
                    console.log(groupedRoute.outHiveEquivalent.toString(), groupedRoute.amountInHiveEquivalent.toString());
                    groupedRoute.percentageProfit = groupedRoute.outHiveEquivalent.div(groupedRoute.amountInHiveEquivalent).minus(1);

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
                                            <strong>{coin.symbol}</strong> ${SmartCurrencyFormat(coin.usd, true)} / {SmartCurrencyFormat(coin.hive, false)} HIVE <strong
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
                                            <input className="input" type="text" placeholder="100" value={depositAmount} onChange={e => setDepositAmount(Number(e.currentTarget.value))} />
                                            <p className="help">The amount of {currency} you want to {orderSide}.</p>
                                        </div>
                                        <div className="control">
                                            <div className="select">
                                                <select value={currency}
                                                        onChange={e => setCurrency(e.currentTarget.value)}>
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
                                                <strong>{route.from}</strong> to <strong>{route.to}</strong> for {SmartCurrencyFormat(route.amountOtherCoinIn, false)} {route.from} -> HIVE ({SmartCurrencyFormat(route.outHiveEquivalent, false)} {route.to}) <strong
                                                className="has-text-success">({route.percentageProfit.toFixed(2)}%)</strong>
                                            </p></div>
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

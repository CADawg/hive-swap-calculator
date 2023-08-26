import 'bulma/css/bulma.min.css';
import {useEffect, useState} from "preact/compat";
import GetCoinsData, {
    CoinData,
    ParsedCoinData,
    ParsedCoinDataArrayOrNull, ParsedCoinWithOrderProfit,
} from "./coindata.ts";
import BigNumber from "bignumber.js";
import {JSX} from "preact";
import * as React from "preact/compat";
import {
    GetBestRoutesForGivenAmountOfToken,
    GetCoinsWithProcessedOrders
} from "./functions.ts";

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

        if (coinsData === null || typeof coinsData === 'undefined' || coinsData.length === 0) {
            return;
        }

        let hiveAmountOut = BigNumber(depositAmount);

        // get orders with profit data as children of coins
        let processedCoinsData: ParsedCoinWithOrderProfit[] = GetCoinsWithProcessedOrders(coinsData, orderSide, currency, defaultEngineSwapPenalty);

        let routes = GetBestRoutesForGivenAmountOfToken(processedCoinsData, orderSide, currency, hiveAmountOut, defaultEngineSwapPenalty);

        setBestRoutes(routes);
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

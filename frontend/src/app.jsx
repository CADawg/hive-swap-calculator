import 'bulma/css/bulma.min.css';
import {useEffect, useState} from "@preact/compat";
import GetCoinsData from "./coindata.js";

function AtoZSort(a, b) {
    if (a.symbol < b.symbol) {
        return -1;
    } else if (a.symbol > b.symbol) {
        return 1;
    } else {
        return 0;
    }
}

/**
 * @param {BigNumber} value number to format
 * @param {boolean} isUSD whether the value is in USD or not
 * @return {string}
 * @constructor
 */
function SmartCurrencyFormat(value, isUSD) {
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

export function App() {
    let [currency, setCurrency] = useState('HIVE');
    let [depositCost, setDepositCost] = useState(1);
    let [depositAmount, setDepositAmount] = useState(1);
    let [coinsData, setCoinsData] = useState(/** @type {ParsedCoinDataArrayOrNull} */null);

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
     * @param {Event} e
     * */
    const calculateBestRoute = (e) => {
        e.preventDefault();
    }/** @type Event */


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
                                    <label className="label">Amount of coins to sell</label>
                                    <div className="field has-addons">
                                        <div className="control is-expanded">
                                            <input className="input" type="text" placeholder="100" value={depositAmount} onChange={e => setDepositAmount(Number(e.currentTarget.value))} />
                                            <p className="help">The amount of {currency} you want to sell.</p>
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
                                        <label className="label">{currency === "HIVE" ? "Deposit" : "Withdrawal"} Cost
                                            (%)</label>
                                        <div className="control">
                                            <input className="input" type="text" value={depositCost}
                                                   onChange={e => setDepositCost(Number(e.currentTarget.value))}
                                                   placeholder="Deposit/Withdrawal Cost"/>
                                            <p className="help">The cost
                                                of {currency === "HIVE" ? "depositing hive to" : "withdrawing swap.hive from"} hive-engine.
                                                This is used to calculate the best route.</p>
                                        </div>
                                        <div className="control mt-3">
                                            <button className="button is-link" onClick={calculateBestRoute}>Submit</button>
                                        </div>
                                    </div>

                                    {/* coloured box for best route information */}
                                    <div className="box is-dark has-background-info-dark">
                                        <h2 className="title has-text-success-light">Best Route</h2>
                                        <p className="has-text-success-light">hive -> swap.hive -> hive-engine</p>
                                        <p className="has-text-success-light">hive -> hive-engine</p>
                                        <p className="has-text-success-light">hive -> swap.hive</p>
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

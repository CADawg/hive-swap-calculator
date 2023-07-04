import 'bulma/css/bulma.min.css';
import {useEffect, useState} from "@preact/compat";
import GetCoinGeckoData from "./coingecko.js";
import FetchMarketSells from "./marketFetch.js";
import BigNumber from "bignumber.js";

const ETH_GAS_PRICE_URL = "https://ethgw.hive-engine.com/api/utils/withdrawalfee/";
const POLYGON_GAS_PRICE_URL = "https://polygw.hive-engine.com/api/utils/withdrawalfee/";
const BSC_GAS_PRICE_URL = "https://bscgw.hive-engine.com/api/utils/withdrawalfee/";

const CHECK_GAS_PRICE_URLS = [POLYGON_GAS_PRICE_URL, BSC_GAS_PRICE_URL, ETH_GAS_PRICE_URL];

const BSC_TOKENS_URL = "https://bscgw.hive-engine.com/api/utils/tokens/bep20";
const ETH_TOKENS_URL = "https://ethgw.hive-engine.com/api/utils/tokens/erc20";
const POLYGON_TOKENS_URL = "https://polygw.hive-engine.com/api/utils/tokens/erc20";

const CHECK_TOKEN_SUPPORT_URLS = [POLYGON_TOKENS_URL, BSC_TOKENS_URL, ETH_TOKENS_URL];

const TOKEN_SYMBOL_LIST = ["BAT", "BNB", "BUSD", "BTC", "BCH", "DOGE", "EOS", "ETH", "HIVE", "LTC", "MATIC", "USDT", "WAX"];

function GetCoinSymbol(coin) {
    // use following to get symbol/nice name
    let symbols = {
        'basic-attention-token': 'BAT',
        'binancecoin': 'BNB',
        'binance-usd': 'BUSD',
        'bitcoin': 'BTC',
        'bitcoin-cash': 'BCH',
        'dogecoin': 'DOGE',
        'eos': 'EOS',
        'ethereum': 'ETH',
        'hive': 'HIVE',
        'litecoin': 'LTC',
        'matic-network': 'MATIC',
        'tether': 'USDT',
        'wax': 'WAX'
    };

    if (Object.prototype.hasOwnProperty.call(symbols, coin)) {
        return symbols[coin];
    }
}

function GetCoinGeckoName(coin) {
    let names = {
        'BAT': 'basic-attention-token',
        'BNB': 'binancecoin',
        'BUSD': 'binance-usd',
        'BTC': 'bitcoin',
        'BCH': 'bitcoin-cash',
        'DOGE': 'dogecoin',
        'EOS': 'eos',
        'ETH': 'ethereum',
        'HIVE': 'hive',
        'LTC': 'litecoin',
        'MATIC': 'matic-network',
        'USDT': 'tether',
        'WAX': 'wax'
    };

    if (Object.prototype.hasOwnProperty.call(names, coin)) {
        return names[coin];
    }
}

function GetSwapName(coin) {
    const swapNames = {
        "BAT": "SWAP.BAT",
        "BNB": "SWAP.BNB",
        "BUSD": "SWAP.BUSD",
        "BTC": "SWAP.BTC",
        "BCH": "SWAP.BCH",
        "DOGE": "SWAP.DOGE",
        "EOS": "SWAP.EOS",
        "ETH": "SWAP.ETH",
        "HIVE": "SWAP.HIVE",
        "LTC": "SWAP.LTC",
        "MATIC": "SWAP.MATIC",
        "USDT": "SWAP.USDT",
        "WAX": "SWAP.WAX"
    };

    if (Object.prototype.hasOwnProperty.call(swapNames, coin)) {
        return swapNames[coin];
    }
}

function GetCoinName(swapName) {
    const unswapNames = {
        "SWAP.BAT": "BAT",
        "SWAP.BNB": "BNB",
        "SWAP.BUSD": "BUSD",
        "SWAP.BTC": "BTC",
        "SWAP.BCH": "BCH",
        "SWAP.DOGE": "DOGE",
        "SWAP.EOS": "EOS",
        "SWAP.ETH": "ETH",
        "SWAP.HIVE": "HIVE",
        "SWAP.LTC": "LTC",
        "SWAP.MATIC": "MATIC",
        "SWAP.USDT": "USDT",
        "SWAP.WAX": "WAX"
    };

    if (Object.prototype.hasOwnProperty.call(unswapNames, swapName)) {
        return unswapNames[swapName];
    }
}

function SmartCurrencyFormat(value, isUSD) {
    if (isUSD) {
        // format: 3dp if < 1, 2dp if < 10, 1dp if < 100, 0dp if > 100
        if (value < 1) {
            return value.toFixed(3);
        } else if (value < 10) {
            return value.toFixed(2);
        } else if (value < 100) {
            return value.toFixed(1);
        } else {
            return value.toFixed(0);
        }
    }

    // format: 3dp if < 10, 2dp if < 100, 1dp if < 1000, 0dp if > 1000
    if (value < 10) {
        return value.toFixed(3);
    } else if (value < 100) {
        return value.toFixed(2);
    } else if (value < 1000) {
        return value.toFixed(1);
    } else {
        return value.toFixed(0);
    }
}

export function App() {
    let [currency, setCurrency] = useState('HIVE');
    let [depositCost, setDepositCost] = useState(1);
    let [depositAmount, setDepositAmount] = useState(1);
    let [coinGeckoData, setCoinGeckoData] = useState(null);
    let [hiveEngineSupportedData, setHiveEngineSupportedData] = useState({poly: [], bsc: [], eth: []});
    let [hiveEngineFeeData, setHiveEngineFeeData] = useState({poly: [], bsc: [], eth: []});
    let [sellMarketData, setSellMarketData] = useState({});
    const WITHDRAW_TO_ANY_OTHER_NETWORK_FEE = 0.01; // 1% fee to withdraw to any other network
    // calculate price multiplier to need for a trade to be profitable
    // 0.01 fee = 1 hive => 0.99 hive
    const PRICE_MULTIPLIER = BigNumber(1).dividedBy(BigNumber(1).minus(BigNumber(WITHDRAW_TO_ANY_OTHER_NETWORK_FEE)));

    useEffect(() => {
        const updateCoinGeckoData = async () => setCoinGeckoData(await GetCoinGeckoData());

        updateCoinGeckoData().then(r => {
        });

        const interval = setInterval(() => {
            updateCoinGeckoData().then(r => {
            });
        }, 30000);

        return () => clearInterval(interval);
    }, []);


    useEffect(() => {
        (async function () {
            if (coinGeckoData === null) {
                return;
            }

            const data = {};

            // for each token we know of
            for (const tokenId in TOKEN_SYMBOL_LIST) {
                let token = TOKEN_SYMBOL_LIST[tokenId];

                // fetch sell orders above price + WITHDRAW_TO_ANY_OTHER_NETWORK_FEE
                data[token] = await FetchMarketSells(GetSwapName(token), BigNumber(coinGeckoData[GetCoinGeckoName(token)].hive).times(PRICE_MULTIPLIER).toFixed(18));
            }

            setSellMarketData(data);
        })(coinGeckoData);
    }, [coinGeckoData]);

    const calculateBestRoute = (e) => {
        e.PreventDefault();
        e.StopPropagation();

        let realHiveAmount = BigNumber(depositAmount);

        // work out how much it's worth if we sell it as hive
        if (currency === "SWAP.HIVE") {
            // remove fee
            realHiveAmount = realHiveAmount.times(BigNumber(1).minus(BigNumber(depositCost).dividedBy(100)));
        }

        let pricePerHiveAsHive = realHiveAmount.div(depositAmount);

        // calculate alternative routes
        let alternativeRoutes = [];

        // for each token we know of
        for (const token in sellMarketData) {
            let convertToPaymentCurrencyMultiplier = BigNumber(1);

            if (currency === "HIVE") {
                convertToPaymentCurrencyMultiplier = BigNumber(1).minus(BigNumber(depositCost).dividedBy(100));
            }

            // loop through sellmarketdata until we've sold all our hive

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
                                    {/* if coingeckodata show $price, hive price and % change (round % to 2dp, prices to 3dp) - single line for each + green or red for percent */}
                                    {coinGeckoData && Object.keys(coinGeckoData).map(coin => {
                                        return <div className="box has-background-grey-darker p-1 m-1"><p
                                            className="has-text-light">
                                            <strong>{GetCoinSymbol(coin)}</strong> ${SmartCurrencyFormat(coinGeckoData[coin].usd, true)} / {SmartCurrencyFormat(coinGeckoData[coin].hive, false)} HIVE <strong
                                            className={coinGeckoData[coin].usd_24h_change > 0 ? "has-text-success" : "has-text-danger"}>({coinGeckoData[coin].usd_24h_change.toFixed(2)}%)</strong>
                                        </p></div>
                                    })}

                                    {/* need coingecko reference to comply with terms */}
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

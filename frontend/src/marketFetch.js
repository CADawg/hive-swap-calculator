export default async function FetchMarketSells(symbol, priceLessThan) {
    let orders = [];
    let lastOrders = [];

    let offset = 0;

    do {
        let response = await GetSellOrders(symbol, priceLessThan, offset);

        if (response.status !== 200) {
            console.log(response);
            return;
        }

        let data = await response.json();

        if (data.result !== null) {
            orders = orders.concat(data.result);
            lastOrders = data.result;
        }

        offset += 1000;
    } while (lastOrders.length === 1000);

    return orders;
}

async function GetSellOrders(symbol, priceLessThan, offset) {
    return await fetch('https://engine.rishipanthee.com/contracts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "find",
            "params": {
                "contract": "market",
                "table": "sellBook",
                "query": {
                    "price": {
                        "$lt": priceLessThan
                    },
                    "symbol": symbol,
                },
                offset: offset,
                limit: 1000,
            }
        })
    });
}
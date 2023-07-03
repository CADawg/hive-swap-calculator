/*

useEffect(() => {
        // load supported tokens on page load
        const updateHiveEngineSupportedData = async () => {
            let polySupported = [];
            let bscSupported = [];
            let ethSupported = [];

            for (const url of CHECK_TOKEN_SUPPORT_URLS) {
                const response = await fetch(url);
                const data = await response.json();

                if (data.status === "success") {
                    if (url === POLYGON_TOKENS_URL) {
                        polySupported = data.data;
                    } else if (url === BSC_TOKENS_URL) {
                        bscSupported = data.data;
                    } else if (url === ETH_TOKENS_URL) {
                        ethSupported = data.data;
                    }
                }
            }

            setHiveEngineSupportedData({poly: polySupported, bsc: bscSupported, eth: ethSupported});
        }

        updateHiveEngineSupportedData().then(r => updateHiveEngineFeeData().then(r => {
            console.log("Done")
        }));


    }, []);



    useEffect(() => {
        const interval = setInterval(() => {
            updateHiveEngineFeeData().then(r => {
            });
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    const updateHiveEngineFeeData = async () => {
        let engineFeeData = {poly: [], bsc: [], eth: []};

        let i = 0;
        for (const url of CHECK_GAS_PRICE_URLS) {
            let tokenType = "";

            if (url === POLYGON_GAS_PRICE_URL) {
                tokenType = "poly";
            } else if (url === BSC_GAS_PRICE_URL) {
                tokenType = "bsc";
            } else if (url === ETH_GAS_PRICE_URL) {
                tokenType = "eth";
            }

            for (const token of hiveEngineSupportedData[tokenType]) {
                const response = await fetch(url + token.heSymbol);
                const data = await response.json();

                if (data.status === "success") {
                    if (url === POLYGON_GAS_PRICE_URL) {
                        engineFeeData[tokenType][token.heSymbol] = data.data;
                    } else if (url === BSC_GAS_PRICE_URL) {
                        engineFeeData[tokenType][token.heSymbol] = data.data;
                    } else if (url === ETH_GAS_PRICE_URL) {
                        engineFeeData[tokenType][token.heSymbol] = data.data;
                    }
                }
            }
        }

        setHiveEngineFeeData(engineFeeData);
    }

 */
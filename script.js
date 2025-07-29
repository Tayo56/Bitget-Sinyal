function macd(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    if (data.length < longPeriod + signalPeriod) return { macd: null, signal: null, histogram: null };
    let emaShort = [], emaLong = [];
    for (let i = longPeriod - shortPeriod; i < data.length; i++) {
        emaShort.push(ema(data.slice(0, i + shortPeriod), shortPeriod));
    }
    for (let i = 0; i < data.length; i++) {
        emaLong.push(ema(data.slice(0, i + longPeriod), longPeriod));
    }
    let macdLine = [];
    for (let i = 0; i < emaShort.length; i++) {
        macdLine.push(emaShort[i] - emaLong[i + (shortPeriod - 1)]);
    }
    let signalLine = [];
    for (let i = signalPeriod - 1; i < macdLine.length; i++) {
        signalLine.push(ema(macdLine.slice(0, i + 1), signalPeriod));
    }
    let latestMacd = macdLine[macdLine.length - 1];
    let latestSignal = signalLine[signalLine.length - 1];
    let latestHistogram = latestMacd - latestSignal;
    return { macd: latestMacd, signal: latestSignal, histogram: latestHistogram };
}

function getPriceAction(closes) {
    const len = closes.length;
    const last = closes[len - 1];
    const before = closes[len - 5] || closes[0];
    if (last > before * 1.01) return "Uptrend";
    if (last < before * 0.99) return "Downtrend";
    return "Sideways";
}

function getVolumeStatus(volumes) {
    const len = volumes.length;
    const recent = volumes.slice(len - 5, len);
    const prev = volumes.slice(len - 10, len - 5);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgPrev = prev.reduce((a, b) => a + b, 0) / prev.length;
    if (avgRecent > avgPrev * 1.2) return "Naik";
    if (avgRecent < avgPrev * 0.8) return "Turun";
    return "Stabil";
}

// Reason baris (horizontal, semua indikator selalu tampil)
function getReasonRow(ema9, ema12, ma50, rsiVal, macdVal, priceAction, volStat) {
    let macdSignal = "-";
    if (macdVal && macdVal.histogram !== null) {
        if (macdVal.histogram > 0) macdSignal = "Bullish";
        else if (macdVal.histogram < 0) macdSignal = "Bearish";
        else macdSignal = "Netral";
    }
    return `EMA9: ${ema9 !== null ? ema9.toFixed(2) : "-"}, EMA12: ${ema12 !== null ? ema12.toFixed(2) : "-"}, MA50: ${ma50 !== null ? ma50.toFixed(2) : "-"}, RSI: ${rsiVal !== null ? rsiVal.toFixed(2) : "-"}, MACD: ${macdSignal}, Price Action: ${priceAction}, Volume: ${volStat}`;
}

function getSignal(closes, ema9, prevEma9, ema12, prevEma12) {
    if (prevEma9 > prevEma12 && ema9 < ema12) return "EMA Cross Down (scalping)";
    if (prevEma9 < prevEma12 && ema9 > ema12) return "EMA Cross Up (scalping)";
    return "Tidak ada sinyal kuat (EMA 9/12)";
}

document.getElementById('analyzeBtn').onclick = async function() {
    const symbol = document.getElementById('symbol').value;
    const tf = document.getElementById('timeframe').value;
    document.getElementById('analyze-date').innerText = "Loading...";
    let candles = [];
    try {
        candles = await fetchCandles(symbol, tf, 100);
    } catch (e) {
        document.getElementById('analyze-date').innerText = "Fetch error: " + e;
        return;
    }
    if (!candles || candles.length < 50) {
        document.getElementById('analyze-date').innerText = "Gagal fetch data atau data kosong!";
        return;
    }
    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const lastPrice = closes[closes.length - 1];
    const support = Math.min(...closes.slice(-20));
    const resistance = Math.max(...closes.slice(-20));
    const rsiVal = rsi(closes, 14);
    const ma50 = sma(closes, 50);
    const ema9 = ema(closes, 9);
    const ema12 = ema(closes, 12);
    const prevEma9 = ema(closes.slice(0, closes.length - 1), 9);
    const prevEma12 = ema(closes.slice(0, closes.length - 1), 12);
    const macdVal = macd(closes);
    const priceAction = getPriceAction(closes);
    const volStat = getVolumeStatus(volumes);

    const signal = getSignal(closes, ema9, prevEma9, ema12, prevEma12);
    const reason = getReasonRow(ema9, ema12, ma50, rsiVal, macdVal, priceAction, volStat);

    const openPos = signal.includes("Down") ? "SELL" : signal.includes("Up") ? "BUY" : "HOLD";
    const sltp = openPos === "BUY"
        ? `SL: ${support.toFixed(2)}<br>TP: ${resistance.toFixed(2)}`
        : openPos === "SELL"
        ? `SL: ${resistance.toFixed(2)}<br>TP: ${support.toFixed(2)}`
        : "-";
    const chartLink = `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol.replace("USDT", "USD")}`;

    document.getElementById('analyze-date').innerText =
        "Data analisa terakhir: " + new Date(candles[candles.length - 1].time).toLocaleString();

    const tbody = document.querySelector('#result-table tbody');
    tbody.innerHTML = `
      <tr>
        <td><span style="font-size:1.3em;cursor:pointer;">☆</span></td>
        <td>${symbol}</td>
        <td>${lastPrice.toFixed(2)}</td>
        <td>${support.toFixed(2)}</td>
        <td>${resistance.toFixed(2)}</td>
        <td>${rsiVal !== null ? rsiVal.toFixed(2) : '-'}</td>
        <td><b>${signal}</b></td>
        <td style="white-space:pre-line">${reason}</td>
        <td>${openPos}</td>
        <td>${sltp}</td>
        <td><a href="${chartLink}" class="chart-link" target="_blank">Chart</a></td>
      </tr>
    `;
};

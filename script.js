async function fetchCandles(symbol, interval = "15m", limit = 100) {
    const url = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${symbol}&granularity=${interval}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.data.map(row => ({
        time: Number(row[0]),
        open: parseFloat(row[1]),
        high: parseFloat(row[2]),
        low: parseFloat(row[3]),
        close: parseFloat(row[4]),
        volume: parseFloat(row[5]),
    })).reverse();
}
function sma(data, period) {
    if (data.length < period) return null;
    let sum = 0;
    for (let i = data.length - period; i < data.length; i++) {
        sum += data[i];
    }
    return sum / period;
}
function ema(data, period) {
    if (data.length < period) return null;
    let k = 2 / (period + 1);
    let emaPrev = sma(data.slice(0, period), period);
    for (let i = period; i < data.length; i++) {
        emaPrev = data[i] * k + emaPrev * (1 - k);
    }
    return emaPrev;
}
function rsi(data, period = 14) {
    if (data.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
        let diff = data[i] - data[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    if (gains + losses === 0) return 50;
    let rs = gains / (losses || 0.0001);
    return 100 - (100 / (1 + rs));
}
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

function getReason(lastPrice, rsiVal, maVal, emaVal, macdVal, closes) {
    let reasons = [];
    // RSI
    if (rsiVal < 30) reasons.push("RSI Oversold");
    else if (rsiVal > 70) reasons.push("RSI Overbought");
    else reasons.push("RSI Netral");
    // MA
    if (lastPrice > maVal) reasons.push("Price > MA");
    else reasons.push("Price < MA");
    // EMA
    if (lastPrice > emaVal) reasons.push("Price > EMA");
    else reasons.push("Price < EMA");
    // MACD
    if (macdVal.histogram > 0) reasons.push("MACD Bullish");
    else if (macdVal.histogram < 0) reasons.push("MACD Bearish");
    else reasons.push("MACD Netral");
    // Price Action sederhana
    const trend = closes[closes.length - 1] > closes[closes.length - 4] ? "Uptrend" : "Downtrend";
    reasons.push(`Price Action: ${trend}`);
    return reasons.join(", ");
}

function getOpenPosition(rsiVal, lastPrice, maVal, emaVal, macdVal) {
    if (rsiVal < 30 && lastPrice > maVal && macdVal.histogram > 0) return "BUY";
    if (rsiVal > 70 && lastPrice < maVal && macdVal.histogram < 0) return "SELL";
    if (macdVal.histogram > 0 && lastPrice > emaVal) return "BUY";
    if (macdVal.histogram < 0 && lastPrice < emaVal) return "SELL";
    return "HOLD";
}
function getSLTP(openPos, support, resistance) {
    if (openPos === "BUY") return `SL: ${support.toFixed(6)} / TP: ${resistance.toFixed(6)}`;
    if (openPos === "SELL") return `SL: ${resistance.toFixed(6)} / TP: ${support.toFixed(6)}`;
    return "-";
}
function getChartLink(symbol) {
    const s = symbol.replace("USDT", "USD");
    return `https://www.tradingview.com/chart/?symbol=BINANCE:${s}`;
}

document.getElementById('analyzeBtn').onclick = async function() {
    const symbol = document.getElementById('symbol').value;
    const tf = document.getElementById('timeframe').value;
    document.getElementById('analyze-date').innerText = "Loading...";
    const candles = await fetchCandles(symbol, tf, 100);
    if (!candles || candles.length < 30) {
        document.getElementById('analyze-date').innerText = "Gagal fetch data!";
        return;
    }
    const closes = candles.map(c => c.close);
    const lastPrice = closes[closes.length - 1];
    const support = Math.min(...closes.slice(-20));
    const resistance = Math.max(...closes.slice(-20));
    const rsiVal = rsi(closes, 14);
    const maVal = sma(closes, 14);
    const emaVal = ema(closes, 14);
    const macdVal = macd(closes);

    const reason = getReason(lastPrice, rsiVal, maVal, emaVal, macdVal, closes);
    const openPos = getOpenPosition(rsiVal, lastPrice, maVal, emaVal, macdVal);
    const sltp = getSLTP(openPos, support, resistance);
    const chartLink = getChartLink(symbol);

    document.getElementById('analyze-date').innerText =
        "Data analisa terakhir: " + new Date(candles[candles.length - 1].time).toLocaleString();
    const tbody = document.querySelector('#result-table tbody');
    tbody.innerHTML = `
      <tr>
        <td><span style="font-size:1.3em;cursor:pointer;">☆</span></td>
        <td>${symbol}</td>
        <td>${lastPrice.toFixed(6)}</td>
        <td>${support.toFixed(6)}</td>
        <td>${resistance.toFixed(6)}</td>
        <td>${rsiVal ? rsiVal.toFixed(2) : '-'}</td>
        <td>${reason}</td>
        <td>${openPos}</td>
        <td>${sltp}</td>
        <td><a href="${chartLink}" class="chart-link" target="_blank">Chart</a></td>
      </tr>
    `;
};

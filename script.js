// =================== FETCH DATA =====================
async function fetchCandles(symbol, interval = "15min", limit = 100) {
    // Mapping interval biar cocok ke Bitget
    let g = interval;
    if (g.endsWith("m")) g = g.replace("m", "min");
    if (g === "1h") g = "1hour";
    if (g === "4h") g = "4hour";
    if (g === "1d") g = "1day";
    // Add mapping sesuai interval yang kamu pakai
    const url = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${symbol}&granularity=${g}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.data) throw new Error("No data returned");
    return data.data.map(row => ({
        time: Number(row[0]),
        open: parseFloat(row[1]),
        high: parseFloat(row[2]),
        low: parseFloat(row[3]),
        close: parseFloat(row[4]),
        volume: parseFloat(row[5]),
    })).reverse();
}

// =================== TEKNIKAL =======================
function sma(data, period) {
    if (data.length < period) return null;
    let sum = 0;
    for (let i = data.length - period; i < data.length; i++) sum += data[i];
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
    for (let i = data.length - period + 1; i < data.length; i++) {
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
function getSignal(closes, ema9, prevEma9, ema12, prevEma12) {
    if (prevEma9 > prevEma12 && ema9 < ema12) return "EMA Cross Down (scalping)";
    if (prevEma9 < prevEma12 && ema9 > ema12) return "EMA Cross Up (scalping)";
    return "Tidak ada sinyal kuat (EMA 9/12)";
}
function getReasonRow(ema9, ema12, ma50, rsiVal, macdVal, priceAction, volStat) {
    let macdSignal = "-";
    if (macdVal && macdVal.histogram !== null) {
        if (macdVal.histogram > 0) macdSignal = "Bullish";
        else if (macdVal.histogram < 0) macdSignal = "Bearish";
        else macdSignal = "Netral";
    }
    return `EMA9: ${ema9 !== null ? ema9.toFixed(2) : "-"}, EMA12: ${ema12 !== null ? ema12.toFixed(2) : "-"}, MA50: ${ma50 !== null ? ma50.toFixed(2) : "-"}, RSI: ${rsiVal !== null ? rsiVal.toFixed(2) : "-"}, MACD: ${macdSignal}, Price Action: ${priceAction}, Volume: ${volStat}`;
}
function getOpenPosition(signal) {
    if (signal.includes("Down")) return "SELL";
    if (signal.includes("Up")) return "BUY";
    return "HOLD";
}
function getSLTP(openPos, support, resistance) {
    if (openPos === "BUY") return `SL: ${support.toFixed(2)}<br>TP: ${resistance.toFixed(2)}`;
    if (openPos === "SELL") return `SL: ${resistance.toFixed(2)}<br>TP: ${support.toFixed(2)}`;
    return "-";
}
function getChartLink(symbol) {
    const s = symbol.replace("USDT", "USD");
    return `https://www.tradingview.com/chart/?symbol=BINANCE:${s}`;
}

// ================== MAIN EVENT =====================
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
    const openPos = getOpenPosition(signal);
    const sltp = getSLTP(openPos, support, resistance);
    const chartLink = getChartLink(symbol);

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
        <td style="white-space:nowrap">${reason}</td>
        <td>${openPos}</td>
        <td>${sltp}</td>
        <td><a href="${chartLink}" class="chart-link" target="_blank">Chart</a></td>
      </tr>
    `;
};

async function fetchCandles(symbol, interval = "15min", limit = 100) {
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
    for (let i = data.length - period; i < data.length; i++) {
        let diff = data[i] - data[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    if (gains + losses === 0) return 50;
    let rs = gains / (losses || 0.0001);
    return 100 - (100 / (1 + rs));
}

// SIGNAL: Hanya EMA cross up/down, Reason mirip icrypto
function getSignalAndReasonEMAOnly(lastPrice, prevEma, emaVal, rsiVal, priceAction) {
    let signal = "Tidak ada sinyal kuat (scalping)";
    let reason = [];
    
    if (prevEma && emaVal && lastPrice < emaVal && prevEma > emaVal) {
        signal = "EMA Cross Down (scalping)";
        reason.push(`- Harga cross down EMA (${lastPrice.toFixed(2)} < ${emaVal.toFixed(2)})`);
        reason.push(`- EMA turun (${emaVal.toFixed(2)} < ${prevEma.toFixed(2)})`);
        reason.push(`- RSI melemah (${rsiVal !== null ? rsiVal.toFixed(2) : '-'})`);
        reason.push(`- Tidak ada price action, sinyal sedang`);
        reason.push(`- Tidak ada doji, sinyal kuat`);
        reason.push("Sinyal bearish sedang, tetap perhatikan level support.");
    } else if (prevEma && emaVal && lastPrice > emaVal && prevEma < emaVal) {
        signal = "EMA Cross Up (scalping)";
        reason.push(`- Harga cross up EMA (${lastPrice.toFixed(2)} > ${emaVal.toFixed(2)})`);
        reason.push(`- EMA naik (${emaVal.toFixed(2)} > ${prevEma.toFixed(2)})`);
        reason.push(`- RSI menguat (${rsiVal !== null ? rsiVal.toFixed(2) : '-'})`);
        reason.push(`- Tidak ada price action, sinyal sedang`);
        reason.push(`- Tidak ada doji, sinyal kuat`);
        reason.push("Sinyal bullish sedang, tetap perhatikan level resistance.");
    } else {
        signal = "Tidak ada sinyal kuat (scalping)";
        reason.push(`ATR: - , EMA: ${emaVal !== null ? emaVal.toFixed(2) : '-'}, RSI: ${rsiVal !== null ? rsiVal.toFixed(2) : '-'} `);
        reason.push(`Harga: ${lastPrice !== null ? lastPrice.toFixed(2) : '-'}`);
        reason.push("Tunggu konfirmasi lebih jelas dari indikator.");
    }
    return { signal, reason };
}

function getOpenPosition(signal) {
    if (signal.includes("Cross Down")) return "SELL";
    if (signal.includes("Cross Up")) return "BUY";
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
    if (!candles || candles.length < 30) {
        document.getElementById('analyze-date').innerText = "Gagal fetch data atau data kosong!";
        return;
    }
    const closes = candles.map(c => c.close);
    const lastPrice = closes[closes.length - 1];
    const support = Math.min(...closes.slice(-20));
    const resistance = Math.max(...closes.slice(-20));
    const rsiVal = rsi(closes, 14);
    const emaVal = ema(closes, 14);
    const prevEma = ema(closes.slice(0, closes.length - 1), 14);
    const priceAction = closes[closes.length - 1] > closes[closes.length - 4] ? "Uptrend" : "Downtrend";

    const { signal, reason } = getSignalAndReasonEMAOnly(
        lastPrice, prevEma, emaVal, rsiVal, priceAction
    );

    const reasonHtml = `<ul class="reason-list">${reason.map(r => `<li>${r}</li>`).join('')}</ul>`;
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
        <td>${reasonHtml}</td>
        <td>${openPos}</td>
        <td>${sltp}</td>
        <td><a href="${chartLink}" class="chart-link" target="_blank">Chart</a></td>
      </tr>
    `;
};

// ========== Helper Fungsi ==========
function roundNum(num, digit = 2) {
    return Number(num).toFixed(digit);
}

// ========== Ambil data dari Bitget ==========
async function fetchKlines(symbol, interval, limit = 50) {
    const url = `https://api.bitget.com/api/v2/spot/market/kline?symbol=${symbol}&granularity=${interval}&limit=${limit}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.code !== "00000") throw new Error("API error: " + data.msg);
    return data.data.map(arr => ({
        open: parseFloat(arr[1]),
        high: parseFloat(arr[2]),
        low: parseFloat(arr[3]),
        close: parseFloat(arr[4]),
        volume: parseFloat(arr[5]),
        ts: arr[0]
    }));
}

// ========== Hitung Indikator ==========
function calcEMA(prices, period) {
    let k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
}
function calcMA(prices, period) {
    let ma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
    return ma;
}
function calcRSI(prices, period = 14) {
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length - 1; i++) {
        let diff = prices[i + 1] - prices[i];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    if (gains + losses === 0) return 50;
    let rs = gains / (losses || 1);
    return 100 - (100 / (1 + rs));
}
function calcMACD(prices) {
    let ema12 = calcEMA(prices, 12);
    let ema26 = calcEMA(prices, 26);
    return ema12 - ema26;
}

// ========== Reason Formatter ==========
function getReason(data) {
    let arr = [];
    arr.push(`- EMA9: ${roundNum(data.ema9)} | EMA12: ${roundNum(data.ema12)} | MA50: ${roundNum(data.ma50)}`);
    arr.push(`- RSI: ${roundNum(data.rsi)}`);
    arr.push(`- MACD: ${data.macd > 0 ? 'Bullish' : 'Bearish'}`);
    arr.push(`- Price Action: ${data.pa}`);
    arr.push(`- Volume: ${data.vol}`);
    return arr.join("<br>");
}

// ========== Analisa ==========
async function analyze() {
    const symbol = document.getElementById('symbol').value;
    const interval = document.getElementById('interval').value;

    // Map agar cocok dengan API Bitget
    const intervalMap = {
        "1m": "1min",
        "5m": "5min",
        "15m": "15min",
        "30m": "30min",
        "1h": "1hour",
        "4h": "4hour",
        "1d": "1day"
    };

    document.getElementById('result-body').innerHTML = '<tr><td colspan="11">Loading...</td></tr>';
    try {
        const klines = await fetchKlines(symbol, intervalMap[interval]);
        if (!klines.length) throw new Error("No data");

        const prices = klines.map(x => x.close);
        const last = klines[klines.length - 1];

        // Indikator
        const ema9 = calcEMA(prices, 9);
        const ema12 = calcEMA(prices, 12);
        const ma50 = calcMA(prices, 50);
        const rsi = calcRSI(prices, 14);
        const macd = calcMACD(prices);
        const pa = (last.close > last.open) ? "Bullish" : (last.close < last.open) ? "Bearish" : "Sideways";
        const vol = (last.volume > klines.slice(-20, -1).map(x=>x.volume).reduce((a,b)=>a+b,0)/20) ? "Naik" : "Turun";
        // Signal utama hanya EMA9/12
        let signal = "Tidak ada sinyal kuat (EMA 9/12)";
        if (ema9 > ema12) signal = "EMA Cross Up";
        else if (ema9 < ema12) signal = "EMA Cross Down";

        // Reason multiline (garis per indikator)
        let reasonLines = [];
        if (signal.includes("Cross")) {
            reasonLines.push(`EMA Cross ${ema9 > ema12 ? 'Up' : 'Down'} (scalping):`);
            reasonLines.push(`- Harga cross ${ema9 > ema12 ? 'up' : 'down'} EMA (${roundNum(ema9)} ${ema9 > ema12 ? '>' : '<'} ${roundNum(ema12)})`);
            reasonLines.push(`- EMA ${ema9 > ema12 ? 'naik' : 'turun'} (${roundNum(ema9)} ${ema9 > ema12 ? '>' : '<'} ${roundNum(ema12)})`);
            reasonLines.push(`- RSI ${rsi < 40 ? 'melemah' : rsi > 60 ? 'menguat' : 'netral'} (${roundNum(rsi)})`);
            reasonLines.push(`- Price Action: ${pa}, Volume: ${vol}`);
            reasonLines.push(`Sinyal ${ema9 > ema12 ? 'bullish' : 'bearish'}, tetap perhatikan level support/resistance.`);
        } else {
            reasonLines.push(`Tidak ada sinyal kuat (EMA 9/12).`);
            reasonLines.push(`ATR: -`);
            reasonLines.push(`EMA9: ${roundNum(ema9)}, EMA12: ${roundNum(ema12)}, MA50: ${roundNum(ma50)}, RSI: ${roundNum(rsi)}, MACD: ${macd > 0 ? 'Bullish' : 'Bearish'}, Price Action: ${pa}, Volume: ${vol}`);
            reasonLines.push(`Tunggu konfirmasi lebih jelas dari indikator.`);
        }

        // Tampilkan ke tabel
        let tbody = document.getElementById('result-body');
        tbody.innerHTML = `
        <tr>
            <td>★</td>
            <td>${symbol}</td>
            <td>${roundNum(last.close, 2)}</td>
            <td>${roundNum(last.low, 2)}</td>
            <td>${roundNum(last.high, 2)}</td>
            <td>${roundNum(rsi, 2)}</td>
            <td>${signal}</td>
            <td style="text-align:left">${reasonLines.join('<br>')}</td>
            <td>${signal === "EMA Cross Up" ? "BUY" : signal === "EMA Cross Down" ? "SELL" : "HOLD"}</td>
            <td>-</td>
            <td><a href="https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}" target="_blank">Chart</a></td>
        </tr>
        `;

        // Update waktu
        const now = new Date();
        document.getElementById('lastUpdate').innerHTML = `Data analisa terakhir: ${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}, ${now.getHours()}.${String(now.getMinutes()).padStart(2,"0")}.${String(now.getSeconds()).padStart(2,"0")}`;
    } catch (e) {
        document.getElementById('result-body').innerHTML = `<tr><td colspan="11">Error: ${e.message}</td></tr>`;
    }
}

// ========== Event ==========
document.getElementById("analyzeBtn").addEventListener("click", analyze);

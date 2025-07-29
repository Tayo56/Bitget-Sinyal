// Helper Functions
function ema(arr, period) {
    let k = 2 / (period + 1);
    let emaArr = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
        emaArr.push(arr[i] * k + emaArr[i - 1] * (1 - k));
    }
    return emaArr;
}

function sma(arr, period) {
    let smaArr = [];
    for (let i = 0; i <= arr.length - period; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += arr[i + j];
        smaArr.push(sum / period);
    }
    return smaArr;
}

// RSI (14)
function rsi(arr, period = 14) {
    let gains = [], losses = [];
    for (let i = 1; i < arr.length; i++) {
        let diff = arr[i] - arr[i - 1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
    }
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let rsArr = [avgGain / avgLoss];
    let rsiArr = [100 - 100 / (1 + rsArr[0])];
    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        rsArr.push(avgLoss === 0 ? 100 : avgGain / avgLoss);
        rsiArr.push(100 - 100 / (1 + rsArr[rsArr.length - 1]));
    }
    // Pad front with null for alignment
    return Array(arr.length - rsiArr.length).fill(null).concat(rsiArr);
}

// MACD (12,26,9)
function macd(arr, shortP = 12, longP = 26, signalP = 9) {
    let emaShort = ema(arr, shortP);
    let emaLong = ema(arr, longP);
    let macdLine = emaShort.map((val, i) => val - emaLong[i]);
    let signalLine = ema(macdLine.slice(longP - 1), signalP);
    let hist = macdLine.slice(longP - 1).map((val, i) => val - signalLine[i]);
    return {
        macdLine: macdLine.slice(longP - 1),
        signalLine,
        hist
    };
}

function formatNumber(val, digit = 2) {
    if (isNaN(val)) return "-";
    if (Math.abs(val) >= 1000) return Number(val).toLocaleString(undefined, {maximumFractionDigits: 0});
    return Number(val).toFixed(digit);
}

// Reason/Signal Logic
function analyzeIndicators(close, ema9, ema12, ma50, rsiVal, macdVal, volumeArr) {
    let signal = '';
    let reason = [];

    // EMA Cross
    if (ema9 > ema12) {
        signal = 'EMA Cross Up (BUY)';
        reason.push(`EMA9 (${formatNumber(ema9)}) > EMA12 (${formatNumber(ema12)})`);
    } else if (ema9 < ema12) {
        signal = 'EMA Cross Down (SELL)';
        reason.push(`EMA9 (${formatNumber(ema9)}) < EMA12 (${formatNumber(ema12)})`);
    } else {
        signal = 'Tidak ada sinyal kuat (EMA 9/12)';
        reason.push('EMA9 ≈ EMA12');
    }

    // Tambahkan Reason per indikator
    reason.push('-----');
    reason.push(`MA50: ${formatNumber(ma50)}`);
    reason.push('-----');
    if (rsiVal < 30) {
        reason.push(`RSI (${formatNumber(rsiVal)}) sangat rendah (oversold)`);
    } else if (rsiVal > 70) {
        reason.push(`RSI (${formatNumber(rsiVal)}) sangat tinggi (overbought)`);
    } else {
        reason.push(`RSI (${formatNumber(rsiVal)}) netral`);
    }
    reason.push('-----');
    reason.push(`MACD: ${macdVal > 0 ? 'Bullish' : 'Bearish'}`);
    reason.push('-----');
    // Price Action & Volume
    reason.push(`Price Action: ${Math.abs(close - ma50) < 0.01 * close ? 'Sideways' : (close > ma50 ? 'Uptrend' : 'Downtrend')}`);
    reason.push('-----');
    let volumeDelta = volumeArr[volumeArr.length-1] - volumeArr[volumeArr.length-2];
    reason.push(`Volume: ${volumeDelta > 0 ? 'Naik' : 'Turun'}`);

    return { signal, reason: reason.join('\n') };
}

// Fetch Candles Bitget
async function fetchBitgetCandles(symbol, interval) {
    // Mapping interval ke API Bitget
    let intervalMap = {
        '1m': '1min',
        '5m': '5min',
        '15m': '15min',
        '30m': '30min',
        '1h': '1Hutc',
        '4h': '4Hutc',
        '1d': '1day'
    };
    const granularity = intervalMap[interval];
    if (!granularity) throw new Error('Interval salah');
    const url = `https://api.bitget.com/api/v2/mix/market/candles?symbol=${symbol}&granularity=${granularity}&productType=umcbl&limit=100`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== "00000") throw new Error(data.msg || "API error");
    return data.data;
}

function findSupport(arr) {
    let last = arr.slice(-8, -1).map(Number);
    return Math.min(...last);
}
function findResistance(arr) {
    let last = arr.slice(-8, -1).map(Number);
    return Math.max(...last);
}

// Main Logic
document.getElementById('analyzeBtn').onclick = async function() {
    const symbol = document.getElementById('symbol').value;
    const interval = document.getElementById('interval').value;
    const tbody = document.getElementById('result-body');
    const lastUpdate = document.getElementById('lastUpdate');
    tbody.innerHTML = `<tr><td colspan="11">Loading...</td></tr>`;
    lastUpdate.textContent = '';
    try {
        const candles = await fetchBitgetCandles(symbol, interval);
        // Format: [timestamp, open, high, low, close, volume, quoteVolume]
        let closes = candles.map(row => Number(row[4])).reverse();
        let highs = candles.map(row => Number(row[2])).reverse();
        let lows = candles.map(row => Number(row[3])).reverse();
        let volumes = candles.map(row => Number(row[5])).reverse();
        // Hitung indikator
        let ema9Arr = ema(closes, 9);
        let ema12Arr = ema(closes, 12);
        let ma50Arr = sma(closes, 50);
        let rsiArr = rsi(closes, 14);
        let macdRes = macd(closes, 12, 26, 9);
        // Current (last candle)
        let idx = closes.length - 1;
        let price = closes[idx];
        let support = findSupport(lows);
        let resistance = findResistance(highs);
        let curEMA9 = ema9Arr[idx];
        let curEMA12 = ema12Arr[idx];
        let curMA50 = ma50Arr[ma50Arr.length-1];
        let curRSI = rsiArr[idx];
        let curMACD = macdRes.macdLine[macdRes.macdLine.length-1];
        let curVolumeArr = volumes.slice(-3);
        // Logic signal/reason
        let { signal, reason } = analyzeIndicators(price, curEMA9, curEMA12, curMA50, curRSI, curMACD, volumes);
        // Open posisi dan SL/TP contoh simple
        let openPosisi = signal.includes('BUY') ? 'BUY' : (signal.includes('SELL') ? 'SELL' : 'HOLD');
        let sl = openPosisi === 'BUY' ? formatNumber(support) : (openPosisi === 'SELL' ? formatNumber(resistance) : '-');
        let tp = openPosisi === 'BUY' ? formatNumber(resistance) : (openPosisi === 'SELL' ? formatNumber(support) : '-');
        // Show result
        tbody.innerHTML = `
        <tr>
            <td>★</td>
            <td>${symbol}</td>
            <td>${formatNumber(price, 2)}</td>
            <td>${formatNumber(support, 2)}</td>
            <td>${formatNumber(resistance, 2)}</td>
            <td>${formatNumber(curRSI, 2)}</td>
            <td>${signal}</td>
            <td class="reason-cell">${reason}</td>
            <td>${openPosisi}</td>
            <td>SL: ${sl}<br>TP: ${tp}</td>
            <td><a href="https://www.tradingview.com/chart/?symbol=BITGET:${symbol}" target="_blank" style="color:#ffd600;">Chart</a></td>
        </tr>`;
        let time = new Date(Number(candles[0][0])).toLocaleString();
        lastUpdate.textContent = "Data analisa terakhir: " + time;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="11">Error: ${e.message}</td></tr>`;
    }
}

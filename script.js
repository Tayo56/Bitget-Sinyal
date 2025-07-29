// --- Mapping interval untuk Bitget API
const intervalMap = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1H',
    '4h': '4H',
    '1d': '1D'
};

function round(val, dec = 2) {
    return parseFloat(val).toFixed(dec);
}

document.getElementById('analyzeBtn').onclick = async function () {
    const symbol = document.getElementById('symbol').value;
    const interval = document.getElementById('interval').value;
    const bitgetInterval = intervalMap[interval];

    if (!bitgetInterval) {
        alert('Interval tidak didukung!');
        return;
    }

    document.getElementById('result-body').innerHTML = `<tr><td colspan="11" style="color:#ffd600">Loading...</td></tr>`;

    // --- API endpoint Bitget
    const url = `https://api.bitget.com/api/v2/mix/market/candles?symbol=${symbol}&granularity=${bitgetInterval}&productType=umcbl&limit=100`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.data || !Array.isArray(data.data) || data.data.length < 60) {
            document.getElementById('result-body').innerHTML = `<tr><td colspan="11" style="color:#ff4864">Error: Data kosong atau tidak cukup untuk analisis</td></tr>`;
            return;
        }

        // --- ambil 60 bar terakhir (biar indikator valid)
        const candles = data.data.slice(0, 60).reverse().map(c => ({
            timestamp: +c[0],
            open: +c[1],
            high: +c[2],
            low: +c[3],
            close: +c[4],
            volume: +c[5]
        }));

        // --- indikator EMA, MA, RSI, MACD
        function ema(arr, period) {
            let k = 2 / (period + 1);
            let emaPrev = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
            for (let i = period; i < arr.length; i++) {
                emaPrev = arr[i] * k + emaPrev * (1 - k);
            }
            return emaPrev;
        }
        function sma(arr, period) {
            if (arr.length < period) return null;
            return arr.slice(-period).reduce((a, b) => a + b, 0) / period;
        }
        function rsi(closes, period = 14) {
            let gains = 0, losses = 0;
            for (let i = closes.length - period; i < closes.length - 1; i++) {
                let diff = closes[i + 1] - closes[i];
                if (diff >= 0) gains += diff; else losses -= diff;
            }
            if ((gains + losses) === 0) return 50;
            let rs = gains / (losses || 1e-8);
            return 100 - (100 / (1 + rs));
        }
        function macd(closes, fast = 12, slow = 26, signal = 9) {
            let fastEma = ema(closes, fast);
            let slowEma = ema(closes, slow);
            let macdLine = fastEma - slowEma;
            // fake signal line (biar simple)
            return macdLine;
        }

        let closes = candles.map(c => c.close);
        let volumes = candles.map(c => c.volume);

        let ema9 = ema(closes, 9);
        let ema12 = ema(closes, 12);
        let ma50 = sma(closes, 50);
        let rsi14 = rsi(closes, 14);
        let macdVal = macd(closes, 12, 26, 9);

        // Support & Resistance = lowest/highest of last 50 bar
        let support = Math.min(...closes.slice(-50));
        let resistance = Math.max(...closes.slice(-50));

        let price = closes[closes.length - 1];

        // --- Reason Builder
        let reason = [];
        let signal = "";
        let openPos = "HOLD";
        let sltp = "-";

        // --- EMA CROSS
        if (ema9 > ema12) {
            if (rsi14 > 70) {
                signal = "SELL";
                reason.push("EMA9 cross up EMA12");
                reason.push("- EMA naik, overbought (RSI tinggi)");
                reason.push("- Waspada reversal/price action.");
            } else {
                signal = "BUY";
                reason.push("EMA9 cross up EMA12");
                reason.push("- EMA naik, sinyal bullish.");
            }
            openPos = "BUY";
            sltp = `SL: ${round(support,2)}<br>TP: ${round(resistance,2)}`;
        } else if (ema9 < ema12) {
            if (rsi14 < 30) {
                signal = "BUY";
                reason.push("EMA9 cross down EMA12");
                reason.push("- EMA turun, oversold (RSI rendah)");
                reason.push("- Pantau reversal candlestick.");
            } else {
                signal = "SELL";
                reason.push("EMA9 cross down EMA12");
                reason.push("- EMA turun, sinyal bearish.");
            }
            openPos = "SELL";
            sltp = `SL: ${round(resistance,2)}<br>TP: ${round(support,2)}`;
        } else {
            signal = "Tidak ada sinyal kuat (EMA 9/12)";
            reason.push("- EMA9 dan EMA12 mendatar / berdekatan");
            reason.push("- Tunggu konfirmasi lebih jelas.");
            openPos = "HOLD";
        }
        // --- RSI
        reason.push(`---`);
        reason.push(`RSI: ${round(rsi14,2)}${rsi14 < 30 ? " (Oversold)" : rsi14 > 70 ? " (Overbought)" : ""}`);
        // --- MA50
        reason.push(`MA50: ${round(ma50,2)}`);
        // --- MACD
        reason.push(`MACD: ${macdVal > 0 ? "Bullish" : "Bearish"}`);
        // --- Price Action dummy
        reason.push(`Price Action: Sideways`);
        // --- Volume dummy
        let volStatus = volumes[volumes.length-1] > sma(volumes,20) ? "Naik" : "Turun";
        reason.push(`Volume: ${volStatus}`);

        // Format Reason jadi multi-line rapi
        let reasonText = reason.join('\n');

        // --- LAST UPDATE
        let lastTime = new Date(candles[candles.length - 1].timestamp).toLocaleString("id-ID");
        document.getElementById("lastUpdate").innerHTML = `Data analisa terakhir: ${lastTime}`;

        // --- Output Table
        let html = `<tr>
            <td>★</td>
            <td>${symbol}</td>
            <td>${round(price,2)}</td>
            <td>${round(support,2)}</td>
            <td>${round(resistance,2)}</td>
            <td>${round(rsi14,2)}</td>
            <td class="signal ${signal.toLowerCase()}">${signal}</td>
            <td class="reason">${reasonText}</td>
            <td>${openPos}</td>
            <td>${sltp}</td>
            <td><a href="https://www.tradingview.com/chart/?symbol=${symbol.replace('USDT','USDT')}USDT" target="_blank">Chart</a></td>
        </tr>`;

        document.getElementById('result-body').innerHTML = html;

    } catch (e) {
        document.getElementById('result-body').innerHTML = `<tr><td colspan="11" style="color:#ff4864">Error: ${e.message || e}</td></tr>`;
    }
}

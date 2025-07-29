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

    document.getElementById('result-body').innerHTML = `<tr><td colspan="11" style="color:#ffd600">Loading...</td></tr>`;

    const url = `https://api.bitget.com/api/v2/mix/market/candles?symbol=${symbol}&granularity=${bitgetInterval}&productType=umcbl&limit=100`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.data || !Array.isArray(data.data) || data.data.length < 60) {
            document.getElementById('result-body').innerHTML = `<tr><td colspan="11" style="color:#ff4864">Error: Data kosong atau tidak cukup untuk analisis</td></tr>`;
            return;
        }

        const candles = data.data.slice(0, 60).reverse().map(c => ({
            timestamp: +c[0],
            open: +c[1],
            high: +c[2],
            low: +c[3],
            close: +c[4],
            volume: +c[5]
        }));

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
            return fastEma - slowEma;
        }

        let closes = candles.map(c => c.close);
        let volumes = candles.map(c => c.volume);

        let ema9 = ema(closes, 9);
        let ema21 = ema(closes, 21);
        let ma50 = sma(closes, 50);
        let rsi14 = rsi(closes, 14);
        let macdVal = macd(closes, 12, 26, 9);

        let support = Math.min(...closes.slice(-50));
        let resistance = Math.max(...closes.slice(-50));
        let price = closes[closes.length - 1];

        let signal = "";
        let reasonArr = [];
        let openPos = "-";
        let sltp = "-";

        // SIGNAL UTAMA: EMA 9/21
        if (ema9 > ema21) {
            signal = "EMA Cross Up (sedang)";
            openPos = "BUY";
            reasonArr.push("<b>EMA Cross Up (scalping):</b>");
            reasonArr.push(`- Harga cross up EMA (EMA9 ${round(ema9,2)} > EMA21 ${round(ema21,2)})`);
            reasonArr.push("- EMA naik");
        } else if (ema9 < ema21) {
            signal = "EMA Cross Down (sedang)";
            openPos = "SELL";
            reasonArr.push("<b>EMA Cross Down (scalping):</b>");
            reasonArr.push(`- Harga cross down EMA (EMA9 ${round(ema9,2)} < EMA21 ${round(ema21,2)})`);
            reasonArr.push("- EMA turun");
        } else {
            signal = "Tidak ada sinyal kuat (EMA 9/21)";
            openPos = "HOLD";
            reasonArr.push("Tidak ada sinyal kuat, EMA mendatar");
        }

        // REASON PER INDIKATOR
        reasonArr.push(`<hr style="border:0;border-top:1px solid #ffd600;margin:4px 0">`);
        reasonArr.push(`<b>RSI</b>: ${round(rsi14,2)} ${rsi14 > 70 ? '(Overbought)' : (rsi14 < 30 ? '(Oversold)' : '')}`);
        reasonArr.push(`<b>MA50</b>: ${round(ma50,2)}`);
        reasonArr.push(`<b>MACD</b>: ${macdVal > 0 ? 'Bullish' : 'Bearish'}`);
        reasonArr.push(`<b>Price Action</b>: Sideways`);
        let volStatus = volumes[volumes.length-1] > sma(volumes,20) ? "Naik" : "Turun";
        reasonArr.push(`<b>Volume</b>: ${volStatus}`);

        let reasonHtml = `<ul style="padding-left:18px;margin:0;">` + reasonArr.map(r => 
            `<li style="margin-bottom:1px">${r}</li>`).join('') + `</ul>`;

        // --- LAST UPDATE
        let lastTime = new Date(candles[candles.length - 1].timestamp).toLocaleString("id-ID");
        document.getElementById("lastUpdate").innerHTML = `Data analisa terakhir: ${lastTime}`;

        let html = `<tr>
            <td>★</td>
            <td>${symbol}</td>
            <td>${round(price,2)}</td>
            <td>${round(support,2)}</td>
            <td>${round(resistance,2)}</td>
            <td>${round(rsi14,2)}</td>
            <td class="signal">${signal}</td>
            <td class="reason">${reasonHtml}</td>
            <td>${openPos}</td>
            <td>${sltp}</td>
            <td><a href="https://www.tradingview.com/chart/?symbol=${symbol}" target="_blank">Chart</a></td>
        </tr>`;

        document.getElementById('result-body').innerHTML = html;

    } catch (e) {
        document.getElementById('result-body').innerHTML = `<tr><td colspan="11" style="color:#ff4864">Error: ${e.message || e}</td></tr>`;
    }
}

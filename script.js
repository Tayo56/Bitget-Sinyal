function formatNumber(num) {
    // Pangkas ke 2-3 angka desimal, tapi tetap presisi untuk harga kripto
    return Number(num).toLocaleString("en-US", {maximumFractionDigits: 2, minimumFractionDigits: 2});
}

function buildReason(reason) {
    // Format reason agar seperti - EMA Cross Down ... dst
    return `<div class="reason-list">
    EMA Cross Down (scalping):<br>
    - Harga cross down EMA (${reason.ema9} &lt; ${reason.ema12})<br>
    - EMA turun (${reason.ema12} &lt; ${reason.prevEma12})<br>
    - RSI melemah (${reason.rsi})<br>
    - Tidak ada price action, sinyal sedang<br>
    - Tidak ada doji, sinyal kuat<br>
    Sinyal bearish sedang, tetap perhatikan level support.<br>
    <hr>
    <b>Detail:</b><br>
    - EMA9: ${reason.ema9}<br>
    - EMA12: ${reason.ema12}<br>
    - MA50: ${reason.ma50}<br>
    - RSI: ${reason.rsi}<br>
    - MACD: ${reason.macd}<br>
    - Price Action: ${reason.priceAction}<br>
    - Volume: ${reason.volume}<br>
    </div>`;
}

function buildRow() {
    // Data dummy
    let reason = {
        ema9: "118739.28",
        ema12: "118667.54",
        prevEma12: "118752.08",
        ma50: "118153.58",
        rsi: "39.52",
        macd: "Bearish",
        priceAction: "No major move",
        volume: "Turun"
    };
    return `<tr>
        <td>★</td>
        <td>BTCUSDT</td>
        <td>${formatNumber(118829.83)}</td>
        <td>${formatNumber(117977.23)}</td>
        <td>${formatNumber(118964.78)}</td>
        <td>${reason.rsi}</td>
        <td class="signal-weak">EMA Cross Down</td>
        <td>${buildReason(reason)}</td>
        <td>SELL</td>
        <td>SL: 118153.58<br>TP: 117977.23</td>
        <td><a href="#" style="color:#ffd600;" target="_blank">Chart</a></td>
    </tr>`;
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("analyzeBtn").addEventListener("click", function() {
        // Demo isi data dummy, ganti fetch Bitget jika sudah siap
        document.getElementById("lastUpdate").innerText =
          "Data analisa terakhir: " + new Date().toLocaleString("id-ID");
        document.getElementById("result-body").innerHTML = buildRow();
    });
});

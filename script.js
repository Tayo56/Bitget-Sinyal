// Helper function to round price to 2 decimals for simplicity
function roundPrice(price) {
    return parseFloat(price).toFixed(2);
}

// Reason builder (multiline)
function getReasonRow(data) {
    let arr = [];
    if (data.emaSignal === "down") {
        arr.push("EMA Cross Down (scalping):");
        arr.push(`- Harga cross down EMA (${data.ema9} < ${data.ema12})`);
        arr.push(`- EMA turun (${data.ema12} < ${data.ma50})`);
    } else if (data.emaSignal === "up") {
        arr.push("EMA Cross Up (scalping):");
        arr.push(`- Harga cross up EMA (${data.ema9} > ${data.ema12})`);
        arr.push(`- EMA naik (${data.ema12} > ${data.ma50})`);
    } else {
        arr.push("Tidak ada sinyal kuat (EMA 9/12):");
    }
    arr.push(`- RSI: ${data.rsi} (${data.rsiStatus})`);
    arr.push(`- MACD: ${data.macd > 0 ? "Bullish" : data.macd < 0 ? "Bearish" : "Netral"}`);
    arr.push(`- Price Action: ${data.priceAction}`);
    arr.push(`- Volume: ${data.volume}`);
    arr.push(`${data.summary}`);
    return arr.join('\n');
}

// Dummy function untuk ambil data (simulasi, ganti dengan fetch Bitget jika mau live)
async function fetchData(symbol, interval) {
    // Contoh data dummy:
    let data = {
        symbol,
        price: 118829.83,
        support: 117977.23,
        resistance: 118964.78,
        rsi: 39.52,
        rsiStatus: "melemah",
        signal: "EMA Cross Down (scalping)",
        emaSignal: "down",
        ema9: 118347.7,
        ema12: 118698.17,
        ma50: 118752.09,
        macd: -15,
        priceAction: "Sideways",
        volume: "Turun",
        summary: "Sinyal bearish sedang, tetap perhatikan level support."
    };

    // Bisa tambahkan if (symbol == "ETHUSDT") { ... } untuk data lain
    return [data]; // Array of object, biar bisa multi-row
}

// Render tabel
async function renderTable() {
    const tbody = document.getElementById("result-body");
    tbody.innerHTML = '<tr><td colspan="11">Loading...</td></tr>';

    const symbol = document.getElementById("symbol").value;
    const interval = document.getElementById("interval").value;

    let rows = await fetchData(symbol, interval);

    // Waktu update
    document.getElementById("lastUpdate").innerText =
        "Data analisa terakhir: " + new Date().toLocaleString('id-ID');

    tbody.innerHTML = "";
    rows.forEach((data, idx) => {
        let reason = getReasonRow(data).replace(/\n/g, '<br>');
        tbody.innerHTML += `
        <tr>
            <td>★</td>
            <td>${data.symbol}</td>
            <td>${roundPrice(data.price)}</td>
            <td>${roundPrice(data.support)}</td>
            <td>${roundPrice(data.resistance)}</td>
            <td>${data.rsi}</td>
            <td>${data.signal}</td>
            <td class="table-reason">${reason}</td>
            <td>HOLD</td>
            <td>SL: ${roundPrice(data.support)}<br>TP: ${roundPrice(data.resistance)}</td>
            <td><a href="#">Chart</a></td>
        </tr>`;
    });
}

// Event
document.getElementById("analyzeBtn").addEventListener("click", renderTable);

// Auto load saat buka
window.onload = renderTable;

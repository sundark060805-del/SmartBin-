async function updateBins() {
    const response = await fetch("/api/bins");
    const bins = await response.json();

    console.log("Live bin data:", bins);
}

updateBins();

setInterval(updateBins, 5000);
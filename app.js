// Baseline Demographic Seed Data representing Muntinlupa City Census estimates
const DEFAULT_DEMOGRAPHIC_DATA = {
    "Buli": { "history": [63793, 71075, 69215] },
    "Sucat": { "history": [42500, 44100, 46200] },
    "Cupang": { "history": [49000, 51200, 53500] },
    "Alabang": { "history": [57000, 60100, 63000] },
    "Bayanan": { "history": [33000, 34500, 36000] },
    "Putatan": { "history": [75000, 78800, 82500] },
    "Tunasan": { "history": [50000, 52500, 55000] },
    "Poblacion": { "history": [98000, 102500, 107000] },
    "Ayala Alabang": { "history": [19500, 20500, 21400] }
};

const STORAGE_KEY = "muntinlupa_demographics_data";
const HISTORICAL_LABELS = ["2015", "2020", "2024"];

// Supabase Configuration
const SUPABASE_URL = "https://uaareqlqrkgpmltvrjao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-RZnuhIwEjepuaXPxmrkSg_iZawf7jO";

let supabaseClient = null;

// Initialize Supabase Client Safely
if (typeof supabase !== 'undefined' && SUPABASE_URL !== "YOUR_SUPABASE_URL") {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// State Variables
let appData = {};
let selectedBarangay = null; // null represents City-Wide view
let selectedYear = "2024";   // Synchronized variable for year tracking ("2015", "2020", "2024")

// Chart Instances
let trendChartInstance = null;
let barangayBarChartInstance = null;

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
    await initData();
    initClock();
    initEventListeners();
    renderDashboard();
});

// Show/Hide Database Loading Overlay
function showLoading(show) {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
        if (show) overlay.classList.add("active");
        else overlay.classList.remove("active");
    }
}

// Load data from Supabase DB or LocalStorage fallback
async function initData() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('demographics')
                .select('data')
                .eq('id', 1)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log("No data found in Supabase. Initializing default demographic data.");
                    await restoreDefaultData();
                } else {
                    throw error;
                }
            } else if (data && data.data) {
                appData = data.data;
            } else {
                await restoreDefaultData();
            }
        } catch (e) {
            console.error("Error loading data from Supabase. Falling back to LocalStorage.", e);
            loadFromLocalStorageFallback();
        }
    } else {
        console.log("Supabase library not loaded or credentials missing. Using LocalStorage fallback.");
        loadFromLocalStorageFallback();
    }
}

function loadFromLocalStorageFallback() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            appData = parsed.data || parsed;
        } catch (e) {
            console.error("Error parsing local demographic data. Resetting to defaults.", e);
            restoreDefaultDataSync();
        }
    } else {
        restoreDefaultDataSync();
    }
}

async function restoreDefaultData() {
    appData = JSON.parse(JSON.stringify(DEFAULT_DEMOGRAPHIC_DATA));
    await saveData();
}

function restoreDefaultDataSync() {
    appData = JSON.parse(JSON.stringify(DEFAULT_DEMOGRAPHIC_DATA));
    saveDataSync();
}

async function saveData() {
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient
                .from('demographics')
                .upsert({ id: 1, data: appData, labels: HISTORICAL_LABELS, updated_at: new Date() });

            if (error) throw error;
        } catch (e) {
            console.error("Error saving data to Supabase. Falling back to LocalStorage.", e);
            saveDataSync();
        }
    } else {
        saveDataSync();
    }
}

function saveDataSync() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: appData }));
}

function initClock() {
    const timeEl = document.getElementById("date-time");
    if (!timeEl) return;

    function updateClock() {
        const now = new Date();
        const options = {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        };
        timeEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${now.toLocaleString('en-US', options)}`;
    }

    updateClock();
    setInterval(updateClock, 1000);
}

// Map index year text values to numerical array indices
function getYearIndex(year) {
    if (year === "2015") return 0;
    if (year === "2020") return 1;
    return 2; // Default to 2024
}

// Setup Event Handlers for Map and Form Selections
function initEventListeners() {
    const mapPolygons = document.querySelectorAll(".map-polygon");
    const mapWrapper = document.querySelector(".map-wrapper");
    const tooltip = document.getElementById("map-tooltip");
    const svgOverlay = mapWrapper?.querySelector(".map-svg-overlay");

    const zoomLayer = mapWrapper?.querySelector(".map-zoom-layer") || (() => {
        const layer = document.createElement("div");
        layer.className = "map-zoom-layer";
        if (mapWrapper && svgOverlay) {
            mapWrapper.insertBefore(layer, svgOverlay);
        } else {
            mapWrapper?.appendChild(layer);
        }
        return layer;
    })();

    const blurLayer = mapWrapper?.querySelector(".map-blur-layer") || (() => {
        const layer = document.createElement("div");
        layer.className = "map-blur-layer";
        if (mapWrapper && svgOverlay) {
            mapWrapper.insertBefore(layer, svgOverlay);
        } else {
            mapWrapper?.appendChild(layer);
        }
        return layer;
    })();

    const tooltipTitle = document.getElementById("tooltip-title");
    const tooltipPop = document.getElementById("tooltip-pop");
    
    // Hide gender items safely from map tooltips if they exist in markup
    const mRow = document.getElementById("tooltip-male")?.closest('div');
    const fRow = document.getElementById("tooltip-female")?.closest('div');
    if (mRow) mRow.style.display = 'none';
    if (fRow) fRow.style.display = 'none';

    const brgySelect = document.getElementById("brgy-select");
    const yearSelect = document.getElementById("year-select");

    // 1. Map Interaction Loops
    mapPolygons.forEach(polygon => {
        const name = polygon.getAttribute("data-name");
        if (!name) return;

        polygon.addEventListener("mouseenter", () => {
            const stats = getBarangayStats(name, selectedYear);
            if (tooltipTitle) tooltipTitle.textContent = `${name} (${selectedYear})`;
            if (tooltipPop) tooltipPop.textContent = stats.total.toLocaleString();
            if (tooltip) tooltip.classList.add("visible");

            if (zoomLayer && mapWrapper) {
                const { points, originX, originY } = getPolygonHoverData(polygon, mapWrapper);
                zoomLayer.style.clipPath = `polygon(${points})`;
                zoomLayer.style.transformOrigin = `${originX}% ${originY}%`;
                zoomLayer.classList.add("visible");
                zoomLayer.style.transform = "scale(1.08)";
            }

            if (blurLayer && mapWrapper) {
                const { points } = getPolygonHoverData(polygon, mapWrapper);
                blurLayer.style.clipPath = `polygon(${points})`;
                blurLayer.classList.add("visible");
            }
        });

        polygon.addEventListener("mousemove", (e) => {
            if (!tooltip || !mapWrapper) return;
            const rect = mapWrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        });

        polygon.addEventListener("mouseleave", () => {
            if (tooltip) tooltip.classList.remove("visible");
            if (zoomLayer) {
                zoomLayer.classList.remove("visible");
                zoomLayer.style.transform = "scale(1)";
            }
            if (blurLayer) {
                blurLayer.classList.remove("visible");
            }
        });

        polygon.addEventListener("click", (e) => {
            e.stopPropagation(); 
            selectBarangay(name);
        });
    });

    if (mapWrapper) {
        mapWrapper.addEventListener("click", () => {
            selectBarangay(null);
        });
    }

    if (brgySelect) {
        brgySelect.addEventListener("change", (e) => {
            const selectedName = e.target.value;
            selectBarangay(selectedName ? selectedName : null, false);
        });
    }

    if (yearSelect) {
        yearSelect.addEventListener("change", (e) => {
            selectedYear = e.target.value;
            renderDashboard(); 
        });
    }
}

function getPolygonHoverData(polygon, mapWrapper) {
    const bounds = mapWrapper.getBoundingClientRect();
    const width = bounds.width || 750;
    const height = bounds.height || 750;
    const baseWidth = 750;
    const baseHeight = 750;
    const rawPoints = polygon.getAttribute("points") || "";
    const coords = rawPoints
        .trim()
        .split(/\s+/)
        .map(point => point.split(","))
        .filter(([x, y]) => x !== undefined && y !== undefined)
        .map(([x, y]) => ({
            x: Number(x),
            y: Number(y)
        }));

    const points = coords
        .map(({ x, y }) => `${((x / baseWidth) * width).toFixed(2)}px ${((y / baseHeight) * height).toFixed(2)}px`)
        .join(", ");

    const totalX = coords.reduce((sum, { x }) => sum + x, 0);
    const totalY = coords.reduce((sum, { y }) => sum + y, 0);
    const count = coords.length || 1;

    return {
        points,
        originX: ((totalX / count / baseWidth) * 100).toFixed(2),
        originY: ((totalY / count / baseHeight) * 100).toFixed(2)
    };
}

function selectBarangay(name, updateForm = true) {
    selectedBarangay = name;

    const polygons = document.querySelectorAll(".map-polygon");
    polygons.forEach(polygon => {
        if (polygon.getAttribute("data-name") === name) {
            polygon.classList.add("selected");
        } else {
            polygon.classList.remove("selected");
        }
    });

    if (updateForm) {
        const brgySelect = document.getElementById("brgy-select");
        if (brgySelect) brgySelect.value = name || "";
    }

    renderDashboard();
}

// Get population metrics for a given barangay and year
function getBarangayStats(name, year = selectedYear) {
    const brgy = appData[name];
    if (!brgy || !Array.isArray(brgy.history)) return { total: 0 };

    const idx = getYearIndex(year);
    const populationVal = brgy.history[idx] || 0;

    return { total: populationVal };
}

// Aggregate city-wide metrics as the sum of all individual records
function getCityWideStats() {
    let history = [0, 0, 0];

    for (let brgyName in appData) {
        const brgy = appData[brgyName];
        if (brgy && Array.isArray(brgy.history)) {
            for (let i = 0; i < history.length; i++) {
                history[i] += brgy.history[i] || 0;
            }
        }
    }

    const currentIdx = getYearIndex(selectedYear);
    return {
        total: history[currentIdx],
        history: history
    };
}

function renderDashboard() {
    let totalPopulation = 0;
    let historyData = [];

    if (selectedBarangay && appData[selectedBarangay]) {
        const brgy = appData[selectedBarangay];
        const stats = getBarangayStats(selectedBarangay, selectedYear);
        
        totalPopulation = stats.total;
        historyData = brgy.history || [0, 0, 0];

        // UI Label Insertion
        document.getElementById("selected-brgy-val").textContent = `${selectedBarangay} (${selectedYear})`;
        document.getElementById("selected-badge").textContent = `${selectedBarangay} Analytics — ${selectedYear}`;
    } else {
        // Aggregate City-Wide
        const cwStats = getCityWideStats();
        totalPopulation = cwStats.total;
        historyData = cwStats.history;

        document.getElementById("selected-brgy-val").textContent = `City-Wide (${selectedYear})`;
        document.getElementById("selected-badge").textContent = `City-Wide Analytics — ${selectedYear}`;
    }

    // Hide gender and age card elements safely from grid layout to prevent empty space bugs
    const maleCard = document.getElementById("total-male-val")?.closest('.stat-card');
    const femaleCard = document.getElementById("total-female-val")?.closest('.stat-card');
    const genderChartCard = document.getElementById("genderChart")?.closest('.chart-card');
    const ageChartCard = document.getElementById("ageChart")?.closest('.chart-card');

    if (maleCard) maleCard.style.display = 'none';
    if (femaleCard) femaleCard.style.display = 'none';
    if (genderChartCard) genderChartCard.style.display = 'none';
    if (ageChartCard) ageChartCard.style.display = 'none';

    // Update main overall Counter widget
    const totalEl = document.getElementById("total-pop-val");
    if (totalEl) totalEl.textContent = totalPopulation.toLocaleString();

    renderTrendChart(historyData);
    renderBarangayBarChart();
}

function renderTrendChart(historyData) {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Outfit';
    Chart.defaults.font.size = 11;

    if (trendChartInstance) {
        trendChartInstance.data.datasets[0].data = historyData;
        trendChartInstance.update();
    } else {
        const ctx3 = document.getElementById("trendChart")?.getContext("2d");
        if (ctx3) {
            const gradient = ctx3.createLinearGradient(0, 0, 0, 160);
            gradient.addColorStop(0, "rgba(139, 92, 246, 0.35)");
            gradient.addColorStop(1, "rgba(139, 92, 246, 0.0)");

            trendChartInstance = new Chart(ctx3, {
                type: "line",
                data: {
                    labels: HISTORICAL_LABELS,
                    datasets: [{
                        label: "Overall Population Total", 
                        data: historyData, 
                        borderColor: "#8b5cf6", 
                        borderWidth: 3, 
                        pointBackgroundColor: "#8b5cf6", 
                        pointBorderColor: "#f8fafc", 
                        pointBorderWidth: 2, 
                        pointRadius: 5, 
                        pointHoverRadius: 7, 
                        backgroundColor: gradient, 
                        fill: true, 
                        tension: 0.2
                    }]
                },
                options: {
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { backgroundColor: "rgba(15, 23, 42, 0.95)", padding: 10, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.15)" }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: "#94a3b8" } },
                        y: {
                            grid: { color: "rgba(255, 255, 255, 0.05)" },
                            ticks: { color: "#94a3b8", callback: function (value) { return value.toLocaleString(); } }
                        }
                    }
                }
            });
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Select elements
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const sidebar = document.getElementById("sector-sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    const closeBtn = document.getElementById("close-sidebar-btn");

    // Check if the hamburger button exists before adding event listeners
    if (hamburgerBtn) {
        // Open Sidebar
        hamburgerBtn.addEventListener("click", () => {
            sidebar.classList.add("active");
            overlay.classList.add("active");
            document.body.style.overflow = "hidden"; // Prevent scrolling main page when sidebar is open
        });

        // Close Sidebar (via X button)
        closeBtn.addEventListener("click", closeSidebar);

        // Close Sidebar (via clicking outside the sidebar)
        overlay.addEventListener("click", closeSidebar);
    }

    // Helper function to close sidebar
    function closeSidebar() {
        sidebar.classList.remove("active");
        overlay.classList.remove("active");
        document.body.style.overflow = ""; // Restore scrolling
    }
});
function renderBarangayBarChart() {
    // 1. Gather all individual barangay names and their population values for the selected year
    const labels = Object.keys(appData);
    const dataValues = labels.map(brgyName => {
        const stats = getBarangayStats(brgyName, selectedYear);
        return stats.total;
    });

    // 2. If chart instance already exists, update data and label variables seamlessly
    if (barangayBarChartInstance) {
        barangayBarChartInstance.data.datasets[0].label = `Population in ${selectedYear}`;
        barangayBarChartInstance.data.datasets[0].data = dataValues;
        barangayBarChartInstance.update();
    } else {
        const ctx4 = document.getElementById("barangayBarChart")?.getContext("2d");
        if (ctx4) {
            // Apply a modern gradient matching your custom theme variables
            const gradient = ctx4.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, "#06b6d4"); // Cyan primary color accent
            gradient.addColorStop(1, "rgba(6, 182, 212, 0.2)");

            barangayBarChartInstance = new Chart(ctx4, {
                type: "bar",
                data: {
                    labels: labels,
                    datasets: [{
                        label: `Population in ${selectedYear}`,
                        data: dataValues,
                        backgroundColor: gradient,
                        borderColor: "#06b6d4",
                        borderWidth: 1.5,
                        borderRadius: 6, // Smooth rounded corners for structural columns
                        hoverBackgroundColor: "#8b5cf6", // Hover color shift matching your style tokens
                        hoverBorderColor: "#8b5cf6"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: "rgba(15, 23, 42, 0.95)",
                            padding: 10,
                            borderWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.15)",
                            callbacks: {
                                label: function(context) {
                                    return ` Population: ${context.raw.toLocaleString()}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: "#94a3b8" }
                        },
                        y: {
                            grid: { color: "rgba(255, 255, 255, 0.05)" },
                            ticks: {
                                color: "#94a3b8",
                                callback: function (value) {
                                    return value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        }
    }
}
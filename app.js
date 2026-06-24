// Baseline Demographic Seed Data representing Muntinlupa City Census estimates
const DEFAULT_DEMOGRAPHIC_DATA = {
    "Sucat": {
        male: { "0-14": 6200, "15-24": 4900, "25-54": 10500, "55-64": 2400, "65+": 1200 },
        female: { "0-14": 5900, "15-24": 5100, "25-54": 10200, "55-64": 2500, "65+": 1500 },
        history: [42000, 44100, 46200, 48500, 50400]
    },
    "Buli": {
        male: { "0-14": 1400, "15-24": 1200, "25-54": 2800, "55-64": 600, "65+": 300 },
        female: { "0-14": 1300, "15-24": 1250, "25-54": 2700, "55-64": 650, "65+": 400 },
        history: [10500, 11000, 11500, 12100, 12600]
    },
    "Cupang": {
        male: { "0-14": 7100, "15-24": 5800, "25-54": 12200, "55-64": 2800, "65+": 1400 },
        female: { "0-14": 6800, "15-24": 6000, "25-54": 12000, "55-64": 2900, "65+": 1700 },
        history: [49000, 51200, 53500, 56000, 58700]
    },
    "Alabang": {
        male: { "0-14": 8200, "15-24": 6900, "25-54": 14500, "55-64": 3300, "65+": 1700 },
        female: { "0-14": 7900, "15-24": 7100, "25-54": 14000, "55-64": 3400, "65+": 2100 },
        history: [57000, 60100, 63000, 66200, 69100]
    },
    "Ayala Alabang": {
        male: { "0-14": 2500, "15-24": 2200, "25-54": 4800, "55-64": 1200, "65+": 800 },
        female: { "0-14": 2400, "15-24": 2300, "25-54": 4700, "55-64": 1300, "65+": 1000 },
        history: [19500, 20500, 21400, 22300, 23200]
    },
    "Bayanan": {
        male: { "0-14": 4800, "15-24": 3800, "25-54": 8200, "55-64": 1800, "65+": 900 },
        female: { "0-14": 4500, "15-24": 3950, "25-54": 8000, "55-64": 1900, "65+": 1150 },
        history: [33000, 34500, 36000, 37400, 39000]
    },
    "Putatan": {
        male: { "0-14": 11000, "15-24": 8900, "25-54": 18800, "55-64": 4300, "65+": 2100 },
        female: { "0-14": 10500, "15-24": 9100, "25-54": 18500, "55-64": 4500, "65+": 2700 },
        history: [75000, 78800, 82500, 86300, 90400]
    },
    "Poblacion": {
        male: { "0-14": 14200, "15-24": 11500, "25-54": 24200, "55-64": 5600, "65+": 2700 },
        female: { "0-14": 13800, "15-24": 11800, "25-54": 23800, "55-64": 5800, "65+": 3500 },
        history: [98000, 102500, 107000, 112000, 116900]
    },
    "Tunasan": {
        male: { "0-14": 7400, "15-24": 5900, "25-54": 12500, "55-64": 2900, "65+": 1400 },
        female: { "0-14": 7100, "15-24": 6100, "25-54": 12200, "55-64": 3000, "65+": 1800 },
        history: [50000, 52500, 55000, 57600, 60300]
    }
};

const STORAGE_KEY = "muntinlupa_demographics_data";
const DEFAULT_HISTORICAL_LABELS = ["2022", "2023", "2024", "2025", "2026 (Current)"];
let HISTORICAL_LABELS = [...DEFAULT_HISTORICAL_LABELS];

// Supabase Configuration
// Replace these values with your actual Supabase URL and Anon Key
const SUPABASE_URL = "https://uaareqlqrkgpmltvrjao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-RZnuhIwEjepuaXPxmrkSg_iZawf7jO";

let supabaseClient = null;

// Initialize Supabase client if keys are provided and supabase JS SDK is loaded
if (typeof supabase !== 'undefined' && SUPABASE_URL !== "YOUR_SUPABASE_URL") {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// State Variables
let appData = {};
let selectedBarangay = null; // null represents City-Wide view

// Chart Instances
let genderChartInstance = null;
let ageChartInstance = null;
let trendChartInstance = null;

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
    await initData();
    initClock();
    initEventListeners();
    fillTrendYearOptions();
    renderDashboard();
});

// Show/Hide Database Loading Overlay
function showLoading(show) {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
        if (show) {
            overlay.classList.add("active");
        } else {
            overlay.classList.remove("active");
        }
    }
}

// Load data from Supabase DB or LocalStorage fallback, or seed default values
async function initData() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('demographics')
                .select('data, labels')
                .eq('id', 1)
                .single();

            if (error) {
                // If row not found (e.g. table is empty/new), initialize it
                if (error.code === 'PGRST116') {
                    console.log("No data found in Supabase. Initializing default demographic data.");
                    await restoreDefaultData();
                } else {
                    throw error;
                }
            } else if (data && data.data) {
                appData = data.data;
                if (Array.isArray(data.labels) && data.labels.length > 0) {
                    HISTORICAL_LABELS = data.labels;
                }
            } else {
                await restoreDefaultData();
            }
        } catch (e) {
            console.error("Error loading data from Supabase. Falling back to LocalStorage.", e);
            loadFromLocalStorageFallback();
        }
    } else {
        console.log("Supabase not configured or credentials missing. Using LocalStorage fallback.");
        loadFromLocalStorageFallback();
    }
}

// LocalStorage Fallback loaders
function loadFromLocalStorageFallback() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.data) {
                appData = parsed.data;
            } else {
                appData = parsed;
            }
            if (parsed && Array.isArray(parsed.labels) && parsed.labels.length > 0) {
                HISTORICAL_LABELS = parsed.labels;
            }
        } catch (e) {
            console.error("Error parsing local demographic data. Resetting to defaults.", e);
            restoreDefaultDataSync();
        }
    } else {
        restoreDefaultDataSync();
    }
}

// Restore default census mock data
async function restoreDefaultData() {
    appData = JSON.parse(JSON.stringify(DEFAULT_DEMOGRAPHIC_DATA));
    HISTORICAL_LABELS = [...DEFAULT_HISTORICAL_LABELS];
    delete appData._cityHistory;
    await saveData();
}

// Synchronous default data restore (for fallback)
function restoreDefaultDataSync() {
    appData = JSON.parse(JSON.stringify(DEFAULT_DEMOGRAPHIC_DATA));
    HISTORICAL_LABELS = [...DEFAULT_HISTORICAL_LABELS];
    delete appData._cityHistory;
    saveDataSync();
}

// Save active state to Supabase or fallback to LocalStorage
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

// Synchronous save to LocalStorage fallback
function saveDataSync() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: appData, labels: HISTORICAL_LABELS }));
}

// Running clock function in the header
function initClock() {
    const timeEl = document.getElementById("date-time");

    function updateClock() {
        const now = new Date();
        const options = {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        timeEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${now.toLocaleString('en-US', options)}`;
    }

    updateClock();
    setInterval(updateClock, 1000);
}

// Setup Event Handlers for Map, Inputs, Forms, and Actions
function initEventListeners() {
    const mapPolygons = document.querySelectorAll(".map-polygon");
    const mapWrapper = document.querySelector(".map-wrapper");
    const tooltip = document.getElementById("map-tooltip");

    const tooltipTitle = document.getElementById("tooltip-title");
    const tooltipPop = document.getElementById("tooltip-pop");
    const tooltipMale = document.getElementById("tooltip-male");
    const tooltipFemale = document.getElementById("tooltip-female");

    // Form selection sync
    const brgySelect = document.getElementById("brgy-select");

    // 1. Map Polygons Interaction
    mapPolygons.forEach(polygon => {
        const name = polygon.getAttribute("data-name");

        // Hover Enter
        polygon.addEventListener("mouseenter", (e) => {
            const stats = getBarangayStats(name);
            tooltipTitle.textContent = name;
            tooltipPop.textContent = stats.total.toLocaleString();
            tooltipMale.textContent = stats.male.toLocaleString();
            tooltipFemale.textContent = stats.female.toLocaleString();
            tooltip.classList.add("visible");
        });

        // Hover Move (position tooltip relative to the map-viewport container)
        polygon.addEventListener("mousemove", (e) => {
            const rect = mapWrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        });

        // Hover Leave
        polygon.addEventListener("mouseleave", () => {
            tooltip.classList.remove("visible");
        });

        // Click Selection
        polygon.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent clicking background from clearing selection
            selectBarangay(name);
        });
    });

    // 2. Click on Map Viewport Background to reset to City-Wide
    mapWrapper.addEventListener("click", () => {
        selectBarangay(null);
    });

    // 3. Sync Form select element with map selection
    brgySelect.addEventListener("change", (e) => {
        const selectedName = e.target.value;
        if (selectedName) {
            selectBarangay(selectedName, false); // select on map but do not change dropdown loop
        }
    });

    // 4. Trend History Entry Form
    const trendForm = document.getElementById("trend-form");
    if (trendForm) {
        trendForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const yearIndex = parseInt(document.getElementById("trend-year").value, 10);
            const trendValue = parseInt(document.getElementById("trend-value").value, 10);
            const trendLabel = document.getElementById("trend-label").value.trim();

            if (Number.isNaN(yearIndex) || yearIndex < 0 || yearIndex >= HISTORICAL_LABELS.length || Number.isNaN(trendValue) || trendValue < 0) {
                alert("Please choose a valid year and enter a valid population value.");
                return;
            }

            showLoading(true);

            if (selectedBarangay) {
                appData[selectedBarangay].history[yearIndex] = trendValue;
            } else {
                if (!appData._cityHistory || !Array.isArray(appData._cityHistory) || appData._cityHistory.length !== HISTORICAL_LABELS.length) {
                    appData._cityHistory = getCityWideStats().history.slice();
                }
                appData._cityHistory[yearIndex] = trendValue;
            }

            if (trendLabel) {
                HISTORICAL_LABELS[yearIndex] = trendLabel;
                fillTrendYearOptions();
            }

            await saveData();
            renderDashboard();

            document.getElementById("trend-value").value = "";
            document.getElementById("trend-label").value = "";
            showLoading(false);
        });
    }

    // 5. Data Entry Form Submission
    const form = document.getElementById("demographics-form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const brgy = document.getElementById("brgy-select").value;
        const sex = form.querySelector('input[name="sex"]:checked').value;
        const ageGroup = document.getElementById("age-select").value;
        const count = parseInt(document.getElementById("pop-count").value, 10);

        if (!brgy || !sex || !ageGroup || isNaN(count) || count <= 0) {
            alert("Please fill all form fields correctly.");
            return;
        }

        showLoading(true);

        // Add to active state
        const sexKey = sex.toLowerCase();
        appData[brgy][sexKey][ageGroup] += count;

        // Add to history (increment current year population value)
        const lastIndex = appData[brgy].history.length - 1;
        appData[brgy].history[lastIndex] += count;

        await saveData();
        renderDashboard();

        // Reset count field only
        document.getElementById("pop-count").value = "";

        showLoading(false);

        // Show glowing success effect on selected card
        const cardTotal = document.getElementById("card-total");
        cardTotal.style.boxShadow = "0 0 20px var(--accent-cyan-glow)";
        setTimeout(() => {
            cardTotal.style.boxShadow = "";
        }, 1000);
    });

    // 5. Actions / Tool buttons
    document.getElementById("btn-seed-data").addEventListener("click", async () => {
        if (confirm("Are you sure you want to restore default population demographics? This will overwrite your current changes.")) {
            showLoading(true);
            await restoreDefaultData();
            selectBarangay(null);
            renderDashboard();
            showLoading(false);
        }
    });

    document.getElementById("btn-clear-data").addEventListener("click", async () => {
        if (confirm("Are you sure you want to clear all counts? All numbers will be set to zero.")) {
            showLoading(true);
            // Set all values to 0
            for (let brgy in appData) {
                for (let age in appData[brgy].male) appData[brgy].male[age] = 0;
                for (let age in appData[brgy].female) appData[brgy].female[age] = 0;
                appData[brgy].history = [0, 0, 0, 0, 0];
            }
            await saveData();
            renderDashboard();
            showLoading(false);
        }
    });
}

// Perform Barangay Selection and UI updates
function selectBarangay(name, updateForm = true) {
    selectedBarangay = name;

    // Update map polygon selected classes
    const polygons = document.querySelectorAll(".map-polygon");
    polygons.forEach(polygon => {
        if (polygon.getAttribute("data-name") === name) {
            polygon.classList.add("selected");
        } else {
            polygon.classList.remove("selected");
        }
    });

    // Sync Form Dropdown Select if requested
    if (updateForm) {
        const brgySelect = document.getElementById("brgy-select");
        brgySelect.value = name || "";
    }

    renderDashboard();
}

// Retrieve totals for a single barangay
function getBarangayStats(name) {
    const brgy = appData[name];
    if (!brgy) return { total: 0, male: 0, female: 0 };

    let maleSum = Object.values(brgy.male).reduce((a, b) => a + b, 0);
    let femaleSum = Object.values(brgy.female).reduce((a, b) => a + b, 0);

    return {
        total: maleSum + femaleSum,
        male: maleSum,
        female: femaleSum
    };
}

// Aggregate city-wide demographic data
function getCityWideStats() {
    let total = 0, male = 0, female = 0;
    let maleAge = { "0-14": 0, "15-24": 0, "25-54": 0, "55-64": 0, "65+": 0 };
    let femaleAge = { "0-14": 0, "15-24": 0, "25-54": 0, "55-64": 0, "65+": 0 };
    let history = [0, 0, 0, 0, 0];

    for (let brgyName in appData) {
        if (brgyName === '_cityHistory') continue;
        const brgy = appData[brgyName];

        for (let age in brgy.male) {
            maleAge[age] += brgy.male[age];
            male += brgy.male[age];
        }
        for (let age in brgy.female) {
            femaleAge[age] += brgy.female[age];
            female += brgy.female[age];
        }

        for (let i = 0; i < history.length; i++) {
            history[i] += brgy.history[i] || 0;
        }
    }

    if (Array.isArray(appData._cityHistory) && appData._cityHistory.length === history.length) {
        history = appData._cityHistory.slice();
    }

    total = male + female;

    return { total, male, female, maleAge, femaleAge, history };
}

// Render values and redraw/update chart configurations
function renderDashboard() {
    let stats = {};
    let ageLabels = ["0-14", "15-24", "25-54", "55-64", "65+"];
    let maleAgeData = [];
    let femaleAgeData = [];
    let historyData = [];

    // Get current data based on selection
    if (selectedBarangay) {
        const brgy = appData[selectedBarangay];
        const localStats = getBarangayStats(selectedBarangay);
        stats = {
            total: localStats.total,
            male: localStats.male,
            female: localStats.female,
            history: brgy.history
        };

        ageLabels.forEach(age => {
            maleAgeData.push(brgy.male[age]);
            femaleAgeData.push(brgy.female[age]);
        });

        historyData = brgy.history;

        // Update Labels
        document.getElementById("selected-brgy-val").textContent = selectedBarangay;
        document.getElementById("selected-badge").textContent = `${selectedBarangay} Analytics`;
    } else {
        // Aggregate City-Wide
        const cwStats = getCityWideStats();
        stats = {
            total: cwStats.total,
            male: cwStats.male,
            female: cwStats.female,
            history: cwStats.history
        };

        ageLabels.forEach(age => {
            maleAgeData.push(cwStats.maleAge[age]);
            femaleAgeData.push(cwStats.femaleAge[age]);
        });

        historyData = cwStats.history;

        // Update Labels
        document.getElementById("selected-brgy-val").textContent = "City-Wide";
        document.getElementById("selected-badge").textContent = "City-Wide Analytics";
    }

    // 1. Update Banner Text Counters
    document.getElementById("total-pop-val").textContent = stats.total.toLocaleString();
    document.getElementById("total-male-val").textContent = stats.male.toLocaleString();
    document.getElementById("total-female-val").textContent = stats.female.toLocaleString();

    // Male & Female percentages
    const malePct = stats.total > 0 ? ((stats.male / stats.total) * 100).toFixed(1) : "0.0";
    const femalePct = stats.total > 0 ? ((stats.female / stats.total) * 100).toFixed(1) : "0.0";
    document.getElementById("male-pct").textContent = `${malePct}% of total`;
    document.getElementById("female-pct").textContent = `${femalePct}% of total`;

    // 2. Render Charts
    renderCharts(stats.male, stats.female, ageLabels, maleAgeData, femaleAgeData, historyData);
}

// Configure and Draw charts
function fillTrendYearOptions() {
    const yearSelect = document.getElementById("trend-year");
    if (!yearSelect) return;

    yearSelect.innerHTML = "<option value=\"\" disabled selected>-- Choose Year --</option>";
    HISTORICAL_LABELS.forEach((label, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = label;
        yearSelect.appendChild(option);
    });
}

function renderCharts(maleTotal, femaleTotal, ageLabels, maleAgeData, femaleAgeData, historyData) {

    // Set custom Chart.js font and styling defaults
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Outfit';
    Chart.defaults.font.size = 11;

    // --- Chart 1: Gender Doughnut Chart ---
    if (genderChartInstance) {
        genderChartInstance.data.datasets[0].data = [maleTotal, femaleTotal];
        genderChartInstance.update();
    } else {
        const ctx1 = document.getElementById("genderChart").getContext("2d");
        genderChartInstance = new Chart(ctx1, {
            type: "doughnut",
            data: {
                labels: ["Male", "Female"],
                datasets: [{
                    data: [maleTotal, femaleTotal],
                    backgroundColor: ["#06b6d4", "#f43f5e"],
                    borderWidth: 2,
                    borderColor: "#1e293b",
                    hoverBorderColor: "#f8fafc"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            padding: 15,
                            boxWidth: 12,
                            font: { size: 12, weight: 600 }
                        }
                    },
                    tooltip: {
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        titleFont: { size: 12, weight: 700 },
                        bodyFont: { size: 12 },
                        padding: 10,
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.15)",
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                let value = context.raw || 0;
                                let total = maleTotal + femaleTotal;
                                let pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return ` ${label}: ${value.toLocaleString()} (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: "65%"
            }
        });
    }

    // --- Chart 2: Grouped Horizontal Bar Chart ---
    if (ageChartInstance) {
        ageChartInstance.data.datasets[0].data = maleAgeData;
        ageChartInstance.data.datasets[1].data = femaleAgeData;
        ageChartInstance.update();
    } else {
        const ctx2 = document.getElementById("ageChart").getContext("2d");
        ageChartInstance = new Chart(ctx2, {
            type: "bar",
            data: {
                labels: ageLabels.map(l => l + " Years"),
                datasets: [
                    {
                        label: "Male",
                        data: maleAgeData,
                        backgroundColor: "rgba(6, 182, 212, 0.85)",
                        borderRadius: 4,
                        barThickness: 10
                    },
                    {
                        label: "Female",
                        data: femaleAgeData,
                        backgroundColor: "rgba(244, 63, 94, 0.85)",
                        borderRadius: 4,
                        barThickness: 10
                    }
                ]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { boxWidth: 10, padding: 10 }
                    },
                    tooltip: {
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        padding: 10,
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.15)"
                    }
                },
                scales: {
                    x: {
                        grid: { color: "rgba(255, 255, 255, 0.05)" },
                        ticks: { color: "#94a3b8" }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: "#f8fafc", font: { weight: 500 } }
                    }
                }
            }
        });
    }

    // --- Chart 3: Linear Population updates/trend line chart ---
    if (trendChartInstance) {
        trendChartInstance.data.labels = HISTORICAL_LABELS.slice();
        trendChartInstance.data.datasets[0].data = historyData;
        trendChartInstance.update();
    } else {
        const ctx3 = document.getElementById("trendChart").getContext("2d");

        // Create glowing violet gradient
        const gradient = ctx3.createLinearGradient(0, 0, 0, 160);
        gradient.addColorStop(0, "rgba(139, 92, 246, 0.35)");
        gradient.addColorStop(1, "rgba(139, 92, 246, 0.0)");

        trendChartInstance = new Chart(ctx3, {
            type: "line",
            data: {
                labels: HISTORICAL_LABELS.slice(),
                datasets: [{
                    label: "Overall Population",
                    data: historyData,
                    borderColor: "#8b5cf6",
                    borderWidth: 3,
                    pointBackgroundColor: "#8b5cf6",
                    pointBorderColor: "#f8fafc",
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.35
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
                        borderColor: "rgba(255, 255, 255, 0.15)"
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

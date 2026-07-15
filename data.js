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

const BARANGAY_COLORS = {
    "Sucat": "#e1271a", "Buli": "#f97316", "Cupang": "#eab308",
    "Alabang": "#22c55e", "Ayala Alabang": "#06b6d4", "Bayanan": "#3b82f6",
    "Putatan": "#8b5cf6", "Poblacion": "#d946ef", "Tunasan": "#ec4899"
};

const STORAGE_KEY = "muntinlupa_demographics_data";
let HISTORICAL_LABELS = ["2015", "2020", "2024"];
const SUPABASE_URL = "https://uaareqlqrkgpmltvrjao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-RZnuhIwEjepuaXPxmrkSg_iZawf7jO";

let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL !== "YOUR_SUPABASE_URL") {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let appData = {};
let selectedBarangay = null;
let selectedYear = "2024";

function showLoading(show) {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
        if (show) overlay.classList.add("active");
        else overlay.classList.remove("active");
    }
}

async function initData() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('barangay_population')
                .select('*')
                .order('year', { ascending: true });
            if (error) throw error;
            if (data && data.length > 0) {
                const years = [...new Set(data.map(r => r.year))].sort();
                HISTORICAL_LABELS = years.map(String);
                appData = {};
                data.forEach(row => {
                    if (!appData[row.barangay_name]) {
                        appData[row.barangay_name] = { history: new Array(years.length).fill(0) };
                    }
                    appData[row.barangay_name].history[years.indexOf(row.year)] = row.population || 0;
                });
            } else {
                await restoreDefaultData();
            }
        } catch (e) {
            console.error("Error loading from Supabase. Falling back to LocalStorage.", e);
            loadFromLocalStorageFallback();
        }
    } else {
        loadFromLocalStorageFallback();
    }
}

function loadFromLocalStorageFallback() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try { appData = JSON.parse(stored).data || JSON.parse(stored); }
        catch (e) { restoreDefaultDataSync(); }
    } else { restoreDefaultDataSync(); }
}

function populateYearSelect() {
    const sel = document.getElementById("year-select");
    if (!sel) return;
    sel.innerHTML = "";
    HISTORICAL_LABELS.forEach(year => {
        const opt = document.createElement("option");
        opt.value = year; opt.textContent = year; sel.appendChild(opt);
    });
    if (!HISTORICAL_LABELS.includes(selectedYear)) {
        selectedYear = HISTORICAL_LABELS[HISTORICAL_LABELS.length - 1] || "2024";
    }
    sel.value = selectedYear;
}

async function restoreDefaultData() {
    appData = JSON.parse(JSON.stringify(DEFAULT_DEMOGRAPHIC_DATA));
    HISTORICAL_LABELS = ["2015", "2020", "2024"];
    await saveData();
}

function restoreDefaultDataSync() {
    appData = JSON.parse(JSON.stringify(DEFAULT_DEMOGRAPHIC_DATA));
    HISTORICAL_LABELS = ["2015", "2020", "2024"];
    populateYearSelect();
    saveDataSync();
}

async function saveData() {
    if (supabaseClient) {
        try {
            const rows = [];
            Object.keys(appData).forEach(name => {
                HISTORICAL_LABELS.forEach((year, idx) => {
                    rows.push({ barangay_name: name, year: parseInt(year), population: (appData[name].history[idx] || 0) });
                });
            });
            if (rows.length > 0) {
                const { error } = await supabaseClient
                    .from('barangay_population')
                    .upsert(rows, { onConflict: 'barangay_name,year' });
                if (error) throw error;
            }
        } catch (e) { saveDataSync(); }
    } else { saveDataSync(); }
}

function saveDataSync() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: appData }));
}

function getYearIndex(year) {
    const idx = HISTORICAL_LABELS.indexOf(String(year));
    return idx >= 0 ? idx : HISTORICAL_LABELS.length - 1;
}

function getBarangayStats(name, year = selectedYear) {
    const brgy = appData[name];
    if (!brgy || !Array.isArray(brgy.history)) return { total: 0 };
    return { total: brgy.history[getYearIndex(year)] || 0 };
}

function getCityWideStats() {
    const len = HISTORICAL_LABELS.length;
    let history = new Array(len).fill(0);
    for (let n in appData) {
        if (appData[n] && Array.isArray(appData[n].history)) {
            for (let i = 0; i < len; i++) history[i] += appData[n].history[i] || 0;
        }
    }
    return { total: history[getYearIndex(selectedYear)] || 0, history };
}
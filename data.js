
const BARANGAY_COLORS = {
    "Sucat": "#e1271a", "Buli": "#f97316", "Cupang": "#eab308",
    "Alabang": "#22c55e", "Ayala Alabang": "#06b6d4", "Bayanan": "#3b82f6",
    "Putatan": "#8b5cf6", "Poblacion": "#d946ef", "Tunasan": "#ec4899"
};

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
                .from('data_values')
                .select('value, year, barangays(barangay_name)')
                .eq('indicator_id', 1)
                .not('value', 'is', null)
                .order('year', { ascending: true });
            if (error) throw error;
            const filtered = data || [];
            if (filtered.length > 0) {
                const years = [...new Set(filtered.map(r => r.year))].sort();
                HISTORICAL_LABELS = years.map(String);
                appData = {};
                filtered.forEach(row => {
                    const name = row.barangays?.barangay_name;
                    if (!name) return;
                    if (!appData[name]) {
                        appData[name] = { history: new Array(years.length).fill(0) };
                    }
                    appData[name].history[years.indexOf(row.year)] = row.value;
                });
            }
        } catch (e) {
            console.error("Error loading from Supabase.", e);
        }
    }
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

let dataValuesCache = [];

async function fetchDataValues() {
    if (!supabaseClient) return [];
    try {
        const { data, error } = await supabaseClient
            .from("data_values")
            .select("data_id, value, year, category, subcategory, indicator_id, barangay_id, indicators(indicator_name, unit, sectors(sector_name)), barangays(barangay_name)")
            .eq("category", "Total Population")
            .order("year", { ascending: true });
        if (error) throw error;
        dataValuesCache = data || [];
        return dataValuesCache;
    } catch (e) {
        console.error("Error fetching data_values:", e);
        dataValuesCache = [];
        return [];
    }
}

function getDataValuesFiltered(barangayName, year) {
    return dataValuesCache.filter(row => {
        const matchBarangay = !barangayName || (row.barangays && row.barangays.barangay_name === barangayName);
        const matchYear = !year || row.year === parseInt(year);
        return matchBarangay && matchYear;
    });
}

function getDataValuesCityWide(year) {
    return dataValuesCache.filter(row => {
        const matchYear = !year || row.year === parseInt(year);
        return matchYear;
    });
}
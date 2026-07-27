
// Chart Instances
let trendChartInstance = null;
let barangayBarChartInstance = null;
let trendChartType = "line";
let barangayChartType = "bar";
let lastHistoryData = [];

// Entrance animation helper
function animateEntrance(selector) {
    document.querySelectorAll(selector).forEach(el => {
        el.classList.remove("animate-in");
        void el.offsetWidth;
        el.classList.add("animate-in");
    });
}

// Count-up animation for numeric stat values
function countUp(element, target, duration) {
    if (!element) return;
    duration = duration || 600;
    const start = performance.now();
    const from = 0;
    function tick(now) {
        const elapsed = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - elapsed, 3);
        const current = Math.round(from + (target - from) * eased);
        element.textContent = current.toLocaleString();
        if (elapsed < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
    await initData();
    populateYearSelect();
    initClock();
    initEventListeners();
    renderDashboard();
});



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

    const magnifyLayer = mapWrapper?.querySelector(".map-magnify-layer") || (() => {
        const layer = document.createElement("div");
        layer.className = "map-magnify-layer";
        const img = document.createElement("img");
        img.className = "magnify-img";
        img.alt = "";
        const baseImg = mapWrapper?.querySelector(".base-map-img");
        if (baseImg) img.src = baseImg.src;
        layer.appendChild(img);
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

        polygon.addEventListener("click", (e) => {
            e.stopPropagation(); 
            selectBarangay(name);
        });

        polygon.addEventListener("mouseenter", () => {
            const bbox = polygon.getBBox();
            const cx = bbox.x + bbox.width / 2;
            const cy = bbox.y + bbox.height / 2;
            polygon.style.transformOrigin = `${cx}px ${cy}px`;
            polygon.classList.add("hovered");

            if (magnifyLayer && svgOverlay) {
                const rawPoints = polygon.getAttribute("points") || "";
                const coords = rawPoints.trim().split(/\s+/)
                    .map(p => p.split(","))
                    .filter(([x, y]) => x !== undefined && y !== undefined)
                    .map(([x, y]) => ({ x: Number(x), y: Number(y) }));

                const containerRect = mapWrapper.getBoundingClientRect();
                const ctm = svgOverlay.getScreenCTM();

                const toPct = (svgX, svgY) => {
                    if (!ctm) return { x: svgX / 750 * 100, y: svgY / 750 * 100 };
                    const sx = ctm.a * svgX + ctm.c * svgY + ctm.e;
                    const sy = ctm.b * svgX + ctm.d * svgY + ctm.f;
                    return {
                        x: (sx - containerRect.left) / containerRect.width * 100,
                        y: (sy - containerRect.top) / containerRect.height * 100
                    };
                };

                const clipPoints = coords.map(({x, y}) => {
                    const p = toPct(x, y);
                    return `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`;
                }).join(", ");

                const origin = toPct(cx, cy);

                magnifyLayer.classList.remove("visible");
                magnifyLayer.style.transform = "scale(1)";
                void magnifyLayer.offsetWidth;

                magnifyLayer.style.clipPath = `polygon(${clipPoints})`;
                magnifyLayer.style.transformOrigin = `${origin.x.toFixed(2)}% ${origin.y.toFixed(2)}%`;
                magnifyLayer.style.transform = "scale(1.08)";
                magnifyLayer.classList.add("visible");
            }

            if (tooltip) {
                const stats = getBarangayStats(name);
                document.getElementById("tooltip-title").textContent = name;
                document.getElementById("tooltip-pop").textContent = (stats.total || 0).toLocaleString();
                document.getElementById("tooltip-dot").style.backgroundColor = TOOLTIP_DOT_COLOR;
                tooltip.classList.add("visible");
            }
        });

        polygon.addEventListener("mousemove", (e) => {
            if (!tooltip || !mapWrapper) return;
            const rect = mapWrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            tooltip.style.left = x + "px";
            tooltip.style.top = y + "px";
        });

        polygon.addEventListener("mouseleave", () => {
            polygon.classList.remove("hovered");
            if (magnifyLayer) {
                magnifyLayer.classList.remove("visible");
                magnifyLayer.style.transform = "scale(1)";
            }
            if (tooltip) {
                tooltip.classList.remove("visible");
            }
        });
    });

    if (mapWrapper) {
        mapWrapper.addEventListener("click", () => {
            if (selectedBarangay) selectBarangay(null);
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


function renderDashboard() {
    let totalPopulation = 0;
    let historyData = [];

    if (selectedBarangay && appData[selectedBarangay]) {
        const brgy = appData[selectedBarangay];
        const stats = getBarangayStats(selectedBarangay, selectedYear);
        
        totalPopulation = stats.total;
        historyData = brgy.history || new Array(HISTORICAL_LABELS.length).fill(0);

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
    countUp(totalEl, totalPopulation, 600);

    // Animate current view label
    const selectedEl = document.getElementById("selected-brgy-val");
    if (selectedEl) {
        selectedEl.classList.remove("animate-in");
        void selectedEl.offsetWidth;
        selectedEl.classList.add("animate-in");
    }

    renderTrendChart(historyData);
    renderBarangayBarChart();
}

function renderTrendChart(historyData) {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Montserrat, sans-serif';
    Chart.defaults.font.size = 11;

    lastHistoryData = historyData;

    if (trendChartInstance) {
        trendChartInstance.destroy();
        trendChartInstance = null;
    }

    const ctx3 = document.getElementById("trendChart")?.getContext("2d");
    if (!ctx3) return;

    const gradient = ctx3.createLinearGradient(0, 0, 0, 160);
    gradient.addColorStop(0, "#e1271a");
    gradient.addColorStop(1, "#e1271a89");

    const pieColors = ["#e1271a", "#f44336", "#ff9800"];
    const zeroData = new Array(historyData.length).fill(0);

    let config;

    if (trendChartType === "pie") {
        config = {
            type: "pie",
            data: {
                labels: HISTORICAL_LABELS,
                datasets: [{
                    label: "Overall Population Total",
                    data: zeroData,
                    backgroundColor: pieColors,
                    hoverBackgroundColor: ["#ff2a2a", "#ff6666", "#ffb347"],
                    hoverBorderColor: "#fff",
                    hoverBorderWidth: 3,
                    borderColor: "#fff",
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                hover: { mode: 'nearest', intersect: true },
                animation: { animateRotate: true, animateScale: true, duration: 1000 },
                plugins: {
                    legend: { display: true, labels: { color: "#000000b3" } },
                    tooltip: { backgroundColor: "rgba(0, 0, 0, 0.72)", padding: 10, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.15)" }
                }
            }
        };
        trendChartInstance = new Chart(ctx3, config);
        setTimeout(function() {
            trendChartInstance.data.datasets[0].data = historyData;
            trendChartInstance.update();
        }, 50);
    } else {
        config = {
            type: trendChartType,
            data: {
                labels: HISTORICAL_LABELS,
                datasets: [{
                    label: "Overall Population Total",
                    data: zeroData,
                    backgroundColor: gradient,
                    borderRadius: trendChartType === "bar" ? 6 : 0,
                    hoverBackgroundColor: "#e1271a52",
                    hoverBorderColor: "#e1271a52",
                    hoverBorderWidth: 4,
                    borderColor: trendChartType === "line" ? "#d91406" : undefined,
                    borderWidth: trendChartType === "line" ? 3 : undefined,
                    pointBackgroundColor: trendChartType === "line" ? "#e1271a" : undefined,
                    pointBorderColor: trendChartType === "line" ? "#f8fafc" : undefined,
                    pointBorderWidth: trendChartType === "line" ? 2 : undefined,
                    pointRadius: trendChartType === "line" ? 5 : undefined,
                    pointHoverRadius: trendChartType === "line" ? 9 : undefined,
                    pointHoverBackgroundColor: trendChartType === "line" ? "#ff2a2a" : undefined,
                    pointHoverBorderColor: trendChartType === "line" ? "#fff" : undefined,
                    pointHoverBorderWidth: trendChartType === "line" ? 3 : undefined,
                    fill: false,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                hover: { mode: 'nearest', intersect: true },
                interaction: { mode: 'nearest', intersect: true },
                animation: { duration: 1000, easing: 'easeOutQuart' },
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
                    x: { grid: { display: false }, ticks: { color: "#000000b3" } },
                    y: {
                        grid: { color: "rgba(3, 3, 3, 0.05)" },
                        ticks: { color: "#000000b3", callback: function (value) { return value.toLocaleString(); } }
                    }
                }
            }
        };
        trendChartInstance = new Chart(ctx3, config);
        setTimeout(function() {
            trendChartInstance.data.datasets[0].data = historyData;
            trendChartInstance.update();
        }, 50);
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

document.addEventListener("DOMContentLoaded", () => {
    const trendSelect = document.getElementById("trendChartType");
    const barangaySelect = document.getElementById("barangayChartType");

    if (trendSelect) {
        trendSelect.addEventListener("change", (e) => {
            trendChartType = e.target.value;
            renderTrendChart(lastHistoryData);
        });
    }

    if (barangaySelect) {
        barangaySelect.addEventListener("change", (e) => {
            barangayChartType = e.target.value;
            renderBarangayBarChart();
        });
    }
});
function renderBarangayBarChart() {
    const labels = Object.keys(appData);
    const dataValues = labels.map(brgyName => {
        const stats = getBarangayStats(brgyName, selectedYear);
        return stats.total;
    });

    if (barangayBarChartInstance) {
        barangayBarChartInstance.destroy();
        barangayBarChartInstance = null;
    }

    const ctx4 = document.getElementById("barangayBarChart")?.getContext("2d");
    if (!ctx4) return;

    const gradient = ctx4.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "#e1271a");
    gradient.addColorStop(1, "#e1271a9a");

    const pieColors = ["#e1271a", "#f44336", "#ff9800", "#4caf50", "#2196f3", "#9c27b0", "#00bcd4", "#ff5722", "#795548"];
    const zeroData = new Array(labels.length).fill(0);

    let config;

    if (barangayChartType === "pie") {
        config = {
            type: "pie",
            data: {
                labels: labels,
                datasets: [{
                    label: `Population in ${selectedYear}`,
                    data: zeroData,
                    backgroundColor: pieColors,
                    hoverBackgroundColor: ["rgba(255, 42, 42, 0.7)", "#f44336c2", "rgba(255, 178, 71, 0.77)", "#4caf4fc5", "rgba(66, 164, 245, 0.74)", "rgba(170, 71, 188, 0.77)", "#00bbd4be", "#ff5622cc", "rgba(141, 110, 99, 0.78)"],
                    hoverBorderColor: "#fff",
                    hoverBorderWidth: 3,
                    borderColor: "#fff",
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                hover: { mode: 'nearest', intersect: true },
                interaction: { mode: 'nearest', intersect: true },
                animation: { animateRotate: true, animateScale: true, duration: 1000 },
                plugins: {
                    legend: { display: true, labels: { color: "#000000b3" } },
                    tooltip: {
                        backgroundColor: "rgba(2, 6, 17, 0.95)",
                        padding: 10,
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.15)",
                        callbacks: {
                            label: function(context) {
                                return ` Population: ${context.raw.toLocaleString()}`;
                            }
                        }
                    }
                }
            }
        };
        barangayBarChartInstance = new Chart(ctx4, config);
        setTimeout(function() {
            barangayBarChartInstance.data.datasets[0].data = dataValues;
            barangayBarChartInstance.update();
        }, 50);
    } else {
        config = {
            type: barangayChartType,
            data: {
                labels: labels,
                datasets: [{
                    label: `Population in ${selectedYear}`,
                    data: zeroData,
                    backgroundColor: gradient,
                    borderRadius: barangayChartType === "bar" ? 6 : 0,
                    hoverBackgroundColor: "#e1271a52",
                    hoverBorderColor: "#e1271a52",
                    hoverBorderWidth: 4,
                    borderColor: barangayChartType === "line" ? "#d91406" : undefined,
                    borderWidth: barangayChartType === "line" ? 3 : undefined,
                    pointBackgroundColor: barangayChartType === "line" ? "#c20d00" : undefined,
                    pointBorderColor: barangayChartType === "line" ? "#f8fafc" : undefined,
                    pointBorderWidth: barangayChartType === "line" ? 2 : undefined,
                    pointRadius: barangayChartType === "line" ? 5 : undefined,
                    pointHoverRadius: barangayChartType === "line" ? 9 : undefined,
                    pointHoverBackgroundColor: barangayChartType === "line" ? "#ff2a2a" : undefined,
                    pointHoverBorderColor: barangayChartType === "line" ? "#fff" : undefined,
                    pointHoverBorderWidth: barangayChartType === "line" ? 3 : undefined,
                    fill: false,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                hover: { mode: 'nearest', intersect: true },
                interaction: { mode: 'nearest', intersect: true },
                animation: { duration: 1000, easing: 'easeOutQuart' },
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
                        ticks: { color: "#000000b3" }
                    },
                    y: {
                        grid: { color: "rgba(3, 3, 3, 0.05)" },
                        ticks: {
                            color: "#000000b3",
                            callback: function (value) {    
                                return value.toLocaleString();
                            }
                        }
                    }
                }
            }
        };
        barangayBarChartInstance = new Chart(ctx4, config);
        setTimeout(function() {
            barangayBarChartInstance.data.datasets[0].data = dataValues;
            barangayBarChartInstance.update();
        }, 50);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const smoothLinks = document.querySelectorAll('.lp-header-action-link[href^="#"]');

    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function animatedScrollTo(targetElement, duration = 700) {
        const startY = window.pageYOffset || document.documentElement.scrollTop;
        const targetRect = targetElement.getBoundingClientRect();
        const targetY = Math.max(0, Math.round(startY + targetRect.top));
        const distance = targetY - startY;
        const startTime = performance.now();

        function step(currentTime) {
            const elapsed = Math.min(1, (currentTime - startTime) / duration);
            const progress = easeInOutQuad(elapsed);
            window.scrollTo(0, startY + distance * progress);
            if (elapsed < 1) {
                requestAnimationFrame(step);
            }
        }

        requestAnimationFrame(step);
    }

    smoothLinks.forEach(link => {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            const targetId = this.getAttribute('href').slice(1);
            const targetElement = document.getElementById(targetId);
            if (!targetElement) return;

            animatedScrollTo(targetElement, 10);
            history.replaceState(null, '', '#' + targetId);
        });
    });

    // Add scroll event listener to update active link based on visible section
    function updateActiveLink() {
        const heroSection = document.getElementById('hero-slide');
        if (heroSection) {
            const heroRect = heroSection.getBoundingClientRect();
            const heroInView = heroRect.top <= window.innerHeight * 0.5 && heroRect.bottom >= window.innerHeight * 0.5;
            heroSection.classList.toggle('active-slide', heroInView);
            if (heroInView) {
                document.querySelectorAll('.lp-header-action-link').forEach(l => l.classList.remove('active'));
            }
        }

        const links = document.querySelectorAll('.lp-header-action-link');
        
        links.forEach(link => {
            const targetId = link.getAttribute('href').slice(1);
            const section = document.getElementById(targetId);
            
            if (section) {
                const rect = section.getBoundingClientRect();
                const isInView = rect.top <= window.innerHeight * 0.5 && rect.bottom >= window.innerHeight * 0.5;
                
                if (isInView) {
                    links.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }

                section.classList.toggle('active-slide', isInView);
            }
        });
    }

    window.addEventListener('scroll', updateActiveLink, { passive: true });
    
    // Call once on load to set initial active link
    updateActiveLink();
});

let pyramidChartInstance = null;

const populationData = {
    "2020": {
        male: [25000, 24000, 23000, 22000, 25000, 26000, 25000, 24000, 21000, 18000, 15000, 12000, 9000, 6000, 3000, 2000, 700, 400],
        female: [23200, 22400, 21500, 21700, 23900, 24300, 22600, 20500, 18400, 15600, 13600, 11300, 9600, 6700, 4300, 2200, 1400, 900]
    },
    "2021": {
        male: [23500, 24100, 22900, 22400, 24300, 26200, 25800, 24200, 21700, 18300, 15300, 11900, 9200, 6100, 3600, 1700, 700, 400],
        female: [21800, 22600, 21700, 21600, 23400, 24600, 23100, 20900, 18900, 16100, 13800, 11700, 10000, 7200, 4500, 2400, 1400, 1000]
    },
    "2022": {
        male: [21800, 24200, 23000, 22600, 23600, 26200, 26300, 24900, 22100, 18900, 15700, 12300, 9600, 6600, 3900, 1800, 700, 400],
        female: [20000, 23000, 22000, 22000, 23000, 25000, 24000, 21000, 19000, 17000, 14000, 12000, 10000, 8000, 5000, 3000, 1400, 1000]
    },
    "2023": {
        male: [20100, 24400, 23100, 22900, 22800, 26100, 26600, 25500, 22500, 19500, 16000, 12800, 9900, 7100, 4200, 2100, 700, 400],
        female: [18800, 23200, 21900, 22000, 22100, 24800, 24200, 21900, 19700, 17200, 14300, 12500, 10600, 8200, 5100, 2900, 1400, 1100]
    },
    "2024": {
        male: [18500, 24400, 23200, 23300, 22200, 25900, 26900, 26200, 22900, 20200, 16400, 13300, 10200, 7600, 4500, 2300, 800, 400],
        female: [17200, 23300, 22100, 22300, 21500, 24700, 24700, 22400, 20000, 17800, 14600, 12900, 11000, 8700, 5500, 3200, 1500, 1100]
    },
    "2025": {
        male: [17000, 24400, 23300, 23700, 21800, 25500, 27000, 26700, 23400, 20700, 16800, 13700, 10600, 8000, 4800, 2500, 900, 400],
        female: [15900, 23300, 22200, 22600, 21100, 24400, 25000, 22900, 20500, 18300, 15000, 13300, 11300, 9200, 5900, 3500, 1600, 1100]
    },
    "2026": {
        male: [16900, 22800, 23400, 23900, 21800, 24900, 27200, 27300, 24000, 21200, 17400, 14100, 11000, 8400, 5200, 2800, 1000, 400],
        female: [15800, 21900, 22400, 22700, 20900, 23900, 25300, 23400, 20900, 18800, 15400, 13600, 11700, 9600, 6300, 3800, 1800, 1200]
    },
    "2027": {
        male: [16800, 21200, 23600, 24000, 22000, 24200, 27200, 27700, 24700, 21700, 18000, 14400, 11500, 8700, 5600, 3000, 1100, 500],
        female: [15800, 20300, 22700, 22900, 21000, 23200, 25500, 24000, 21400, 19200, 15900, 13900, 12200, 10000, 6800, 4100, 2000, 1200]
    },
    "2028": {
        male: [16800, 19600, 23800, 24200, 22300, 23400, 27100, 28100, 25400, 22100, 18600, 14800, 11900, 9000, 6100, 3200, 1300, 500],
        female: [15800, 18800, 23000, 23000, 21300, 22500, 25500, 24600, 21900, 19600, 16500, 14100, 12600, 10300, 7300, 4300, 2300, 1300]
    },
    "2029": {
        male: [16700, 18000, 23900, 24300, 22700, 22800, 26900, 28500, 26100, 22500, 19300, 15100, 12400, 9300, 6500, 3500, 1400, 500],
        female: [15700, 17300, 23200, 23200, 21600, 21900, 25400, 25100, 22400, 20000, 17100, 14400, 13000, 10600, 7800, 4700, 2500, 1300]
    },
    "2030": {
        male: [16600, 16500, 23800, 24400, 23000, 22400, 26500, 28700, 26700, 23100, 19800, 15600, 12800, 9700, 6900, 3700, 1600, 600], 
        female: [15700, 15900, 23100, 23300, 21800, 21500, 25200, 25400, 22900, 20400, 17600, 14700, 13400, 11000, 8200, 5000, 2700, 1400]
    }
};

function renderPyramidChart(selectedYear) {
    const canvasElement = document.getElementById('pyramidChart');
    if (!canvasElement) return;
    
    const ctx = canvasElement.getContext('2d');
    const ageGroups = ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80-84', '85+'];
    
    const currentData = populationData[selectedYear];
    const maleData = currentData.male.map(val => -val);
    const femaleData = currentData.female.map(val => val);

    if (pyramidChartInstance) {
        pyramidChartInstance.data.datasets[0].data = maleData;
        pyramidChartInstance.data.datasets[1].data = femaleData;
        pyramidChartInstance.update();
        return;
    }

    Chart.defaults.font.family = 'Montserrat, sans-serif';
    Chart.defaults.font.size = 11;

    pyramidChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ageGroups,
            datasets: [
                {
                    label: 'Male',
                    data: maleData,
                    backgroundColor: '#7ea8f7', 
                    hoverBackgroundColor: 'rgba(126, 168, 247, 0.49)',
                    borderWidth: 0,
                    borderColor: 'transparent',
                    borderRadius: 4,
                    borderSkipped: false
                },
                {
                    label: 'Female',
                    data: femaleData,
                    backgroundColor: '#ff7ac8', 
                    hoverBackgroundColor: 'rgba(255, 122, 200, 0.52)',
                    borderWidth: 0,
                    borderColor: 'transparent',
                    borderRadius: 4,
                    borderSkipped: false
                }
            ]
        },
        options: {
            indexAxis: 'y', 
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: true,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { 
                        color: "#000000b3", 
                        font: { family: 'Montserrat, sans-serif', size: 11, weight: '600' },
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        padding: 16
                    }
                },
                tooltip: {
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    titleFont: { family: 'Montserrat, sans-serif', size: 12, weight: '700' },
                    bodyFont: { family: 'Montserrat, sans-serif', size: 11 },
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.15)",
                    cornerRadius: 8,
                    callbacks: {
                        title: function(tooltipItems) {
                            return 'Age Group: ' + tooltipItems[0].label;
                        },
                        label: function(context) {
                            var value = Math.abs(context.raw);
                            var icon = context.dataset.label === 'Male' ? '\u2642 ' : '\u2640 ';
                            return icon + context.dataset.label + ': ' + value.toLocaleString();
                        },
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: "#000000b3",
                        font: { family: 'Montserrat, sans-serif', size: 10 },
                        callback: function(value) {
                            return Math.abs(value).toLocaleString();
                        }
                    },
                    grid: { color: "rgba(3, 3, 3, 0.05)" },
                    title: {
                        display: true,
                        text: 'Population',
                        color: '#000000b3',
                        font: { family: 'Montserrat, sans-serif', size: 11, weight: '600' }
                    }
                },
                y: {
                    stacked: true,
                    ticks: {
                        color: "#0f172a",
                        font: { family: 'Montserrat, sans-serif', size: 11, weight: '600' },
                        mirror: false
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

function updateProjectedGenderCards(year) {
    var data = populationData[year];
    if (!data) return;
    var maleTotal = data.male.reduce(function(a, b) { return a + b; }, 0);
    var femaleTotal = data.female.reduce(function(a, b) { return a + b; }, 0);
    countUp(document.getElementById('projected-male-val'), maleTotal, 600);
    countUp(document.getElementById('projected-female-val'), femaleTotal, 600);
}

document.addEventListener("DOMContentLoaded", () => {
    const yearSelect = document.getElementById('pyramid-year-select');
    const initialYear = yearSelect.value;
    
    renderPyramidChart(initialYear);
    updateProjectedGenderCards(initialYear);

    yearSelect.addEventListener('change', (event) => {
        const newlySelectedYear = event.target.value;
        renderPyramidChart(newlySelectedYear);
        updateProjectedGenderCards(newlySelectedYear);
    });
});
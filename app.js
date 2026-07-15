
// Chart Instances
let trendChartInstance = null;
let barangayBarChartInstance = null;
let trendChartType = "line";
let barangayChartType = "bar";
let lastHistoryData = [];

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
                zoomLayer.style.transform = "scale(1.03)";
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
    if (totalEl) totalEl.textContent = totalPopulation.toLocaleString();

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

    const baseDataset = {
        label: "Overall Population Total",
        data: historyData
    };

    let config;

    if (trendChartType === "pie") {
        config = {
            type: "pie",
            data: {
                labels: HISTORICAL_LABELS,
                datasets: [{
                    ...baseDataset,
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
                plugins: {
                    legend: { display: true, labels: { color: "#000000b3" } },
                    tooltip: { backgroundColor: "rgba(0, 0, 0, 0.72)", padding: 10, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.15)" }
                }
            }
        };
    } else {
        config = {
            type: trendChartType,
            data: {
                labels: HISTORICAL_LABELS,
                datasets: [{
                    ...baseDataset,
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
                    fill: trendChartType === "line",
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                hover: { mode: 'nearest', intersect: true },
                interaction: { mode: 'nearest', intersect: true },
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
                animation: { duration: 200, easing: 'easeOutQuart' },
                scales: {
                    x: { grid: { display: false }, ticks: { color: "#000000b3" } },
                    y: {
                        grid: { color: "rgba(255, 255, 255, 0.05)" },
                        ticks: { color: "#000000b3", callback: function (value) { return value.toLocaleString(); } }
                    }
                }
            }
        };
    }

    trendChartInstance = new Chart(ctx3, config);
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

    const baseDataset = {
        label: `Population in ${selectedYear}`,
        data: dataValues
    };

    let config;

    if (barangayChartType === "pie") {
        config = {
            type: "pie",
            data: {
                labels: labels,
                datasets: [{
                    ...baseDataset,
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
    } else {
        config = {
            type: barangayChartType,
            data: {
                labels: labels,
                datasets: [{
                    ...baseDataset,
                    backgroundColor: barangayChartType === "bar" ? gradient : gradient,
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
                    fill: barangayChartType === "line",
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                hover: { mode: 'nearest', intersect: true },
                interaction: { mode: 'nearest', intersect: true },
                animation: { duration: 200, easing: 'easeOutQuart' },
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
                        grid: { color: "rgba(255, 255, 255, 0.05)" },
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
    }

    barangayBarChartInstance = new Chart(ctx4, config);
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
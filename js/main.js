import { MapManager } from "./features/MapManager.js";
import { DashboardService } from "./services/DashboardService.js";
import { SpotsService } from "./services/SpotsService.js";

const config = window.CEM_MASTER_CONFIG || {};
const apiBaseUrl = config.API_BASE_URL || window.location.origin;
const computeFrontendUrl = config.COMPUTE_FRONTEND_URL || "http://127.0.0.1:8080/";

const elements = {
  computeFrontendLink: document.querySelector("#compute-frontend-link"),
  status: document.querySelector("#status"),
  searchForm: document.querySelector("#bird-search-form"),
  searchInput: document.querySelector("#bird-search-input"),
  startDate: document.querySelector("#start-date"),
  endDate: document.querySelector("#end-date"),
  suggestions: document.querySelector("#bird-suggestions"),
  showAll: document.querySelector("#show-all-spots"),
  mapMode: document.querySelector("#map-mode"),
  speciesPanel: document.querySelector("#species-panel"),
  speciesImage: document.querySelector("#species-image"),
  speciesCommonName: document.querySelector("#species-common-name"),
  speciesScientificName: document.querySelector("#species-scientific-name"),
  speciesMetrics: document.querySelector("#species-network-metrics"),
  speciesImageCredit: document.querySelector("#species-image-credit"),
  activeSpotRanking: document.querySelector("#active-spot-ranking"),
  topSpotRanking: document.querySelector("#top-spot-ranking"),
  mapLegend: document.querySelector("#map-legend"),
  mapCalloutTitle: document.querySelector("#map-callout-title"),
  mapCalloutCopy: document.querySelector("#map-callout-copy"),
  statBirds: document.querySelector("#stat-birds"),
  statBirdsLabel: document.querySelector("#stat-birds-label"),
  statSpots: document.querySelector("#stat-spots"),
  statDetections: document.querySelector("#stat-detections"),
  statSources: document.querySelector("#stat-sources"),
  detailsPanel: document.querySelector("#details-panel"),
  detailsHeading: document.querySelector("#details-heading"),
  detailsTitle: document.querySelector("#details-title"),
  detailsIntro: document.querySelector("#details-intro"),
  detailsContent: document.querySelector("#details-content"),
};

let mapManager;
let spotsService;
let dashboardService;
let selectedSpecies = null;
let suggestionItems = [];
let suggestionTimer = null;

function configureExternalLinks() {
  if (elements.computeFrontendLink) {
    elements.computeFrontendLink.href = computeFrontendUrl;
  }
}

function setStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.className = `status status--${type}`;
  elements.status.hidden = false;
}

function clearStatus() {
  elements.status.hidden = true;
}

function humanize(value) {
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
  return String(value);
}

function createMetricGrid(metrics, labels = {}) {
  const list = document.createElement("dl");
  list.className = "metric-grid";
  Object.entries(metrics).forEach(([key, value]) => {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = labels[key] || humanize(key);
    detail.textContent = formatValue(value);
    wrapper.append(term, detail);
    list.append(wrapper);
  });
  return list;
}

function appendSubheading(container, text) {
  const heading = document.createElement("h3");
  heading.className = "detail-subheading";
  heading.textContent = text;
  container.append(heading);
}

function selectedDates() {
  const startDate = elements.startDate.value;
  const endDate = elements.endDate.value;
  if (startDate && endDate && startDate > endDate) {
    throw new Error("The From date must be on or before the To date.");
  }
  return { startDate, endDate };
}

function createDataTable(columns, rows) {
  const wrapper = document.createElement("div");
  wrapper.className = "data-table-wrap";
  const table = document.createElement("table");
  table.className = "data-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  columns.forEach(({ label }) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.append(th);
  });
  head.append(headRow);
  const body = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach(({ key, render }) => {
      const td = document.createElement("td");
      const value = row[key];
      const output = render ? render(value, row) : formatValue(value);
      if (output instanceof Node) td.append(output);
      else td.textContent = output;
      tr.append(td);
    });
    body.append(tr);
  });
  table.append(head, body);
  wrapper.append(table);
  return wrapper;
}

// Only these schemes may ever reach an href. The URLs here are built by the
// indexer from configuration plus a FileBrowser hash, so they are not
// attacker-controlled today -- but this is a generic helper fed from API data,
// and `javascript:` in an href executes on click.
const SAFE_LINK_SCHEMES = new Set(["http:", "https:"]);

function isSafeUrl(url) {
  try {
    return SAFE_LINK_SCHEMES.has(new URL(url, window.location.href).protocol);
  } catch {
    return false;
  }
}

function linkCell(url, label) {
  if (!url || !isSafeUrl(url)) return "—";
  const link = document.createElement("a");
  link.href = url;
  link.textContent = label;
  link.title = url;
  link.target = "_blank";
  link.rel = "noopener";
  return link;
}

function fileNameFromUrl(url, fallback) {
  if (!url || url.startsWith("data:")) return fallback;
  try {
    const name = new URL(url, window.location.href).pathname.split("/").filter(Boolean).at(-1);
    return name ? decodeURIComponent(name) : fallback;
  } catch {
    return fallback;
  }
}

function urlCell(url) {
  // "Open" rather than the URL itself: a FileBrowser share link is a long
  // opaque hash that wrecks the column width and tells the reader nothing. The
  // full URL is still on the anchor's title attribute.
  return linkCell(url, "Open");
}

function renderAssetLinks(container, assets = []) {
  assets = Array.isArray(assets) ? assets : [];
  if (!assets.length) return;
  const rows = assets.map((asset) => ({
    analysis: asset.analysis || asset.label || "Analysis",
    input_file: asset.input_file || fileNameFromUrl(asset.input_url, "Input dataset"),
    input_url: asset.input_url || null,
    output_file: asset.output_file || fileNameFromUrl(asset.output_url || asset.url, asset.label || "Output file"),
    output_url: asset.output_url || asset.url || null,
  }));
  appendSubheading(container, "Analysis files");
  container.append(createDataTable(
    [
      { key: "analysis", label: "Analysis" },
      { key: "input_file", label: "Input file" },
      { key: "input_url", label: "Input URL", render: (url) => urlCell(url) },
      { key: "output_file", label: "Output file" },
      { key: "output_url", label: "Output URL", render: (url) => urlCell(url) },
    ],
    rows,
  ));
}

function updateNetworkStats(features, species = null) {
  const properties = features.map((feature) => feature.properties || {});
  const birdRecords = properties.reduce((sum, item) => sum + Number(item.species_count || 0), 0);
  const detections = properties.reduce((sum, item) => sum + Number(item.detection_count || 0), 0);
  const sources = properties.reduce((sum, item) => sum + Number(item.source_count || 0), 0);
  elements.statBirds.textContent = species ? "1" : birdRecords.toLocaleString();
  elements.statBirdsLabel.textContent = species ? "Selected species" : "Bird records across spots";
  elements.statSpots.textContent = features.length.toLocaleString();
  elements.statDetections.textContent = species ? detections.toLocaleString() : "Select a bird";
  elements.statSources.textContent = sources.toLocaleString();
}

function renderRanking(container, features, valueKey, valueLabel, onSelect = null) {
  container.replaceChildren();
  [...features]
    .sort((a, b) => Number(b.properties[valueKey] || 0) - Number(a.properties[valueKey] || 0))
    .forEach((feature, index) => {
      const item = document.createElement("li");
      const row = onSelect ? document.createElement("button") : document.createElement("div");
      if (!onSelect) row.className = "rank-row";
      row.type = onSelect ? "button" : undefined;
      const rank = document.createElement("span");
      rank.textContent = `#${index + 1}`;
      const name = document.createElement("span");
      name.textContent = feature.properties.name;
      const value = document.createElement("span");
      value.className = "rank-value";
      value.textContent = `${formatValue(feature.properties[valueKey] || 0)} ${valueLabel}`;
      row.append(rank, name, value);
      if (onSelect) row.addEventListener("click", () => onSelect(feature));
      item.append(row);
      container.append(item);
    });
}

function resetDetails() {
  elements.detailsPanel.classList.add("is-empty");
  elements.detailsHeading.hidden = true;
  elements.detailsTitle.textContent = "";
  elements.detailsIntro.textContent = "";
  elements.detailsContent.replaceChildren();
}

function showDetailsHeading() {
  elements.detailsPanel.classList.remove("is-empty");
  elements.detailsHeading.hidden = false;
}

function renderSpecies(species) {
  elements.speciesPanel.hidden = false;
  elements.speciesCommonName.textContent = species.common_name;
  elements.speciesScientificName.textContent = species.scientific_name;
  elements.speciesMetrics.replaceChildren();

  const metrics = species.network_metrics || {};
  if (Object.keys(metrics).length) {
    const grid = createMetricGrid(metrics, {
      sci: "Seasonal concentration",
      pmr: "Peak-to-median ratio",
      sunrise_correlation: "Sunrise correlation",
    });
    elements.speciesMetrics.replaceWith(grid);
    grid.id = "species-network-metrics";
    elements.speciesMetrics = grid;
  }

  if (species.image_url) {
    elements.speciesImage.src = species.image_url;
    elements.speciesImage.alt = species.common_name;
    elements.speciesImage.hidden = false;
    elements.speciesImage.onerror = () => {
      elements.speciesImage.hidden = true;
    };
  } else {
    elements.speciesImage.hidden = true;
    elements.speciesImage.removeAttribute("src");
  }
  elements.speciesImageCredit.textContent = species.image_attribution
    ? `Image: ${species.image_attribution}`
    : "";
}

function renderSpotSummary(data) {
  const { spot, summary, top_species: topSpecies = [], bird_inventory: inventory = [] } = data;
  showDetailsHeading();
  elements.detailsTitle.textContent = spot.name;
  elements.detailsIntro.textContent = spot.description || `${spot.latitude}, ${spot.longitude}`;
  elements.detailsContent.replaceChildren();

  elements.detailsContent.append(createMetricGrid({
    species_richness: summary.species_richness,
    total_detections: summary.total_detections,
    recording_days: summary.recording_days,
    contributing_projects: spot.source_count,
  }));

  if (summary.acoustic_indices && Object.keys(summary.acoustic_indices).length) {
    appendSubheading(elements.detailsContent, "Soundscape indices");
    elements.detailsContent.append(createMetricGrid(summary.acoustic_indices));
  }

  if (topSpecies.length) {
    appendSubheading(elements.detailsContent, "Most detected birds");
    const list = document.createElement("ol");
    list.className = "species-list";
    topSpecies.forEach((species) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      const count = document.createElement("strong");
      name.textContent = species.common_name;
      count.textContent = species.detection_count.toLocaleString();
      item.append(name, count);
      list.append(item);
    });
    elements.detailsContent.append(list);
  }

  if (inventory.length) {
    appendSubheading(elements.detailsContent, "Bird inventory and occurrences");
    elements.detailsContent.append(createDataTable([
      { key: "common_name", label: "Bird" },
      { key: "detection_count", label: "Detections" },
      { key: "active_days", label: "Active days" },
      { key: "occurrence", label: "Occurrence", render: (_, row) => `${formatValue(row.first_occurrence)} – ${formatValue(row.last_occurrence)}` },
    ], inventory));
  }

  renderAssetLinks(elements.detailsContent, summary.analysis_assets);
}

function renderHourlyChart(counts) {
  const wrapper = document.createElement("div");
  const chart = document.createElement("div");
  chart.className = "hour-chart";
  const max = Math.max(...counts, 1);
  counts.forEach((count, hour) => {
    const bar = document.createElement("span");
    bar.className = "hour-bar";
    bar.style.height = `${Math.max(2, (count / max) * 100)}%`;
    bar.title = `${hour}:00 — ${count.toLocaleString()} detections`;
    chart.append(bar);
  });
  const caption = document.createElement("div");
  caption.className = "chart-caption";
  caption.innerHTML = "<span>00:00</span><span>Hourly detections</span><span>23:00</span>";
  wrapper.append(chart, caption);
  return wrapper;
}

function renderDailyChart(rows) {
  const wrapper = document.createElement("div");
  const chart = document.createElement("div");
  chart.className = "hour-chart";
  const max = Math.max(...rows.map((item) => Number(item.count) || 0), 1);
  rows.forEach((item) => {
    const bar = document.createElement("span");
    bar.className = "hour-bar";
    bar.style.height = `${Math.max(3, ((Number(item.count) || 0) / max) * 100)}%`;
    bar.title = `${item.date} — ${Number(item.count).toLocaleString()} detections`;
    chart.append(bar);
  });
  const caption = document.createElement("div");
  caption.className = "chart-caption";
  const first = document.createElement("span");
  const middle = document.createElement("span");
  const last = document.createElement("span");
  first.textContent = rows[0]?.date || "";
  middle.textContent = "Occurrence time series";
  last.textContent = rows.at(-1)?.date || "";
  caption.append(first, middle, last);
  wrapper.append(chart, caption);
  return wrapper;
}

function renderSpotSpeciesSummary(data) {
  const { spot, species, observation, jobs = [] } = data;
  showDetailsHeading();
  elements.detailsTitle.textContent = `${species.common_name} at ${spot.name}`;
  elements.detailsIntro.textContent = `${spot.latitude.toFixed(5)}, ${spot.longitude.toFixed(5)}`;
  elements.detailsContent.replaceChildren();

  elements.detailsContent.append(createMetricGrid({
    detections: observation.detection_count,
    recording_days: observation.recording_days,
    average_confidence: observation.average_confidence == null
      ? null : `${Math.round(observation.average_confidence * 100)}%`,
    maximum_confidence: observation.maximum_confidence == null
      ? null : `${Math.round(observation.maximum_confidence * 100)}%`,
    activity_regularity: observation.activity_regularity,
    first_detection: observation.first_detection_date,
    latest_detection: observation.last_detection_date,
  }));

  if (observation.hourly_counts?.length) {
    appendSubheading(elements.detailsContent, "Hourly activity heatmap");
    elements.detailsContent.append(renderHourlyChart(observation.hourly_counts));
  }

  if (observation.daily_counts?.length) {
    appendSubheading(elements.detailsContent, "Detection time series");
    elements.detailsContent.append(renderDailyChart(observation.daily_counts));
  }

  if (observation.analysis_metrics && Object.keys(observation.analysis_metrics).length) {
    appendSubheading(elements.detailsContent, "Bioacoustic, solar and weather analysis");
    elements.detailsContent.append(createMetricGrid(observation.analysis_metrics, {
      sci: "Seasonal concentration",
      pmr: "Peak-to-median ratio",
      sunrise_correlation: "Sunrise correlation",
      peak_solar_relation: "Peak vs solar events",
      severe_weather_note: "Severe-weather interpretation",
    }));
    if (observation.analysis_metrics.severe_weather_note) {
      const note = document.createElement("p");
      note.className = "analysis-note";
      note.textContent = observation.analysis_metrics.severe_weather_note;
      elements.detailsContent.append(note);
    }
  }


  renderAssetLinks(elements.detailsContent, observation.analysis_assets);

  if (jobs.length) {
    appendSubheading(elements.detailsContent, "Analysis jobs");
    elements.detailsContent.append(createDataTable([
      { key: "job_id", label: "Job ID" },
      { key: "input_file", label: "Input file", render: (value, row) => value || fileNameFromUrl(row.input_url, "Input dataset") },
      { key: "input_url", label: "Input URL", render: (url) => urlCell(url) },
      { key: "output_file", label: "Output file", render: (value, row) => value || fileNameFromUrl(row.output_url, "Output file") },
      { key: "output_url", label: "Output URL", render: (url) => urlCell(url) },
    ], jobs));
  }
}

async function handleSpotSelected(feature) {
  const spotId = feature?.properties?.id;
  if (!spotId) return;
  showDetailsHeading();
  elements.detailsTitle.textContent = "Loading analysis…";
  elements.detailsIntro.textContent = "";
  elements.detailsContent.replaceChildren();
  try {
    if (selectedSpecies) {
      renderSpotSpeciesSummary(
        await dashboardService.getSpotSpeciesSummary(
          spotId,
          selectedSpecies.id,
          selectedDates(),
        ),
      );
    } else {
      renderSpotSummary(await dashboardService.getSpotSummary(spotId));
    }
  } catch (error) {
    showDetailsHeading();
    elements.detailsTitle.textContent = "Analysis unavailable";
    elements.detailsIntro.textContent = error.message;
  }
}

async function showAllSpots() {
  selectedSpecies = null;
  elements.searchInput.value = "";
  elements.startDate.value = "";
  elements.endDate.value = "";
  elements.speciesPanel.hidden = true;
  elements.mapLegend.hidden = true;
  setStatus("Loading all monitoring spots…", "loading");
  try {
    const spots = await spotsService.listSpots();
    mapManager.renderSpots(spots);
    updateNetworkStats(spots.features);
    elements.mapCalloutTitle.textContent = "Discover birdlife around you";
    elements.mapCalloutCopy.textContent = "Explore CEM spots and the biodiversity they hold.";
    renderRanking(
      elements.topSpotRanking,
      spots.features,
      "species_count",
      "species",
      (feature) => {
        mapManager.focusFeature(feature);
        handleSpotSelected(feature);
      },
    );
    elements.mapMode.textContent = `Showing all ${spots.features.length} monitoring spots`;
    resetDetails();
    if (spots.features.length === 0) {
      setStatus("No public monitoring spots available", "empty");
    } else {
      clearStatus();
    }
  } catch (error) {
    console.error(error);
    setStatus("Unable to load public monitoring spots. Check that the CEM Master API is running and allows this origin.", "error");
  }
}

async function searchSpecies(query) {
  const items = await dashboardService.listSpecies(query);
  const normalized = query.trim().toLocaleLowerCase();
  const species = items.find((item) =>
    item.common_name.toLocaleLowerCase() === normalized
    || item.scientific_name.toLocaleLowerCase() === normalized
  ) || items[0];
  if (!species) throw new Error(`No bird found for “${query.trim()}”.`);

  selectedSpecies = species;
  elements.searchInput.value = species.common_name;
  renderSpecies(species);
  resetDetails();
  setStatus(`Finding ${species.common_name} observations…`, "loading");
  const dates = selectedDates();
  const spots = await spotsService.listSpots({ speciesId: species.id, ...dates });
  mapManager.renderSpots(spots);
  updateNetworkStats(spots.features, species);
  elements.mapCalloutTitle.textContent = `Where ${species.common_name} was detected`;
  elements.mapCalloutCopy.textContent = "Marker size and colour represent detections in the selected period.";
  elements.mapLegend.hidden = false;
  renderRanking(
    elements.activeSpotRanking,
    spots.features,
    "detection_count",
    "detections",
    (feature) => {
      mapManager.focusFeature(feature);
      handleSpotSelected(feature);
    },
  );
  const dateLabel = dates.startDate || dates.endDate
    ? ` for ${dates.startDate || "the beginning"} to ${dates.endDate || "today"}`
    : " across all dates";
  elements.mapMode.textContent = `${species.common_name} appears at ${spots.features.length} monitoring ${spots.features.length === 1 ? "spot" : "spots"}${dateLabel}`;
  if (spots.features.length) clearStatus();
  else setStatus(`No public observations are available for ${species.common_name}.`, "empty");
}

function renderSuggestions(items) {
  suggestionItems = items;
  elements.suggestions.replaceChildren();
  items.forEach((species) => {
    const option = document.createElement("option");
    option.value = species.common_name;
    option.label = species.scientific_name;
    elements.suggestions.append(option);
  });
}

function bindDashboard() {
  elements.searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = elements.searchInput.value.trim();
    if (!query) {
      setStatus("Enter a common or scientific bird name.", "error");
      return;
    }
    try {
      await searchSpecies(query);
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  elements.showAll.addEventListener("click", showAllSpots);

  const handleDateChange = async () => {
    if (!selectedSpecies) return;
    const query = elements.searchInput.value.trim() || selectedSpecies.common_name;
    try {
      await searchSpecies(query);
    } catch (error) {
      setStatus(error.message, "error");
    }
  };
  elements.startDate.addEventListener("change", handleDateChange);
  elements.endDate.addEventListener("change", handleDateChange);

  elements.searchInput.addEventListener("input", () => {
    clearTimeout(suggestionTimer);
    const query = elements.searchInput.value.trim();
    suggestionTimer = setTimeout(async () => {
      try {
        renderSuggestions(await dashboardService.listSpecies(query));
      } catch {
        renderSuggestions([]);
      }
    }, 180);
  });

  // Populate useful suggestions before the first keystroke.
  dashboardService.listSpecies().then(renderSuggestions).catch(() => {});
}

async function bootstrap() {
  configureExternalLinks();
  setStatus("Loading public monitoring spots…", "loading");
  try {
    spotsService = new SpotsService({ apiBaseUrl });
    dashboardService = new DashboardService({ apiBaseUrl });
    mapManager = new MapManager({
      mapElementId: "map",
      onSpotSelected: handleSpotSelected,
    });
    bindDashboard();
    await showAllSpots();
  } catch (error) {
    console.error(error);
    setStatus("Unable to initialize the CEM Master dashboard.", "error");
  }
}

window.addEventListener("DOMContentLoaded", bootstrap);

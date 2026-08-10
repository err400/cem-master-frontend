import { MapManager } from "./features/MapManager.js";
import { DashboardService } from "./services/DashboardService.js";
import { SpotsService } from "./services/SpotsService.js";

const config = window.CEM_MASTER_CONFIG || {};
const apiBaseUrl = config.API_BASE_URL || window.location.origin;

const elements = {
  status: document.querySelector("#status"),
  searchForm: document.querySelector("#bird-search-form"),
  searchInput: document.querySelector("#bird-search-input"),
  suggestions: document.querySelector("#bird-suggestions"),
  showAll: document.querySelector("#show-all-spots"),
  mapMode: document.querySelector("#map-mode"),
  speciesPanel: document.querySelector("#species-panel"),
  speciesImage: document.querySelector("#species-image"),
  speciesCommonName: document.querySelector("#species-common-name"),
  speciesScientificName: document.querySelector("#species-scientific-name"),
  speciesIucn: document.querySelector("#species-iucn"),
  speciesMetrics: document.querySelector("#species-network-metrics"),
  speciesImageCredit: document.querySelector("#species-image-credit"),
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
  elements.speciesIucn.textContent = species.iucn_category || "IUCN status unavailable";
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
  const { spot, summary, top_species: topSpecies = [] } = data;
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

function renderSpotSpeciesSummary(data) {
  const { spot, species, observation } = data;
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
    appendSubheading(elements.detailsContent, "Daily activity pattern");
    elements.detailsContent.append(renderHourlyChart(observation.hourly_counts));
  }

  if (observation.analysis_metrics && Object.keys(observation.analysis_metrics).length) {
    appendSubheading(elements.detailsContent, "Network analysis");
    elements.detailsContent.append(createMetricGrid(observation.analysis_metrics, {
      sci: "Seasonal concentration",
      pmr: "Peak-to-median ratio",
      sunrise_correlation: "Sunrise correlation",
    }));
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
        await dashboardService.getSpotSpeciesSummary(spotId, selectedSpecies.id),
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
  elements.speciesPanel.hidden = true;
  setStatus("Loading all monitoring spots…", "loading");
  try {
    const spots = await spotsService.listSpots();
    mapManager.renderSpots(spots);
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
  const spots = await spotsService.listSpots({ speciesId: species.id });
  mapManager.renderSpots(spots);
  elements.mapMode.textContent = `${species.common_name} appears at ${spots.features.length} monitoring ${spots.features.length === 1 ? "spot" : "spots"}`;
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

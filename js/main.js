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
  speciesSnippetWrap: document.querySelector("#species-snippet-wrap"),
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
let activeAudio = null;

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
    term.textContent =
      labels[key] ||
      labels[key.toLowerCase()] ||
      labels[key.toUpperCase()] ||
      humanize(key);
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

function optionalUrlCell(url, emptyLabel = "Not shared") {
  return url ? urlCell(url) : emptyLabel;
}

function apiUrl(path) {
  return new URL(path, `${apiBaseUrl.replace(/\/+$/, "")}/`).href;
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
      name.className = "rank-name";
      const spotName = feature.properties.name || "Spot";
      const project = feature.properties.source_project_id;
      name.innerHTML = `<strong>${escapeHtml(spotName)}</strong>${project ? `<small class="rank-project">${escapeHtml(project)}</small>` : ""}`;
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

function createSnippetPlayer(snippet, { label = "Play Call (9s)", subtitle = "", compact = false } = {}) {
  if (!snippet || !snippet.url) return null;

  const container = document.createElement("div");
  container.className = compact ? "snippet-player snippet-player--compact" : "snippet-player";

  const audio = new Audio(apiUrl(snippet.url));
  audio.preload = "none";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "play-snippet-btn";
  const defaultLabel = compact ? "9s" : label;
  btn.innerHTML = `<span class="snippet-play-icon" aria-hidden="true">▶</span> <span class="snippet-play-label">${escapeHtml(defaultLabel)}</span>`;
  btn.title = `Play 9s bird call clip${snippet.confidence ? ` (max confidence: ${Math.round(snippet.confidence * 100)}%)` : ""}`;

  const metaWrap = document.createElement("div");
  metaWrap.className = "snippet-meta";

  if (snippet.confidence != null && !compact) {
    const confBadge = document.createElement("span");
    confBadge.className = "snippet-badge snippet-conf";
    confBadge.textContent = `${Math.round(Number(snippet.confidence) * 100)}% conf`;
    metaWrap.append(confBadge);
  }

  if (snippet.spot_name && !compact) {
    const spotBadge = document.createElement("span");
    spotBadge.className = "snippet-badge snippet-spot";
    spotBadge.textContent = snippet.spot_name;
    metaWrap.append(spotBadge);
  } else if (subtitle && !compact) {
    const subSpan = document.createElement("span");
    subSpan.className = "snippet-sub";
    subSpan.textContent = subtitle;
    metaWrap.append(subSpan);
  }

  const wave = document.createElement("div");
  wave.className = "snippet-wave";
  wave.innerHTML = `<span></span><span></span><span></span><span></span>`;

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (activeAudio && activeAudio !== audio) {
      activeAudio.pause();
    }
    activeAudio = audio;
    btn.classList.add("is-loading");
    const iconSpan = btn.querySelector(".snippet-play-icon");
    const labelSpan = btn.querySelector(".snippet-play-label");
    if (iconSpan) iconSpan.textContent = "⏳";
    try {
      await audio.play();
    } catch (err) {
      console.error("Audio snippet playback error:", err);
      btn.classList.remove("is-loading");
      if (iconSpan) iconSpan.textContent = "⚠️";
      if (labelSpan) labelSpan.textContent = "Error";
      setTimeout(() => {
        if (iconSpan) iconSpan.textContent = "▶";
        if (labelSpan) labelSpan.textContent = defaultLabel;
      }, 3000);
    }
  });

  audio.addEventListener("play", () => {
    btn.classList.remove("is-loading");
    btn.classList.add("is-playing");
    const iconSpan = btn.querySelector(".snippet-play-icon");
    const labelSpan = btn.querySelector(".snippet-play-label");
    if (iconSpan) iconSpan.textContent = "⏸";
    if (labelSpan) labelSpan.textContent = compact ? "9s" : "Playing...";
    container.classList.add("is-playing");
  });

  const resetState = () => {
    btn.classList.remove("is-loading", "is-playing");
    const iconSpan = btn.querySelector(".snippet-play-icon");
    const labelSpan = btn.querySelector(".snippet-play-label");
    if (iconSpan) iconSpan.textContent = "▶";
    if (labelSpan) labelSpan.textContent = defaultLabel;
    container.classList.remove("is-playing");
  };

  audio.addEventListener("pause", resetState);
  audio.addEventListener("ended", () => {
    resetState();
    audio.currentTime = 0;
  });

  container.append(btn);
  if (metaWrap.childElementCount) container.append(metaWrap);
  container.append(wave);

  return container;
}

function renderSpecies(species) {
  elements.speciesPanel.hidden = false;
  elements.speciesCommonName.textContent = species.common_name;
  elements.speciesScientificName.textContent = species.scientific_name;
  elements.speciesMetrics.replaceChildren();

  if (elements.speciesSnippetWrap) {
    elements.speciesSnippetWrap.replaceChildren();
    if (species.snippet && species.snippet.url) {
      const player = createSnippetPlayer(species.snippet, {
        label: "Play Call (9s)",
        subtitle: species.snippet.spot_name ? `Recorded at ${species.snippet.spot_name}` : "",
      });
      if (player) {
        elements.speciesSnippetWrap.append(player);
        elements.speciesSnippetWrap.hidden = false;
      } else {
        elements.speciesSnippetWrap.hidden = true;
      }
    } else {
      elements.speciesSnippetWrap.hidden = true;
    }
  }

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

const ACOUSTIC_INDEX_LABELS = {
  aci: "Acoustic Complexity (ACI)",
  adi: "Acoustic Diversity (ADI)",
  aei: "Acoustic Evenness (AEI)",
  ndsi: "Soundscape Index (NDSI)",
  bi: "Bioacoustic Index (BI)",
  bio: "Bioacoustic Index (BIO)",
  mfc: "Mid-Frequency Cover (MFC)",
  cls: "Cluster Score (CLS)",
  h: "Acoustic Entropy (H)",
};

async function renderSpotSummary(data, dates = {}) {
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
    elements.detailsContent.append(createMetricGrid(summary.acoustic_indices, ACOUSTIC_INDEX_LABELS));
  }

  const hasHourly = summary.hourly_counts && summary.hourly_counts.some((count) => count > 0);
  const heatmapCard = renderSpeciesHeatmapCard(inventory, 20);

  if (hasHourly || heatmapCard) {
    const grid = document.createElement("div");
    grid.className = "analysis-charts-grid";
    if (hasHourly) {
      grid.append(renderDiurnalActivityCard(summary.hourly_counts, "Overall bird activity across the day"));
    }
    if (heatmapCard) {
      grid.append(heatmapCard);
    }
    elements.detailsContent.append(grid);
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
    const hasClassification = inventory.some((item) => item.migration_class);
    const hasSnippets = inventory.some((item) => item.snippet && item.snippet.url);
    const columns = [
      { key: "common_name", label: "Bird" },
      { key: "detection_count", label: "Detections" },
      { key: "active_days", label: "Active days" },
    ];
    if (hasClassification) {
      columns.push({ key: "migration_class", label: "Classification" });
    }
    columns.push({
      key: "occurrence",
      label: "Occurrence",
      render: (_, row) => `${formatValue(row.first_occurrence)} – ${formatValue(row.last_occurrence)}`,
    });
    if (hasSnippets) {
      columns.push({
        key: "snippet",
        label: "Call",
        render: (snippet) => {
          if (!snippet || !snippet.url) return "—";
          return createSnippetPlayer(snippet, {
            compact: true,
          });
        },
      });
    }
    elements.detailsContent.append(createDataTable(columns, inventory));
  }

  renderAssetLinks(elements.detailsContent, summary.analysis_assets);

  await renderRecordingsBrowser(elements.detailsContent, spot.id, null, dates, {
    title: "Recordings at this spot",
    emptyText: "No playable public recordings are indexed for this spot.",
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderSpeciesHeatmapCard(inventory = [], limit = 20) {
  const birds = (Array.isArray(inventory) ? inventory : [])
    .filter((bird) => Array.isArray(bird.hourly_counts) && bird.hourly_counts.some((c) => c > 0))
    .slice(0, limit);

  if (!birds.length) return null;

  const card = document.createElement("div");
  card.className = "analysis-chart-card heatmap-card";

  const title = document.createElement("h4");
  title.textContent = `24-hour species activity (Top ${birds.length})`;

  const sub = document.createElement("p");
  sub.className = "chart-subtitle";
  sub.textContent = "Hourly distribution for most active species";

  const cardBody = document.createElement("div");
  cardBody.className = "heatmap-card-body";

  const tableWrap = document.createElement("div");
  tableWrap.className = "species-heatmap-table-wrap";

  const table = document.createElement("table");
  table.className = "species-heatmap-table";

  const tbody = document.createElement("tbody");
  birds.forEach((bird) => {
    const row = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.className = "species-name-td";
    const nameBtn = document.createElement("button");
    nameBtn.type = "button";
    nameBtn.className = "heatmap-species-btn";
    nameBtn.innerHTML = `<span>${escapeHtml(bird.common_name)}</span>`;
    nameBtn.title = `Search and focus ${bird.common_name} (${Number(bird.detection_count || 0).toLocaleString()} detections)`;
    nameBtn.addEventListener("click", () => {
      searchSpecies(bird.common_name);
    });
    nameTd.append(nameBtn);
    row.append(nameTd);

    const maxBirdHour = Math.max(...bird.hourly_counts, 1);
    for (let h = 0; h < 24; h++) {
      const count = Number(bird.hourly_counts[h] || 0);
      const td = document.createElement("td");
      td.className = "heatmap-cell";
      const ratio = count / maxBirdHour;

      if (count > 0) {
        td.style.backgroundColor =
          ratio > 0.8
            ? "#173f2b"
            : ratio > 0.6
              ? "#254e33"
              : ratio > 0.4
                ? "#3a6b47"
                : ratio > 0.25
                  ? "#5c8658"
                  : ratio > 0.1
                    ? "#87a87b"
                    : "#b5cca9";
        td.classList.add("has-activity");
      } else {
        td.style.backgroundColor = "rgba(44, 42, 35, 0.04)";
      }

      td.title = `${bird.common_name} — ${count.toLocaleString()} detections at ${String(h).padStart(2, "0")}:00`;
      row.append(td);
    }
    tbody.append(row);
  });
  table.append(tbody);

  const tfoot = document.createElement("tfoot");
  const footRow = document.createElement("tr");
  const emptyTh = document.createElement("th");
  emptyTh.style.width = "130px";
  footRow.append(emptyTh);

  for (let h = 0; h < 24; h += 2) {
    const th = document.createElement("th");
    th.colSpan = 2;
    th.className = "hour-axis-label";
    th.textContent = String(h).padStart(2, "0");
    footRow.append(th);
  }
  tfoot.append(footRow);
  table.append(tfoot);

  tableWrap.append(table);
  cardBody.append(tableWrap);

  const legend = document.createElement("div");
  legend.className = "heatmap-vertical-legend";
  legend.innerHTML = `
    <span>More activity</span>
    <div class="vertical-gradient-bar"></div>
    <span>Less activity</span>
  `;
  cardBody.append(legend);

  card.append(title, sub, cardBody);
  return card;
}

function renderDiurnalActivityCard(counts = [], subtitle = "Overall bird activity across the day") {
  const card = document.createElement("div");
  card.className = "analysis-chart-card diurnal-card";

  const title = document.createElement("h4");
  title.textContent = "Species diurnal activity";

  const sub = document.createElement("p");
  sub.className = "chart-subtitle";
  sub.textContent = subtitle;

  const body = document.createElement("div");
  body.className = "diurnal-chart-body";

  const plotArea = document.createElement("div");
  plotArea.className = "diurnal-plot-area";

  const yLabel = document.createElement("span");
  yLabel.className = "y-axis-label";
  yLabel.textContent = "Detections";
  plotArea.append(yLabel);

  const maxVal = Math.max(...counts, 0);
  let niceMax = 10;
  if (maxVal > 0) {
    if (maxVal <= 5) niceMax = 5;
    else if (maxVal <= 10) niceMax = 10;
    else if (maxVal <= 20) niceMax = 20;
    else if (maxVal <= 40) niceMax = 40;
    else if (maxVal <= 100) niceMax = Math.ceil(maxVal / 20) * 20;
    else if (maxVal <= 500) niceMax = Math.ceil(maxVal / 50) * 50;
    else niceMax = Math.ceil(maxVal / 100) * 100;
  }

  const tickSteps = 4;
  const tickList = [];
  for (let i = tickSteps; i >= 0; i--) {
    tickList.push(Math.round((niceMax / tickSteps) * i));
  }

  const ticksWrap = document.createElement("div");
  ticksWrap.className = "y-axis-ticks";
  tickList.forEach((val) => {
    const span = document.createElement("span");
    span.textContent = val.toLocaleString();
    ticksWrap.append(span);
  });
  plotArea.append(ticksWrap);

  const gridWrap = document.createElement("div");
  gridWrap.className = "diurnal-gridlines";
  for (let i = 0; i <= tickSteps; i++) {
    const line = document.createElement("span");
    gridWrap.append(line);
  }
  plotArea.append(gridWrap);

  const barsWrap = document.createElement("div");
  barsWrap.className = "diurnal-bars-wrap";
  for (let h = 0; h < 24; h++) {
    const count = Number(counts[h] || 0);
    const bar = document.createElement("span");
    bar.className = "diurnal-bar";
    const pct = niceMax > 0 ? (count / niceMax) * 100 : 0;
    bar.style.height = `${count > 0 ? Math.max(3, pct) : 0}%`;
    bar.title = `${String(h).padStart(2, "0")}:00 — ${count.toLocaleString()} detections`;
    barsWrap.append(bar);
  }
  plotArea.append(barsWrap);
  body.append(plotArea);

  const xAxis = document.createElement("div");
  xAxis.className = "diurnal-x-axis";
  const xLabels = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"];
  xLabels.forEach((lbl) => {
    const span = document.createElement("span");
    span.textContent = lbl;
    xAxis.append(span);
  });
  body.append(xAxis);

  card.append(title, sub, body);
  return card;
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

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "--:--";
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatRecordingDate(recording) {
  const date = recording.recorded_date || "Unknown date";
  if (recording.hour == null) return date;
  const hour = String(recording.hour).padStart(2, "0");
  const minute = String(recording.minute || 0).padStart(2, "0");
  return `${date} ${hour}:${minute}`;
}

function waveformHeights(seedText, count = 38) {
  let seed = 0;
  for (const ch of String(seedText)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const heights = [];
  for (let i = 0; i < count; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    heights.push(18 + (seed % 62));
  }
  return heights;
}

function updateWaveformProgress(bars, ratio) {
  const played = Math.floor(Math.max(0, Math.min(1, ratio)) * bars.length);
  bars.forEach((bar, index) => {
    bar.classList.toggle("is-played", index < played);
  });
}

function createRecordingCard(recording) {
  const card = document.createElement("article");
  card.className = "recording-card";

  const audio = new Audio(apiUrl(recording.audio_url));
  audio.preload = "none";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "recording-play";
  button.textContent = "▶";
  button.setAttribute("aria-label", `Play ${recording.filename}`);

  const body = document.createElement("div");
  body.className = "recording-body";

  const top = document.createElement("div");
  top.className = "recording-topline";
  const name = document.createElement("strong");
  name.textContent = recording.filename;
  const meta = document.createElement("span");
  const confidence = recording.max_confidence == null
    ? ""
    : ` · max ${Math.round(Number(recording.max_confidence) * 100)}%`;
  meta.textContent = `${formatRecordingDate(recording)} · ${Number(recording.detection_count || 0).toLocaleString()} detections${confidence}`;
  top.append(name, meta);

  const species = Array.isArray(recording.species) ? recording.species : [];
  const speciesLine = document.createElement("div");
  speciesLine.className = "recording-species";
  species.forEach((item) => {
    const label = item.common_name || item.scientific_name;
    if (!label) return;
    const chip = document.createElement("span");
    chip.textContent = label;
    speciesLine.append(chip);
  });

  const waveform = document.createElement("div");
  waveform.className = "recording-waveform";
  const bars = waveformHeights(`${recording.audio_id}:${recording.filename}`).map((height) => {
    const bar = document.createElement("span");
    bar.style.height = `${height}%`;
    waveform.append(bar);
    return bar;
  });

  const times = document.createElement("div");
  times.className = "recording-times";
  const current = document.createElement("span");
  current.textContent = "0:00";
  const duration = document.createElement("span");
  duration.textContent = formatDuration(recording.duration_seconds);
  times.append(current, duration);

  button.addEventListener("click", async () => {
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (activeAudio && activeAudio !== audio) activeAudio.pause();
    activeAudio = audio;
    try {
      await audio.play();
    } catch (error) {
      console.error(error);
      button.textContent = "▶";
    }
  });

  audio.addEventListener("play", () => {
    button.textContent = "Ⅱ";
    button.setAttribute("aria-label", `Pause ${recording.filename}`);
    card.classList.add("is-playing");
  });
  audio.addEventListener("pause", () => {
    button.textContent = "▶";
    button.setAttribute("aria-label", `Play ${recording.filename}`);
    card.classList.remove("is-playing");
  });
  audio.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(audio.duration)) duration.textContent = formatDuration(audio.duration);
  });
  audio.addEventListener("timeupdate", () => {
    current.textContent = formatDuration(audio.currentTime);
    const length = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : Number(recording.duration_seconds || 0);
    updateWaveformProgress(bars, length > 0 ? audio.currentTime / length : 0);
  });
  audio.addEventListener("ended", () => {
    updateWaveformProgress(bars, 0);
    current.textContent = "0:00";
  });

  body.append(top);
  if (speciesLine.childElementCount) body.append(speciesLine);
  body.append(waveform, times);
  card.append(button, body);
  return card;
}

async function renderRecordingsBrowser(container, spotId, speciesId = null, dates = {}, options = {}) {
  const panel = document.createElement("section");
  panel.className = "recordings-panel";
  const header = document.createElement("div");
  header.className = "recordings-header";
  const title = document.createElement("h3");
  title.className = "detail-subheading";
  title.textContent = options.title || "Recordings with this bird";
  const counter = document.createElement("span");
  counter.className = "recordings-count";
  header.append(title, counter);

  const list = document.createElement("div");
  list.className = "recordings-list";
  const pager = document.createElement("div");
  pager.className = "recordings-pager";
  panel.append(header, list, pager);
  container.append(panel);

  const state = { page: 1, limit: 10 };

  const load = async (page) => {
    state.page = page;
    list.textContent = "Loading recordings...";
    pager.replaceChildren();
    try {
      const request = {
        ...dates,
        page: state.page,
        limit: state.limit,
      };
      const data = speciesId == null
        ? await dashboardService.listSpotRecordings(spotId, request)
        : await dashboardService.listSpotSpeciesRecordings(spotId, speciesId, request);
      counter.textContent = `${Number(data.total || 0).toLocaleString()} total`;
      list.replaceChildren();
      if (!data.items?.length) {
        const empty = document.createElement("p");
        empty.className = "recordings-empty";
        empty.textContent = options.emptyText || "No playable public recordings are indexed for this selection.";
        list.append(empty);
      } else {
        data.items.forEach((recording) => list.append(createRecordingCard(recording)));
      }

      const previous = document.createElement("button");
      previous.type = "button";
      previous.textContent = "Previous";
      previous.disabled = !data.has_previous;
      previous.addEventListener("click", () => load(state.page - 1));

      const pageLabel = document.createElement("span");
      const totalPages = Math.max(1, Math.ceil(Number(data.total || 0) / state.limit));
      pageLabel.textContent = `Page ${state.page} of ${totalPages}`;

      const next = document.createElement("button");
      next.type = "button";
      next.textContent = "Next";
      next.disabled = !data.has_next;
      next.addEventListener("click", () => load(state.page + 1));
      pager.append(previous, pageLabel, next);
    } catch (error) {
      console.error(error);
      counter.textContent = "";
      list.textContent = "Unable to load recordings for this bird and spot.";
    }
  };

  await load(1);
}

async function renderSpotSpeciesSummary(data, dates = {}) {
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

  if (observation.snippet && observation.snippet.url) {
    const playerCard = document.createElement("div");
    playerCard.className = "species-snippet-banner";
    const header = document.createElement("div");
    header.className = "snippet-banner-header";
    const title = document.createElement("strong");
    title.textContent = "Representative focal call (9s audio clip)";
    header.append(title);
    const player = createSnippetPlayer(observation.snippet, {
      label: "Play Call (9s)",
      subtitle: `${spot.name} · highest confidence detection`,
    });
    if (player) {
      playerCard.append(header, player);
      elements.detailsContent.append(playerCard);
    }
  }

  if (observation.hourly_counts?.length && observation.hourly_counts.some((c) => c > 0)) {
    appendSubheading(elements.detailsContent, "Diurnal soundscape activity");
    elements.detailsContent.append(renderDiurnalActivityCard(observation.hourly_counts, "Species calling activity across the day"));
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

  await renderRecordingsBrowser(elements.detailsContent, spot.id, species.id, dates);

  if (jobs.length) {
    appendSubheading(elements.detailsContent, "Analysis jobs");
    elements.detailsContent.append(createDataTable([
      { key: "job_id", label: "Job ID" },
      { key: "input_file", label: "Input file", render: (value, row) => value || fileNameFromUrl(row.input_url, "Input dataset") },
      { key: "input_url", label: "Input URL", render: (url) => optionalUrlCell(url) },
      { key: "output_file", label: "Output file", render: (value, row) => value || fileNameFromUrl(row.output_url, "Output file") },
      { key: "output_url", label: "Output URL", render: (url) => optionalUrlCell(url) },
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
      const dates = selectedDates();
      const summary = await dashboardService.getSpotSpeciesSummary(
        spotId,
        selectedSpecies.id,
        dates,
      );
      await renderSpotSpeciesSummary(summary, dates);
    } else {
      const dates = selectedDates();
      await renderSpotSummary(await dashboardService.getSpotSummary(spotId), dates);
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

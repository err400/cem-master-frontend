// The front page. An overlay over the workspace, not a separate route: the map
// underneath is rendered from the first frame so Leaflet sizes itself
// correctly, and the landing simply covers it until "Get started".
//
// URL contract:  /        front page
//                /#map    the dashboard
//                /#home   front page again (the brand link)
// The hash is the whole router, so the back button and deep links both work
// without touching nginx.

import { autoOpenHelpGuideOnce } from "./HelpGuide.js";

const HIDE_MS = 420; // matches .landing transition in style.css

function headerHeight() {
  const header = document.querySelector(".site-header");
  return header ? header.getBoundingClientRect().height : 70;
}

function wantsMap() {
  return window.location.hash === "#map";
}

export function initLanding() {
  const landing = document.querySelector("#landing");
  const workspace = document.querySelector(".workspace");
  const getStarted = document.querySelector("#get-started");
  if (!landing || !workspace || !getStarted) return;

  // The overlay starts just below the header, whatever height the header is.
  const syncTop = () => landing.style.setProperty("--header-h", `${headerHeight()}px`);
  syncTop();
  window.addEventListener("resize", syncTop);

  let firstEntry = true;

  const showMap = () => {
    if (landing.hidden) return;
    landing.classList.add("is-leaving");
    workspace.removeAttribute("aria-hidden");
    setTimeout(() => {
      landing.hidden = true;
      landing.classList.remove("is-leaving");
      // Leaflet only listens for window resize; nudge it in case the viewport
      // changed while it was covered.
      window.dispatchEvent(new Event("resize"));
      if (firstEntry) {
        firstEntry = false;
        autoOpenHelpGuideOnce();
      }
    }, HIDE_MS);
  };

  const showLanding = () => {
    if (!landing.hidden) return;
    landing.hidden = false;
    workspace.setAttribute("aria-hidden", "true");
    landing.scrollTop = 0;
  };

  const route = () => (wantsMap() ? showMap() : showLanding());

  getStarted.addEventListener("click", (event) => {
    event.preventDefault();
    if (window.location.hash === "#map") showMap();
    else window.location.hash = "map"; // fires hashchange -> route()
  });

  window.addEventListener("hashchange", route);

  // Initial state, with no transition: a deep link to #map must not flash the
  // front page first.
  if (wantsMap()) {
    landing.hidden = true;
    firstEntry = false;
    autoOpenHelpGuideOnce(); // a deep link skips the front page, not the guide
  } else {
    workspace.setAttribute("aria-hidden", "true");
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";
const PLATE = { w: 440, h: 380, padX: 64, padTop: 44, padBottom: 44 };

function svgEl(name, attrs) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

function fmtLat(v) { return `${Math.abs(v).toFixed(4)}°${v < 0 ? "S" : "N"}`; }
function fmtLon(v) { return `${Math.abs(v).toFixed(4)}°${v < 0 ? "W" : "E"}`; }

/**
 * Draw the real network onto the plate.
 *
 * Takes the same GeoJSON features the map uses. Positions are the spots'
 * true coordinates scaled into the plate; halo radius follows species count;
 * the three richest spots get the "listening" rings; axis ticks are the real
 * bounding box. So the number of dots is the number of public spots, and
 * nothing here is drawn by hand.
 */
export function renderLandingPlate(features = []) {
  const svg = document.querySelector("#landing-plate-svg");
  if (!svg) return;
  const halos = svg.querySelector(".plate-halos");
  const rings = svg.querySelector(".plate-rings");
  const spots = svg.querySelector(".plate-spots");
  const labels = svg.querySelector(".plate-labels");
  const axis = svg.querySelector(".plate-axis");
  const empty = svg.querySelector(".plate-empty");
  [halos, rings, spots, labels, axis].forEach((g) => g && g.replaceChildren());

  const points = features
    .map((f) => {
      const [lon, lat] = f?.geometry?.coordinates || [];
      const p = f?.properties || {};
      return Number.isFinite(lon) && Number.isFinite(lat)
        ? { lon, lat, name: p.name || "", species: Number(p.species_count || 0) }
        : null;
    })
    .filter(Boolean);

  if (!points.length) {
    if (empty) { empty.textContent = "no public spots yet"; empty.removeAttribute("hidden"); }
    return;
  }
  if (empty) empty.setAttribute("hidden", "");

  // Bounding box with a little breathing room, and a floor on the span so a
  // single spot (or two very close ones) does not collapse to a point.
  let minLon = Math.min(...points.map((p) => p.lon));
  let maxLon = Math.max(...points.map((p) => p.lon));
  let minLat = Math.min(...points.map((p) => p.lat));
  let maxLat = Math.max(...points.map((p) => p.lat));
  const MIN_SPAN = 0.002; // ~200 m
  if (maxLon - minLon < MIN_SPAN) { const c = (maxLon + minLon) / 2; minLon = c - MIN_SPAN / 2; maxLon = c + MIN_SPAN / 2; }
  if (maxLat - minLat < MIN_SPAN) { const c = (maxLat + minLat) / 2; minLat = c - MIN_SPAN / 2; maxLat = c + MIN_SPAN / 2; }

  const innerW = PLATE.w - PLATE.padX * 2;
  const innerH = PLATE.h - PLATE.padTop - PLATE.padBottom;
  const x = (lon) => PLATE.padX + ((lon - minLon) / (maxLon - minLon)) * innerW;
  const y = (lat) => PLATE.padTop + (1 - (lat - minLat) / (maxLat - minLat)) * innerH;

  const maxSpecies = Math.max(1, ...points.map((p) => p.species));
  const haloR = (n) => 14 + Math.sqrt(n / maxSpecies) * 44;
  const dotR = (n) => 4.5 + (n / maxSpecies) * 3.5;

  const byRichness = [...points].sort((a, b) => b.species - a.species);
  const ringed = new Set(byRichness.slice(0, 3));

  points.forEach((p) => {
    const cx = x(p.lon), cy = y(p.lat);
    if (p.species > 0) halos.append(svgEl("circle", { cx, cy, r: haloR(p.species) }));
    spots.append(svgEl("circle", {
      cx, cy, r: dotR(p.species),
      fill: p.species > 0 ? "var(--forest)" : "var(--amber)",
    }));
    if (ringed.has(p) && p.species > 0) {
      const i = [...ringed].indexOf(p);
      rings.append(svgEl("circle", { class: `ring${i ? ` ring--${i + 1}` : ""}`, cx, cy, r: 12 }));
    }
    if (p.name) {
      labels.append(Object.assign(svgEl("text", { x: cx + dotR(p.species) + 5, y: cy + 3 }), { textContent: p.name }));
    }
  });

  // Four latitude ticks down the left, three longitude ticks along the bottom.
  [0, 1 / 3, 2 / 3, 1].forEach((t) => {
    const lat = maxLat - t * (maxLat - minLat);
    axis.append(Object.assign(svgEl("text", { x: 6, y: y(lat) + 3 }), { textContent: fmtLat(lat) }));
  });
  [0, 0.5, 1].forEach((t) => {
    const lon = minLon + t * (maxLon - minLon);
    const anchor = t === 0 ? "start" : t === 1 ? "end" : "middle";
    axis.append(Object.assign(svgEl("text", { x: x(lon), y: PLATE.h - 8, "text-anchor": anchor }), { textContent: fmtLon(lon) }));
  });
}

/** Fill the plate's corner tags once the dashboard has real numbers. */
export function setLandingStats({ spots, species } = {}) {
  const spotEl = document.querySelector("#landing-stat-spots");
  const speciesEl = document.querySelector("#landing-stat-species");
  if (spotEl && Number.isFinite(spots)) spotEl.textContent = spots.toLocaleString();
  if (speciesEl && Number.isFinite(species)) speciesEl.textContent = species.toLocaleString();
}

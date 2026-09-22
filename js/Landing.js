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

/** Fill the plate's corner tags once the dashboard has real numbers. */
export function setLandingStats({ spots, species } = {}) {
  const spotEl = document.querySelector("#landing-stat-spots");
  const speciesEl = document.querySelector("#landing-stat-species");
  if (spotEl && Number.isFinite(spots)) spotEl.textContent = spots.toLocaleString();
  if (speciesEl && Number.isFinite(species)) speciesEl.textContent = species.toLocaleString();
}

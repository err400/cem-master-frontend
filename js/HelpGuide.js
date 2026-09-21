// The field guide: an in-page user manual written the way a naturalist keeps a
// notebook. Every entry is a thing you can see on the page, what it is, and the
// one thing to do with it. Nothing here is a tutorial; the page is the tutorial.
//
// Deliberately content-first: the entries are data, the panel is dumb. Edit the
// ENTRIES array to change the manual; nothing else needs to move.

const STORAGE_KEY = "cem.master.fieldGuideSeen";

// Glyphs reuse the ones already on the page so the guide reads as part of the
// map, not a help system bolted onto it.
const ENTRIES = [
  {
    mark: "⌖",
    title: "The map",
    what: "Every pin is a monitoring spot: a place where a recorder listened.",
    how: "Click a pin. Its notebook page opens below the map. Numbers on a pin are spots clustered together; zoom in to split them.",
  },
  {
    mark: "◉",
    title: "Find a bird",
    what: "Search by common or scientific name. The map narrows to the spots where that bird was heard.",
    how: "Start typing for suggestions. The sidebar shows the bird, its best recording, and where it was most active. “Show all spots” clears it.",
  },
  {
    mark: "⌁",
    title: "Detection date",
    what: "An optional window. Counts and rankings refresh to only what was heard between the two dates.",
    how: "Leave both blank for all time. The window follows you from bird to bird until you clear it.",
  },
  {
    mark: "❧",
    title: "A spot’s page",
    what: "Species richness, a bird inventory with occurrence dates, playable recordings, and the analysis runs that produced the data.",
    how: "Click a bird in the inventory to open its own page for this spot: activity by hour, by day, confidence, and its call.",
  },
  {
    mark: "▶",
    title: "Play Call (9 s)",
    what: "A bird’s single best moment at a spot: the highest-confidence detection, with three seconds of context either side.",
    how: "Press play. Not every bird has one; a clip only exists once an analysis has been re-run since the feature landed.",
  },
  {
    mark: "%",
    title: "Reading the numbers",
    what: "Confidence is the model’s certainty, not the bird’s loudness. A spot’s detection floor is the threshold below which detections were never recorded.",
    how: "Compare spots with the same floor. A lower floor means noisier data, not more birds.",
  },
  // Deliberately no entry about withheld species. The public page does not
  // announce that anything is left out.
  {
    mark: "↗",
    title: "Do Your Own CEM",
    what: "The link in the header opens the compute page, where recordings are uploaded, analysed and published to this map.",
    how: "Projects appear here only after their owner makes them public.",
  },
];

function renderEntries(list) {
  list.replaceChildren();
  ENTRIES.forEach((entry, index) => {
    const li = document.createElement("li");
    li.className = "help-entry";
    li.style.setProperty("--i", String(index));

    const mark = document.createElement("span");
    mark.className = "help-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = entry.mark;

    const body = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = entry.title;
    const what = document.createElement("p");
    what.className = "help-what";
    what.textContent = entry.what;
    const how = document.createElement("p");
    how.className = "help-how";
    how.textContent = entry.how;

    body.append(title, what, how);
    li.append(mark, body);
    list.append(li);
  });
}

function seenBefore() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true; // No storage means no way to avoid nagging; default to quiet.
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* Private mode or blocked storage: the guide just reopens next visit. */
  }
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function initHelpGuide() {
  const guide = document.querySelector("#help-guide");
  const toggle = document.querySelector("#help-toggle");
  const close = document.querySelector("#help-close");
  const backdrop = document.querySelector("#help-backdrop");
  const list = document.querySelector("#help-entries");
  if (!guide || !toggle || !close || !backdrop || !list) return;

  renderEntries(list);

  let lastFocus = null;

  const open = () => {
    if (!guide.hidden) return;
    lastFocus = document.activeElement;
    guide.hidden = false;
    backdrop.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    // Next frame so the transition runs from the hidden state.
    requestAnimationFrame(() => guide.classList.add("is-open"));
    close.focus();
    markSeen();
  };

  const shut = () => {
    if (guide.hidden) return;
    guide.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
    const finish = () => {
      guide.hidden = true;
      guide.removeEventListener("transitionend", finish);
    };
    guide.addEventListener("transitionend", finish);
    // Belt and braces: if the transition never fires (reduced motion), hide anyway.
    setTimeout(finish, 320);
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  };

  toggle.addEventListener("click", () => (guide.hidden ? open() : shut()));
  close.addEventListener("click", shut);
  backdrop.addEventListener("click", shut);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !guide.hidden) {
      shut();
      return;
    }
    if (event.key === "?" && !isTypingTarget(event.target)) {
      event.preventDefault();
      guide.hidden ? open() : shut();
    }
  });

  // A first-time visitor gets the guide once. After that it waits to be asked.
  if (!seenBefore()) {
    setTimeout(open, 600);
  }
}

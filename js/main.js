import { MapManager } from "./features/MapManager.js";
import { SpotsService } from "./services/SpotsService.js";

const config = window.CEM_MASTER_CONFIG || {};
const statusElement = document.querySelector("#status");

function setStatus(message, type = "info") {
  statusElement.textContent = message;
  statusElement.className = `status status--${type}`;
  statusElement.hidden = false;
}

function clearStatus() {
  statusElement.hidden = true;
}

async function bootstrap() {
  setStatus("Loading public monitoring spots...", "loading");

  try {
    const mapManager = new MapManager({ mapElementId: "map" });
    const spotsService = new SpotsService({
      apiBaseUrl: config.API_BASE_URL || window.location.origin,
    });

    const spots = await spotsService.listSpots();
    mapManager.renderSpots(spots);

    if (spots.features.length === 0) {
      setStatus("No public monitoring spots available", "empty");
      return;
    }

    clearStatus();
  } catch (error) {
    console.error(error);
    setStatus("Unable to load public monitoring spots. Check that the CEM Master API is running and allows this origin.", "error");
  }
}

window.addEventListener("DOMContentLoaded", bootstrap);

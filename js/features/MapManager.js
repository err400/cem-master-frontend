const DEFAULT_VIEW = {
  center: [22.9734, 78.6569],
  zoom: 5,
  minZoom: 3,
  maxZoom: 19,
};

export class MapManager {
  constructor({ mapElementId }) {
    if (!window.L) {
      throw new Error("Leaflet failed to load");
    }

    this.configureDefaultMarkerIcons();

    this.map = window.L.map(mapElementId, {
      minZoom: DEFAULT_VIEW.minZoom,
      maxZoom: DEFAULT_VIEW.maxZoom,
      zoomControl: false,
    }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);

    window.L.control.zoom({ position: "bottomright" }).addTo(this.map);

    const tileLayer = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: DEFAULT_VIEW.maxZoom,
      attribution: "&copy; OpenStreetMap contributors",
      crossOrigin: true,
      keepBuffer: 4,
      detectRetina: false,
      subdomains: ["a", "b", "c"],
      errorTileUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    }).addTo(this.map);

    tileLayer.on("tileerror", (event) => {
      const tile = event.tile;
      const src = tile?._origSrc || tile?.src;
      if (src && !tile._retried) {
        tile._retried = true;
        setTimeout(() => {
          tile.src = src;
        }, 1500);
      } else {
        console.warn("[MapManager] Tile failed to load after retry:", event?.coords);
      }
    });

    this.markerLayer = window.L.featureGroup().addTo(this.map);

    window.addEventListener("resize", () => {
      window.requestAnimationFrame(() => this.map.invalidateSize());
    });
  }

  configureDefaultMarkerIcons() {
    window.L.Icon.Default.imagePath = "";
    window.L.Icon.Default.mergeOptions({
      imagePath: "",
      iconUrl: "./leaflet/images/marker-icon.png",
      iconRetinaUrl: "./leaflet/images/marker-icon-2x.png",
      shadowUrl: "./leaflet/images/marker-shadow.png",
    });
  }

  renderSpots(featureCollection) {
    this.markerLayer.clearLayers();

    featureCollection.features.forEach((feature) => {
      const marker = this.createMarker(feature);
      if (marker) {
        marker.addTo(this.markerLayer);
      }
    });

    if (this.markerLayer.getLayers().length > 0) {
      this.map.fitBounds(this.markerLayer.getBounds(), {
        padding: [32, 32],
        maxZoom: 14,
      });
      return;
    }

    this.map.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
  }

  createMarker(feature) {
    const coordinates = feature?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return null;
    }

    const [longitude, latitude] = coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    const properties = feature.properties || {};
    const title = properties.name || "Monitoring spot";
    const description = properties.description || "No description available.";

    return window.L.marker([latitude, longitude]).bindPopup(this.popupTemplate(title, description));
  }

  popupTemplate(title, description) {
    return `
      <div class="master-popup">
        <p class="popup-title">${this.escapeHtml(title)}</p>
        <p class="popup-description">${this.escapeHtml(description)}</p>
      </div>
    `;
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

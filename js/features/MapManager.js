const DEFAULT_VIEW = {
  center: [22.9734, 78.6569],
  zoom: 5,
  minZoom: 3,
  maxZoom: 19,
};

export class MapManager {
  constructor({ mapElementId, onSpotSelected = () => {} }) {
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

    this.onSpotSelected = onSpotSelected;
    this.markersBySpotId = new Map();
    this.markerLayer = typeof window.L.markerClusterGroup === "function"
      ? window.L.markerClusterGroup({
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          removeOutsideVisibleBounds: true,
          maxClusterRadius: 55,
        }).addTo(this.map)
      : window.L.featureGroup().addTo(this.map);

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
    this.markersBySpotId.clear();

    const detectionCounts = featureCollection.features
      .map((feature) => Number(feature?.properties?.detection_count))
      .filter((count) => Number.isFinite(count));
    this.maximumDetectionCount = Math.max(...detectionCounts, 1);

    featureCollection.features.forEach((feature) => {
      const marker = this.createMarker(feature);
      if (marker) {
        marker.addTo(this.markerLayer);
        this.markersBySpotId.set(String(feature.properties?.id), marker);
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

    const detectionCount = Number(properties.detection_count);
    const hasDetectionCount = Number.isFinite(detectionCount);
    const intensity = hasDetectionCount ? detectionCount / this.maximumDetectionCount : 0;
    const marker = hasDetectionCount
      ? window.L.circleMarker([latitude, longitude], {
          radius: 8 + (Math.sqrt(intensity) * 12),
          color: "#fffdf7",
          weight: 2,
          fillColor: intensity > 0.66 ? "#173f2b" : intensity > 0.33 ? "#4f7b4c" : "#88a96c",
          fillOpacity: 0.9,
        })
      : window.L.marker([latitude, longitude], {
          title,
          alt: `${title} monitoring spot`,
          icon: window.L.divIcon({
            className: "cem-marker-icon",
            html: "<span aria-hidden=\"true\">♪</span>",
            iconSize: [34, 42],
            iconAnchor: [17, 40],
            popupAnchor: [0, -36],
          }),
        });

    marker.bindPopup(this.popupTemplate(title, description, properties));

    marker.on("click", () => this.onSpotSelected(feature));
    return marker;
  }

  focusFeature(feature) {
    const marker = this.markersBySpotId.get(String(feature?.properties?.id));
    if (!marker) return;
    const reveal = () => {
      this.map.setView(marker.getLatLng(), Math.max(this.map.getZoom(), 14));
      marker.openPopup();
    };
    if (typeof this.markerLayer.zoomToShowLayer === "function") {
      this.markerLayer.zoomToShowLayer(marker, reveal);
    } else {
      reveal();
    }
  }

  popupTemplate(title, description, properties = {}) {
    const detectionLine = Number.isFinite(Number(properties.detection_count))
      ? `<p class="popup-description"><strong>${Number(properties.detection_count).toLocaleString()}</strong> detections · rank #${this.escapeHtml(properties.activity_rank || "—")}</p>`
      : `<p class="popup-description"><strong>${this.escapeHtml(properties.species_count || 0)}</strong> indexed species</p>`;
    return `
      <div class="master-popup">
        <p class="popup-title">${this.escapeHtml(title)}</p>
        <p class="popup-description">${this.escapeHtml(description)}</p>
        ${detectionLine}
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

export class SpotsService {
  constructor({ apiBaseUrl }) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  }

  async listSpots({ speciesId = null } = {}) {
    const query = speciesId ? `?species_id=${encodeURIComponent(speciesId)}` : "";
    const response = await fetch(`${this.apiBaseUrl}/api/v1/spots${query}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/geo+json, application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Spot catalogue request failed with ${response.status}`);
    }

    const data = await response.json();
    if (!this.isFeatureCollection(data)) {
      throw new Error("Spot catalogue response was not a GeoJSON FeatureCollection");
    }

    return data;
  }

  isFeatureCollection(data) {
    return data && data.type === "FeatureCollection" && Array.isArray(data.features);
  }
}

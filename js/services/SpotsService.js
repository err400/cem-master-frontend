export class SpotsService {
  constructor({ apiBaseUrl }) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  }

  async listSpots({
    speciesId = null,
    migrationClass = "",
    startDate = "",
    endDate = "",
  } = {}) {
    const query = new URLSearchParams();
    if (speciesId) query.set("species_id", speciesId);
    if (migrationClass.trim()) query.set("migration_class", migrationClass.trim());
    if (startDate) query.set("start_date", startDate);
    if (endDate) query.set("end_date", endDate);
    const suffix = query.size ? `?${query}` : "";
    const response = await fetch(`${this.apiBaseUrl}/api/v1/spots${suffix}`, {
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

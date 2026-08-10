export class DashboardService {
  constructor({ apiBaseUrl }) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  }

  async request(path) {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail || `Dashboard request failed with ${response.status}`);
    }
    return response.json();
  }

  async listSpecies(search = "") {
    const query = new URLSearchParams({ limit: "30" });
    if (search.trim()) query.set("search", search.trim());
    const data = await this.request(`/api/v1/species?${query}`);
    return data.items || [];
  }

  getSpotSummary(spotId) {
    return this.request(`/api/v1/spots/${encodeURIComponent(spotId)}/summary`);
  }

  getSpotSpeciesSummary(spotId, speciesId) {
    return this.request(
      `/api/v1/spots/${encodeURIComponent(spotId)}/species/${encodeURIComponent(speciesId)}`,
    );
  }
}

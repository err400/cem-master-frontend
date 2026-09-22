(function () {
  window.CEM_MASTER_CONFIG = window.CEM_MASTER_CONFIG || {
    // Default API base URL (FastAPI serves both UI and /api/v1 from same origin).
    // In production/cluster, the backend dynamically generates /js/config.js from API_BASE_URL.
    API_BASE_URL: window.location.origin,
    // External compute website used by the "Do Your Own CEM" button.
    COMPUTE_FRONTEND_URL: "http://127.0.0.1:8080/",
  };
})();


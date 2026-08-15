(function () {
  window.CEM_MASTER_CONFIG = {
    // Nginx forwards same-origin /api requests to the backend container.
    API_BASE_URL: window.location.origin,
  };
})();

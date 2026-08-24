(function () {
  window.CEM_MASTER_CONFIG = {
    // Nginx forwards same-origin /api requests to the backend container.
    API_BASE_URL: window.location.origin,
    // Local compute website used by the "Do Your Own CEM" button.
    COMPUTE_FRONTEND_URL: "http://127.0.0.1:8080/",
  };
})();

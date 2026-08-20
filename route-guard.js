const routeConfig = window.EPI_CONFIG?.routes ?? { home: true, maps: true };
const currentPage = window.location.pathname.split("/").pop() || "index.html";
const fallbackPage = routeConfig.maps ? "maps.html" : "index.html";

if (
  currentPage === "index.html" &&
  !routeConfig.home &&
  fallbackPage !== "index.html"
) {
  window.location.replace(fallbackPage);
}

if (currentPage === "maps.html" && !routeConfig.maps && routeConfig.home) {
  window.location.replace("index.html");
}

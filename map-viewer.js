const mapData = {
  command: {
    title: "Command Deck",
    image: "maps/megaships/decks/Ops-Megaship_Command.svg",
    description: "Command Center, Briefing Room, and Server Rooms",
  },
  cargo: {
    title: "Cargo Deck",
    image: "maps/megaships/decks/Ops-Megaship_Cargo.svg",
    description: "Cargo Bays, Cargo Depot, and assorted storage",
  },
  engineering: {
    title: "Engineering Deck",
    image: "maps/megaships/decks/Ops-Megaship_Engineering.svg",
    description: "Power Plant and Breaker Rooms",
  },
  habitat: {
    title: "Habitat Deck",
    image: "maps/megaships/decks/Ops-Megaship_Habitat.svg",
    description: "Living quarters, recreation, and Mess Hall",
  },
};

if (!window.EPI_CONFIG?.routes?.home) {
  document
    .querySelectorAll('[data-route-link="home"]')
    .forEach((link) => link.remove());
}

const aboutDialog = document.querySelector("#about-dialog");
document
  .querySelector("#open-about")
  .addEventListener("click", () => aboutDialog.showModal());
document
  .querySelector("#close-about")
  .addEventListener("click", () => aboutDialog.close());
aboutDialog.addEventListener("click", (event) => {
  if (event.target === aboutDialog) aboutDialog.close();
});

const layerNames = [
  "architecture",
  "f0",
  "f1",
  "e1",
  "f2",
  "e2",
  "f3",
  "e3",
  "consumables",
  "energy-ports",
  "ammo-boxes",
  "batteries",
  "grenade-cases",
  "medkits",
  "text",
  "labels",
  "headers",
  "footers",
];
const layerChildren = {
  architecture: ["f0", "f1", "e1", "f2", "e2", "f3", "e3"],
  consumables: [
    "energy-ports",
    "ammo-boxes",
    "batteries",
    "grenade-cases",
    "medkits",
  ],
  text: ["labels", "headers", "footers"],
};

const viewport = document.querySelector("#map-viewport");
const image = document.querySelector("#map-image");
const title = document.querySelector("#map-title");
const description = document.querySelector("#map-description");
const zoomLevel = document.querySelector("#zoom-level");
const reticle = document.querySelector(".map-crosshair");
const mapApp = document.querySelector(".map-app");
const sidebarContent = document.querySelector("#map-sidebar-content");
const sidebarToggle = document.querySelector("#map-sidebar-toggle");
const layerControls = document.querySelector(".layer-controls");
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let offsetXRatio = 0;
let offsetYRatio = 0;
let mapWidth = 1;
let mapHeight = 1;
let dragStart;
let pinchStart;
let activeMap = "habitat";
let orientation = "portrait";
let scrollbarHideTimer;
let mapPointFrame;
let pinnedMapPoint;
const layerVisibility = Object.fromEntries(
  layerNames.map((layerName) => [
    layerName,
    !["headers", "footers"].includes(layerName),
  ]),
);

function getMapPointAtReticle() {
  const svg = image.querySelector("svg");
  const matrix = svg?.getScreenCTM();
  if (!svg || !matrix) return null;

  const reticleBox = reticle.getBoundingClientRect();
  const screenPoint = svg.createSVGPoint();
  screenPoint.x = reticleBox.left + reticleBox.width / 2;
  screenPoint.y = reticleBox.top + reticleBox.height / 2;
  return { point: screenPoint.matrixTransform(matrix.inverse()), svg };
}

function restoreMapPointAtReticle(savedMapPoint) {
  if (!savedMapPoint?.svg.isConnected) return;

  const previousTransition = image.style.transition;
  image.style.transition = "none";
  image.getBoundingClientRect();

  const matrix = savedMapPoint.svg.getScreenCTM();
  if (matrix) {
    const screenPoint = savedMapPoint.point.matrixTransform(matrix);
    const reticleBox = reticle.getBoundingClientRect();
    offsetX += reticleBox.left + reticleBox.width / 2 - screenPoint.x;
    offsetY += reticleBox.top + reticleBox.height / 2 - screenPoint.y;
    renderMap();
    image.getBoundingClientRect();
  }

  image.style.transition = previousTransition;
}

function rememberMapPointAtReticle() {
  window.cancelAnimationFrame(mapPointFrame);
  mapPointFrame = window.requestAnimationFrame(() => {
    pinnedMapPoint = getMapPointAtReticle();
  });
}

function setSidebarExpanded(expanded) {
  const mapPoint = getMapPointAtReticle();
  const action = expanded ? "Collapse" : "Expand";
  sidebarContent.hidden = !expanded;
  sidebarToggle.setAttribute("aria-expanded", String(expanded));
  sidebarToggle.setAttribute("aria-label", `${action} layers sidebar`);
  sidebarToggle.title = `${action} layers sidebar`;
  mapApp.classList.toggle("is-sidebar-collapsed", !expanded);
  syncOffsetsToMapSize();
  restoreMapPointAtReticle(mapPoint);
}

sidebarToggle.addEventListener("click", () => {
  setSidebarExpanded(sidebarToggle.getAttribute("aria-expanded") !== "true");
});

setSidebarExpanded(!window.matchMedia("(max-width: 720px)").matches);

new ResizeObserver(() => {
  if (!pinnedMapPoint) return;
  window.cancelAnimationFrame(mapPointFrame);
  syncOffsetsToMapSize();
  restoreMapPointAtReticle(pinnedMapPoint);
}).observe(viewport);

image.addEventListener("transitionend", rememberMapPointAtReticle);

layerControls.addEventListener(
  "scroll",
  () => {
    layerControls.classList.add("is-scrolling");
    window.clearTimeout(scrollbarHideTimer);
    scrollbarHideTimer = window.setTimeout(() => {
      layerControls.classList.remove("is-scrolling");
    }, 500);
  },
  { passive: true },
);

const uprightLayerNames = [
  "labels",
  "headers",
  "footers",
  "energy-ports",
  "ammo-boxes",
  "batteries",
  "grenade-cases",
  "medkits",
];

const overlapAvoidanceLayerNames = ["labels", "headers", "footers"];

function syncOffsetsToMapSize() {
  const styles = getComputedStyle(image);
  mapWidth = Number.parseFloat(styles.width) || 1;
  mapHeight = Number.parseFloat(styles.height) || 1;
  offsetX = offsetXRatio * mapWidth;
  offsetY = offsetYRatio * mapHeight;
}

function renderMap() {
  const rotation = orientation === "landscape" ? " rotate(90deg)" : "";
  offsetXRatio = offsetX / mapWidth;
  offsetYRatio = offsetY / mapHeight;
  image.style.transform = `translate(calc(-50% + ${offsetXRatio * 100}%), calc(-50% + ${offsetYRatio * 100}%)) scale(${scale})${rotation}`;
  zoomLevel.textContent = `${Math.round(scale * 100)}%`;
  rememberMapPointAtReticle();
}

function applyLayerVisibility() {
  layerNames.forEach((layerName) => {
    const group = image.querySelector(`#${layerName}_${activeMap}`);
    if (group) {
      const parentName = Object.keys(layerChildren).find((candidate) =>
        layerChildren[candidate].includes(layerName),
      );
      const parentVisible = parentName ? layerVisibility[parentName] : true;
      group.style.display =
        layerVisibility[layerName] && parentVisible ? "" : "none";
    }
  });
}

function getViewBoxCenter(svg) {
  const values = svg.getAttribute("viewBox")?.trim().split(/[ ,]+/).map(Number);
  if (!values || values.length !== 4 || values.some(Number.isNaN))
    return { x: 0, y: 0 };
  const center = { x: values[0] + values[2] / 2, y: values[1] + values[3] / 2 };
  const drawingGroup = [...svg.children].find((child) =>
    child.getAttribute("transform")?.startsWith("matrix("),
  );
  const matrix = drawingGroup
    ?.getAttribute("transform")
    ?.match(/matrix\(([^)]+)\)/)?.[1]
    .split(/[ ,]+/)
    .map(Number);
  if (!matrix || matrix.length !== 6 || !matrix[0] || !matrix[3]) return center;
  return {
    x: (center.x - matrix[4]) / matrix[0],
    y: (center.y - matrix[5]) / matrix[3],
  };
}

function getDrawingScreenScale(svg) {
  const ctm = svg.getScreenCTM();
  const drawingGroup = [...svg.children].find((child) =>
    child.getAttribute("transform")?.startsWith("matrix("),
  );
  const matrix = drawingGroup
    ?.getAttribute("transform")
    ?.match(/matrix\(([^)]+)\)/)?.[1]
    .split(/[ ,]+/)
    .map(Number);
  if (!ctm || !matrix || matrix.length !== 6) return { x: 0.01, y: 0.01 };
  return {
    x: Math.hypot(ctm.a, ctm.b) * Math.abs(matrix[0]),
    y: Math.hypot(ctm.c, ctm.d) * Math.abs(matrix[3]),
  };
}

function centerMap() {
  const svg = image.querySelector("svg");
  const architecture = svg?.querySelector(`#architecture_${activeMap}`);
  if (!svg || !architecture) return;

  const previousTransition = image.style.transition;
  image.style.transition = "none";
  renderMap();
  image.getBoundingClientRect();
  const reticleBox = reticle.getBoundingClientRect();
  const architectureBox = architecture.getBoundingClientRect();
  offsetX +=
    reticleBox.left +
    reticleBox.width / 2 -
    (architectureBox.left + architectureBox.width / 2);
  offsetY +=
    reticleBox.top +
    reticleBox.height / 2 -
    (architectureBox.top + architectureBox.height / 2);
  renderMap();
  image.getBoundingClientRect();
  image.style.transition = previousTransition;
}

function rotateViewAroundCenter(nextOrientation) {
  if (nextOrientation === orientation) return;

  const previousOffsetX = offsetX;
  if (nextOrientation === "landscape") {
    offsetX = -offsetY;
    offsetY = previousOffsetX;
  } else {
    offsetX = offsetY;
    offsetY = -previousOffsetX;
  }
}

function applyOrientation() {
  const svg = image.querySelector("svg");
  if (!svg) return;
  uprightLayerNames.forEach((layerName) => {
    const group = svg.querySelector(`#${layerName}_${activeMap}`);
    if (!group) return;
    group.querySelectorAll(":scope > g").forEach((object) => {
      const baseTransform =
        object.dataset.baseTransform ?? object.getAttribute("transform") ?? "";
      object.dataset.baseTransform = baseTransform;
      object.dataset.uprightOffsetX = "0";
      object.dataset.uprightOffsetY = "0";
      setUprightTransform(object);
    });
  });
  image.classList.toggle("is-landscape", orientation === "landscape");
}

function setUprightTransform(object) {
  const baseTransform = object.dataset.baseTransform ?? "";
  const box = object.getBBox();
  const offsetX = Number(object.dataset.uprightOffsetX ?? 0);
  const offsetY = Number(object.dataset.uprightOffsetY ?? 0);
  const rotation =
    orientation === "landscape"
      ? ` rotate(-90 ${box.x + box.width / 2} ${box.y + box.height / 2})`
      : "";
  object.setAttribute(
    "transform",
    `${baseTransform}${rotation} translate(${offsetX} ${offsetY})`,
  );
}

function avoidUprightOverlaps(svg) {
  const candidates = overlapAvoidanceLayerNames.flatMap((layerName) => {
    const group = svg.querySelector(`#${layerName}_${activeMap}`);
    return group
      ? [...group.querySelectorAll(":scope > g")].map((object) => ({
          group: object,
          box: object.getBoundingClientRect(),
        }))
      : [];
  });
  const placed = [];
  const drawingScale = getDrawingScreenScale(svg);
  candidates.forEach((candidate) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const box = candidate.group.getBoundingClientRect();
      const collision = placed.some(
        (other) =>
          box.left < other.right &&
          box.right > other.left &&
          box.top < other.bottom &&
          box.bottom > other.top,
      );
      if (!collision) break;
      const shift = (box.height + 12) / drawingScale.y;
      if (orientation === "landscape") {
        candidate.group.dataset.uprightOffsetX = String(
          Number(candidate.group.dataset.uprightOffsetX ?? 0) - shift,
        );
      } else {
        candidate.group.dataset.uprightOffsetY = String(
          Number(candidate.group.dataset.uprightOffsetY ?? 0) - shift,
        );
      }
      setUprightTransform(candidate.group);
    }
    const box = candidate.group.getBoundingClientRect();
    placed.push({
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
    });
  });
}

function moveHeadersAndFootersAwayFromArchitecture(svg) {
  const architecture = svg.querySelector(`#architecture_${activeMap}`);
  if (!architecture || architecture.style.display === "none") return;
  const architectureBox = architecture.getBoundingClientRect();
  const drawingScale = getDrawingScreenScale(svg);
  const candidates = ["headers", "footers"].flatMap((layerName) => {
    const group = svg.querySelector(`#${layerName}_${activeMap}`);
    return group ? [...group.querySelectorAll(":scope > g")] : [];
  });

  candidates.forEach((object) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const box = object.getBoundingClientRect();
      const overlaps =
        box.left < architectureBox.right &&
        box.right > architectureBox.left &&
        box.top < architectureBox.bottom &&
        box.bottom > architectureBox.top;
      if (!overlaps) break;

      const escapeMoves = [
        {
          distance: Math.abs(architectureBox.left - box.right),
          x: architectureBox.left - box.right - 12,
          y: 0,
        },
        {
          distance: Math.abs(architectureBox.right - box.left),
          x: architectureBox.right - box.left + 12,
          y: 0,
        },
        {
          distance: Math.abs(architectureBox.top - box.bottom),
          x: 0,
          y: architectureBox.top - box.bottom - 12,
        },
        {
          distance: Math.abs(architectureBox.bottom - box.top),
          x: 0,
          y: architectureBox.bottom - box.top + 12,
        },
      ];
      const move = escapeMoves.sort(
        (first, second) => first.distance - second.distance,
      )[0];
      if (orientation === "landscape") {
        object.dataset.uprightOffsetX = String(
          Number(object.dataset.uprightOffsetX ?? 0) + move.y / drawingScale.x,
        );
        object.dataset.uprightOffsetY = String(
          Number(object.dataset.uprightOffsetY ?? 0) - move.x / drawingScale.y,
        );
      } else {
        object.dataset.uprightOffsetX = String(
          Number(object.dataset.uprightOffsetX ?? 0) + move.x / drawingScale.x,
        );
        object.dataset.uprightOffsetY = String(
          Number(object.dataset.uprightOffsetY ?? 0) + move.y / drawingScale.y,
        );
      }
      setUprightTransform(object);
    }
  });
}

function refreshUprightLayout() {
  renderMap();
  const svg = image.querySelector("svg");
  avoidUprightOverlaps(svg);
  moveHeadersAndFootersAwayFromArchitecture(svg);
}

function updateLayerAvailability() {
  document.querySelectorAll(".layer-toggle").forEach((button) => {
    const layerName = button.dataset.layer;
    button.hidden = !image.querySelector(`#${layerName}_${activeMap}`);
  });

  document.querySelectorAll(".layer-group").forEach((group) => {
    const layerName = group.dataset.layerGroup;
    group.hidden = !image.querySelector(`#${layerName}_${activeMap}`);
  });

  document.querySelectorAll(".layer-subgroup").forEach((subgroup) => {
    const children = subgroup.querySelector(":scope > .layer-children");
    const visibleChildren = children.querySelectorAll(
      ":scope > .layer-toggle:not([hidden])",
    );
    const hasSingleChild = visibleChildren.length === 1;
    subgroup.hidden = visibleChildren.length === 0;
    subgroup.classList.toggle("has-single-child", hasSingleChild);

    if (hasSingleChild) {
      const disclosure = subgroup.querySelector(":scope > .layer-disclosure");
      disclosure.setAttribute("aria-expanded", "true");
      children.hidden = false;
    }
  });
}

async function loadMap(mapKey) {
  const map = mapData[mapKey];
  const response = await fetch(map.image);
  const svgText = await response.text();
  const svg = new DOMParser().parseFromString(
    svgText,
    "image/svg+xml",
  ).documentElement;
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("aria-label", `${map.title} megaship map`);
  svg.setAttribute("draggable", "false");
  const viewBox = svg.viewBox.baseVal;
  image.style.setProperty(
    "--map-aspect-ratio",
    String(viewBox.width / viewBox.height),
  );
  image.replaceChildren(svg);
  image.setAttribute("aria-label", `${map.title} megaship map`);
  activeMap = mapKey;
  updateLayerAvailability();
  applyLayerVisibility();
  applyOrientation();
  syncOffsetsToMapSize();
}

function setZoom(
  nextScale,
  originX = viewport.clientWidth / 2,
  originY = viewport.clientHeight / 2,
) {
  const boundedScale = Math.min(4, Math.max(0.25, nextScale));
  const ratio = boundedScale / scale;
  const centerX = viewport.clientWidth / 2;
  const centerY = viewport.clientHeight / 2;
  offsetX = originX - centerX - (originX - centerX - offsetX) * ratio;
  offsetY = originY - centerY - (originY - centerY - offsetY) * ratio;
  scale = boundedScale;
  renderMap();
}

document.querySelectorAll(".deck-option").forEach((button) => {
  button.addEventListener("click", async () => {
    const map = mapData[button.dataset.map];
    document.querySelectorAll(".deck-option").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("is-active", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    await loadMap(button.dataset.map);
    title.textContent = map.title;
    description.textContent = map.description;
    refreshUprightLayout();
  });
});

document.querySelectorAll(".layer-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const layerName = button.dataset.layer;
    layerVisibility[layerName] = !layerVisibility[layerName];
    button.classList.toggle("is-visible", layerVisibility[layerName]);
    button.setAttribute("aria-pressed", String(layerVisibility[layerName]));
    applyLayerVisibility();
  });
});

document.querySelectorAll(".layer-disclosure").forEach((button) => {
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    document.querySelector(`#${button.getAttribute("aria-controls")}`).hidden =
      expanded;
  });
});

document.querySelector("#show-all-layers").addEventListener("click", () => {
  layerNames.forEach((layerName) => {
    layerVisibility[layerName] = true;
  });
  document.querySelectorAll(".layer-toggle").forEach((button) => {
    button.classList.add("is-visible");
    button.setAttribute("aria-pressed", "true");
  });
  applyLayerVisibility();
});

document.querySelectorAll(".orientation-option").forEach((button) => {
  button.addEventListener("click", () => {
    const nextOrientation = button.dataset.orientation;
    rotateViewAroundCenter(nextOrientation);
    orientation = nextOrientation;
    document.querySelectorAll(".orientation-option").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("is-active", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    applyOrientation();
    syncOffsetsToMapSize();
    refreshUprightLayout();
  });
});

document
  .querySelector("#zoom-in")
  .addEventListener("click", () => setZoom(scale + 0.25));
document
  .querySelector("#zoom-out")
  .addEventListener("click", () => setZoom(scale - 0.25));
document.querySelector("#reset-map").addEventListener("click", () => {
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  centerMap();
});

viewport.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const bounds = viewport.getBoundingClientRect();
    setZoom(
      scale * (event.deltaY < 0 ? 1.1 : 0.9),
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    );
  },
  { passive: false },
);

viewport.addEventListener("dblclick", (event) => {
  const bounds = viewport.getBoundingClientRect();
  offsetX += bounds.left + bounds.width / 2 - event.clientX;
  offsetY += bounds.top + bounds.height / 2 - event.clientY;
  renderMap();
});

viewport.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") return;
  viewport.setPointerCapture(event.pointerId);
  dragStart = { x: event.clientX - offsetX, y: event.clientY - offsetY };
  viewport.classList.add("is-dragging");
});

viewport.addEventListener("pointermove", (event) => {
  if (!dragStart) return;
  offsetX = event.clientX - dragStart.x;
  offsetY = event.clientY - dragStart.y;
  renderMap();
});

viewport.addEventListener("pointerup", () => {
  dragStart = null;
  viewport.classList.remove("is-dragging");
});

viewport.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length === 1) {
      dragStart = {
        x: event.touches[0].clientX - offsetX,
        y: event.touches[0].clientY - offsetY,
      };
      viewport.classList.add("is-dragging");
    } else if (event.touches.length === 2) {
      dragStart = null;
      viewport.classList.remove("is-dragging");
      const bounds = viewport.getBoundingClientRect();
      pinchStart = {
        distance: Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY,
        ),
        scale,
        midX:
          (event.touches[0].clientX + event.touches[1].clientX) / 2 -
          bounds.left,
        midY:
          (event.touches[0].clientY + event.touches[1].clientY) / 2 -
          bounds.top,
      };
    }
  },
  { passive: true },
);

viewport.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
    if (event.touches.length === 1 && dragStart) {
      offsetX = event.touches[0].clientX - dragStart.x;
      offsetY = event.touches[0].clientY - dragStart.y;
      renderMap();
    } else if (event.touches.length === 2 && pinchStart) {
      const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      );
      setZoom(
        pinchStart.scale * (distance / pinchStart.distance),
        pinchStart.midX,
        pinchStart.midY,
      );
    }
  },
  { passive: false },
);

viewport.addEventListener("touchend", () => {
  dragStart = null;
  pinchStart = null;
  viewport.classList.remove("is-dragging");
});
loadMap(activeMap).then(() => {
  centerMap();
  refreshUprightLayout();
});

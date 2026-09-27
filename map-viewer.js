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

const missionControls = document.querySelector("#mission-controls");
const missionSelector = document.querySelector("#mission-selector");
const sidebarStyleButtons = document.querySelectorAll(".sidebar-style-option");
let simplifiedSidebar = localStorage.getItem("simplifiedSidebar") === "true";

function updateSidebarStyleButtons() {
  sidebarStyleButtons.forEach((button) => {
    const selected =
      (button.dataset.sidebarStyle === "simplified") === simplifiedSidebar;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function resetSidebarItemStates() {
  localStorage.removeItem(layerStateStorageKey);
  localStorage.removeItem(disclosureStorageKey);
  Object.keys(layerVisibility).forEach(
    (layerName) => (layerVisibility[layerName] = true),
  );
  operationsLayerVisibility.clear();
  conditionalConsumableState.clear();
  document.querySelectorAll(".layer-toggle[data-layer]").forEach((button) => {
    button.classList.add("is-visible");
    button.setAttribute("aria-pressed", "true");
  });
}

sidebarStyleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const next = button.dataset.sidebarStyle === "simplified";
    if (next === simplifiedSidebar) return;
    simplifiedSidebar = next;
    localStorage.setItem("simplifiedSidebar", String(simplifiedSidebar));
    resetSidebarItemStates();
    updateSidebarStyleButtons();
    applySimplifiedMode();
  });
});
updateSidebarStyleButtons();

let operationsMetadata = null;
fetch("maps/megaships/operations-metadata.json")
  .then((response) => (response.ok ? response.json() : null))
  .then((metadata) => {
    operationsMetadata = metadata;
    if (!metadata && simplifiedSidebar) {
      console.warn(
        "Operations metadata unavailable; falling back to the full sidebar.",
      );
    }
    applySimplifiedMode();
  })
  .catch(() => {
    operationsMetadata = null;
    applySimplifiedMode();
  });

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

const shortcutsDialog = document.querySelector("#shortcuts-dialog");
document
  .querySelector("#open-shortcuts")
  .addEventListener("click", () => shortcutsDialog.showModal());
document
  .querySelector("#close-shortcuts")
  .addEventListener("click", () => shortcutsDialog.close());
shortcutsDialog.addEventListener("click", (event) => {
  if (event.target === shortcutsDialog) shortcutsDialog.close();
});

const layerNames = [
  "architecture",
  "floors",
  "elevated",
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
];
const layerParents = {
  f0: "floors",
  f1: "floors",
  f2: "floors",
  f3: "floors",
  e1: "elevated",
  e2: "elevated",
  e3: "elevated",
  floors: "architecture",
  elevated: "architecture",
  "energy-ports": "consumables",
  "ammo-boxes": "consumables",
  batteries: "consumables",
  "grenade-cases": "consumables",
  medkits: "consumables",
  labels: "text",
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
const operationsPoiTree = document.querySelector("#operations-poi-tree");
const baseMapScale = 1.5;
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
let invertKeyboardPan = true;
let operationsLayers = [];
let selectedMission = null;
const missionStorageKey = "selectedMission";
let conditionalConsumableBindings = [];
let conditionalToggles = [];
const conditionalConsumableState = new Map();
const operationsLayerVisibility = new Map();
const layerVisibility = Object.fromEntries(
  layerNames.map((layerName) => [
    layerName,
    true,
  ]),
);

const layerStateStorageKey = "layerStates";

function persistLayerStates() {
  localStorage.setItem(
    layerStateStorageKey,
    JSON.stringify({
      layers: layerVisibility,
      operations: Object.fromEntries(operationsLayerVisibility),
      conditional: Object.fromEntries(conditionalConsumableState),
    }),
  );
}

function restoreLayerStates() {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(layerStateStorageKey) || "null");
  } catch {
    return;
  }
  if (!stored || typeof stored !== "object") return;
  layerNames.forEach((layerName) => {
    if (typeof stored.layers?.[layerName] === "boolean") {
      layerVisibility[layerName] = stored.layers[layerName];
    }
  });
  Object.entries(stored.operations || {}).forEach(([key, value]) => {
    operationsLayerVisibility.set(key, value === true);
  });
  Object.entries(stored.conditional || {}).forEach(([key, value]) => {
    conditionalConsumableState.set(key, value === true);
  });
}

restoreLayerStates();
document.querySelectorAll(".layer-toggle[data-layer]").forEach((button) => {
  const visible = layerVisibility[button.dataset.layer] !== false;
  button.classList.toggle("is-visible", visible);
  button.setAttribute("aria-pressed", String(visible));
});

const disclosureStorageKey = "disclosureStates";
const disclosureDefaults = new Map();
document.querySelectorAll(".layer-disclosure").forEach((button) => {
  const controlsId = button.getAttribute("aria-controls");
  if (controlsId) {
    disclosureDefaults.set(
      controlsId,
      button.getAttribute("aria-expanded") === "true",
    );
  }
});

function persistDisclosureStates() {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(disclosureStorageKey) || "null");
  } catch {
    stored = null;
  }
  if (!stored || typeof stored !== "object") stored = {};
  document.querySelectorAll(".layer-disclosure").forEach((button) => {
    // Flattened single-child subgroups are force-expanded for display only;
    // never let that transient state overwrite the persisted chevron state.
    if (button.closest(".layer-subgroup.has-single-child")) return;
    const controlsId = button.getAttribute("aria-controls");
    if (controlsId) {
      stored[controlsId] = button.getAttribute("aria-expanded") === "true";
    }
  });
  localStorage.setItem(disclosureStorageKey, JSON.stringify(stored));
}

function getDisclosureDefaultExpanded(button) {
  if (button.dataset.defaultExpanded !== undefined) {
    return button.dataset.defaultExpanded === "true";
  }
  const controlsId = button.getAttribute("aria-controls");
  return disclosureDefaults.get(controlsId) ?? true;
}

function restoreDisclosureStates() {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(disclosureStorageKey) || "null");
  } catch {
    stored = null;
  }
  if (!stored || typeof stored !== "object") stored = {};
  document.querySelectorAll(".layer-disclosure").forEach((button) => {
    if (button.closest(".layer-subgroup.has-single-child")) return;
    const controlsId = button.getAttribute("aria-controls");
    if (!controlsId) return;
    const storedExpanded = stored[controlsId];
    const expanded =
      typeof storedExpanded === "boolean"
        ? storedExpanded
        : simplifiedSidebar
          ? false
          : getDisclosureDefaultExpanded(button);
    button.setAttribute("aria-expanded", String(expanded));
    const children = document.querySelector(`#${controlsId}`);
    if (children) children.hidden = !expanded;
  });
}

restoreDisclosureStates();
updateHierarchyInteractivity();

const sidebarCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function sortSidebarChildren(containerSelector, childSelector, getLabel) {
  const container = document.querySelector(containerSelector);
  [...container.querySelectorAll(childSelector)]
    .sort((first, second) =>
      sidebarCollator.compare(getLabel(first), getLabel(second)),
    )
    .forEach((child) => container.append(child));
}

sortSidebarChildren(
  "#architecture-layers",
  ":scope > .layer-subgroup",
  (group) => group.querySelector(".layer-disclosure span:last-child").textContent,
);
sortSidebarChildren(
  "#consumable-layers",
  ":scope > .layer-toggle",
  (button) => button.textContent.trim(),
);

function getDirectTitle(group) {
  return (
    [...group.children]
      .find((child) => child.localName === "title")
      ?.textContent.trim() || ""
  );
}

function hasRenderableContent(group) {
  return Boolean(
    group?.querySelector(
      "path, rect, circle, ellipse, line, polyline, polygon, text, use, image",
    ),
  );
}

function getOperationsStateKey(id, depth) {
  return depth >= 3
    ? id
    : id.replace(new RegExp(`_${activeMap}(?=_|$)`), "");
}

function getOperationsChildren(group) {
  return [...group.children]
    .filter(
      (child) =>
        child.localName === "g" &&
        getDirectTitle(child) &&
        hasRenderableContent(child),
    )
    .sort((first, second) => {
      const titleOrder = sidebarCollator.compare(
        getDirectTitle(first),
        getDirectTitle(second),
      );
      return titleOrder || sidebarCollator.compare(first.id, second.id);
    });
}

function getOperationsSwatchColor(group, depth) {
  if (depth === 0) return "#0066cc";
  if (depth < 3) return "#0066cc";
  if (group.id.startsWith("add_medkits_")) return "#00a933";
  if (group.id.startsWith("add_grenade-cases_")) return "#ff0000";
  if (group.id.startsWith("add_batteries_")) return "#ffbf00";
  if (group.id.startsWith("add_ammo_")) return "#ffffff";
  const styledElement = group.querySelector('[style*="fill:#"]');
  return styledElement
    ?.getAttribute("style")
    ?.match(/(?:^|;)fill:(#[0-9a-f]{6})/i)?.[1] || "#0066cc";
}

function createOperationsToggle(
  group,
  label,
  depth,
  showLabel = true,
  defaultVisible = true,
) {
  return createOperationsToggleForKey(
    getOperationsStateKey(group.id, depth),
    label,
    depth,
    showLabel,
    defaultVisible,
    getOperationsSwatchColor(group, depth),
  );
}

function createOperationsToggleForKey(
  key,
  label,
  depth,
  showLabel,
  defaultVisible,
  swatchColor,
) {
  if (!operationsLayerVisibility.has(key)) {
    operationsLayerVisibility.set(key, defaultVisible);
  }
  const button = document.createElement("button");
  button.className = "layer-toggle operations-layer-toggle";
  if (depth === 0) {
    button.classList.add("layer-parent");
    button.style.setProperty("--tick-color", swatchColor);
  }
  button.type = "button";
  button.dataset.operationsKey = key;
  button.dataset.operationsLabel = label;
  const swatch = document.createElement("span");
  swatch.className = "layer-swatch operations-layer-swatch";
  swatch.style.setProperty("--swatch-color", swatchColor);
  button.append(swatch);
  if (showLabel) button.append(document.createTextNode(label));
  button.addEventListener("click", () => {
    operationsLayerVisibility.set(
      key,
      !operationsLayerVisibility.get(key),
    );
    applyOperationsVisibility();
    persistLayerStates();
    updateAllButton();
  });
  return button;
}

function createOperationsDisclosure(
  label,
  controlsId,
  defaultExpanded = !simplifiedSidebar,
) {
  const button = document.createElement("button");
  button.className = "layer-disclosure";
  button.type = "button";
  button.setAttribute("aria-expanded", String(defaultExpanded));
  button.dataset.defaultExpanded = String(defaultExpanded);
  button.setAttribute("aria-controls", controlsId);
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "▾";
  const text = document.createElement("span");
  text.textContent = label;
  button.append(arrow, text);
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    document.querySelector(`#${controlsId}`).hidden = expanded;
    persistDisclosureStates();
  });
  return button;
}

function createOperationsBranch(
  group,
  label,
  depth,
  parentKey = null,
  defaultVisible = true,
) {
  const key = getOperationsStateKey(group.id, depth);
  const children = getOperationsChildren(group);
  operationsLayers.push({ element: group, key, parentKey });

  if (children.length === 0) {
    return createOperationsToggle(group, label, depth, true, defaultVisible);
  }

  const branch = document.createElement("div");
  branch.className =
    depth === 0
      ? "layer-group operations-poi-group"
      : `layer-subgroup operations-branch operations-depth-${depth}`;
  const heading = document.createElement("div");
  heading.className = "layer-group-heading operations-branch-heading";
  const controlsId = `${getOperationsStateKey(group.id, depth)}-controls`;
  heading.append(
    createOperationsDisclosure(label, controlsId),
    createOperationsToggle(group, label, depth, false, defaultVisible),
  );
  const childContainer = document.createElement("div");
  childContainer.className = "layer-children";
  childContainer.id = controlsId;

  appendOperationsChildren(children, childContainer, depth + 1, key);
  branch.append(heading, childContainer);
  return branch;
}

function appendOperationsChildren(childGroups, container, depth, parentKey) {
  const titleTotals = new Map();
  childGroups.forEach((child) => {
    const childTitle = getDirectTitle(child);
    titleTotals.set(childTitle, (titleTotals.get(childTitle) || 0) + 1);
  });
  const titleCounts = new Map();
  childGroups.forEach((child) => {
    const childTitle = getDirectTitle(child);
    const nextCount = (titleCounts.get(childTitle) || 0) + 1;
    titleCounts.set(childTitle, nextCount);
    const childLabel =
      titleTotals.get(childTitle) > 1
        ? `${childTitle} ${nextCount}`
        : childTitle;
    container.append(
      createOperationsBranch(child, childLabel, depth, parentKey),
    );
  });
}

// Sidebar branch for several same-named SVG groups (one per mission) whose
// individual nodes are hidden: the tick controls all of them at once.
function createMergedOperationsBranch(title, groups, depth, parentKey) {
  const key = `merged_${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  groups.forEach((group) => {
    operationsLayers.push({ element: group, key, parentKey });
  });
  const branch = document.createElement("div");
  branch.className = `layer-subgroup operations-branch operations-depth-${depth}`;
  const heading = document.createElement("div");
  heading.className = "layer-group-heading operations-branch-heading";
  const controlsId = `${key}-controls`;
  heading.append(
    createOperationsDisclosure(title, controlsId),
    createOperationsToggleForKey(
      key,
      title,
      depth,
      false,
      true,
      getOperationsSwatchColor(groups[0], depth),
    ),
  );
  const childContainer = document.createElement("div");
  childContainer.className = "layer-children";
  childContainer.id = controlsId;
  appendOperationsChildren(
    groups.flatMap((group) => getOperationsChildren(group)),
    childContainer,
    depth + 1,
    key,
  );
  branch.append(heading, childContainer);
  return branch;
}

function applyOperationsVisibility() {
  const effectiveVisibility = new Map();
  operationsLayers.forEach(({ element, key, parentKey }) => {
    const visible = operationsLayerVisibility.get(key) !== false;
    const parentVisible = parentKey
      ? effectiveVisibility.get(parentKey) !== false
      : true;
    const effective = visible && parentVisible;
    effectiveVisibility.set(key, effective);
    element.style.display = effective ? "" : "none";
  });
  operationsPoiTree
    .querySelectorAll("[data-operations-key]")
    .forEach((button) => {
      const visible =
        operationsLayerVisibility.get(button.dataset.operationsKey) !== false;
      button.classList.toggle("is-visible", visible);
      button.setAttribute("aria-pressed", String(visible));
      button.setAttribute(
        "aria-label",
        `${visible ? "Hide" : "Show"} ${button.dataset.operationsLabel}`,
      );
    });
  updateHierarchyInteractivity();
}

function isSimplifiedActive() {
  return simplifiedSidebar && Boolean(operationsMetadata);
}

function getMissionBranch(svg) {
  if (!isSimplifiedActive() || !selectedMission) return null;
  const mission = operationsMetadata.missions[selectedMission];
  if (!mission?.svgKey) return null;
  const branch = svg.querySelector(`#op_${mission.svgKey}_${activeMap}`);
  return branch && hasRenderableContent(branch) ? branch : null;
}

function bindConditionalConsumables(group) {
  const children = getOperationsChildren(group);
  const targets = children.length > 0 ? children : [group];
  targets.forEach((child) => {
    if (!hasRenderableContent(child)) return;
    const layerName =
      operationsMetadata.conditionalConsumables?.[getDirectTitle(child)];
    if (layerName) {
      conditionalConsumableBindings.push({ element: child, layerName });
    } else {
      appendConditionalConsumableToggle(child);
    }
  });
}

function appendConditionalConsumableToggle(group) {
  const key = group.id;
  if (!conditionalConsumableState.has(key)) {
    conditionalConsumableState.set(key, true);
  }
  const label = getDirectTitle(group);
  const button = document.createElement("button");
  button.className = "layer-toggle operations-layer-toggle";
  button.type = "button";
  button.dataset.operationsKey = key;
  button.dataset.operationsLabel = label;
  const swatch = document.createElement("span");
  swatch.className = "layer-swatch operations-layer-swatch";
  swatch.style.setProperty(
    "--swatch-color",
    getOperationsSwatchColor(group, 3),
  );
  button.append(swatch, document.createTextNode(label));
  button.addEventListener("click", () => {
    conditionalConsumableState.set(key, !conditionalConsumableState.get(key));
    applyConditionalConsumableVisibility();
    persistLayerStates();
    updateAllButton();
  });
  conditionalToggles.push(button);
  document.querySelector("#consumable-layers").append(button);
}

function removeConditionalToggles() {
  conditionalToggles.forEach((button) => button.remove());
  conditionalToggles = [];
}

function applyConditionalConsumableVisibility() {
  conditionalConsumableBindings.forEach(({ element, layerName }) => {
    const own = layerName
      ? layerVisibility[layerName] !== false
      : conditionalConsumableState.get(element.id) !== false;
    element.style.display =
      own && layerVisibility.consumables !== false ? "" : "none";
  });
  conditionalToggles.forEach((button) => {
    const visible =
      conditionalConsumableState.get(button.dataset.operationsKey) !== false;
    button.classList.toggle("is-visible", visible);
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute(
      "aria-label",
      `${visible ? "Hide" : "Show"} ${button.dataset.operationsLabel}`,
    );
  });
}

function buildOperationsPoiTree(svg) {
  operationsLayers = [];
  conditionalConsumableBindings = [];
  removeConditionalToggles();
  operationsPoiTree.replaceChildren();
  const poiRoot = svg.querySelector(`#ops_poi_${activeMap}`);
  if (isSimplifiedActive()) {
    const missionBranch = getMissionBranch(svg);
    if (missionBranch) {
      if (poiRoot) {
        poiRoot.style.display = "";
        getOperationsChildren(poiRoot).forEach((sibling) => {
          if (sibling !== missionBranch) sibling.style.display = "none";
        });
      }
      missionBranch.style.display = "";
      const rootLabel =
        (poiRoot && getDirectTitle(poiRoot)) ||
        "Operational Points of Interest";
      const rootKey = getOperationsStateKey(missionBranch.id, 0);
      const rootBranch = document.createElement("div");
      rootBranch.className = "layer-group operations-poi-group";
      const heading = document.createElement("div");
      heading.className = "layer-group-heading operations-branch-heading";
      const controlsId = `${getOperationsStateKey(
        (poiRoot || missionBranch).id,
        0,
      )}-controls`;
      heading.append(
        createOperationsDisclosure(rootLabel, controlsId),
        createOperationsToggle(missionBranch, rootLabel, 0, false, true),
      );
      const childContainer = document.createElement("div");
      childContainer.className = "layer-children";
      childContainer.id = controlsId;
      getOperationsChildren(missionBranch).forEach((child) => {
        if (child.id.startsWith("add_consumables_")) {
          child.style.display = "";
          bindConditionalConsumables(child);
        } else {
          childContainer.append(
            createMergedOperationsBranch(
              getDirectTitle(child),
              [child],
              1,
              rootKey,
            ),
          );
        }
      });
      rootBranch.append(heading, childContainer);
      operationsPoiTree.append(rootBranch);
      applyOperationsVisibility();
      return;
    }
    if (!poiRoot || !hasRenderableContent(poiRoot)) return;
    buildSimplifiedNoMissionTree(poiRoot);
    return;
  }
  // Original mode: the full hierarchy is shown as authored, including
  // the mission branches.
  if (!poiRoot || !hasRenderableContent(poiRoot)) return;
  const label = getDirectTitle(poiRoot) || "Operations Points of Interest";
  operationsPoiTree.append(createOperationsBranch(poiRoot, label, 0));
  applyOperationsVisibility();
}

// Simplified mode with no mission selected: the sidebar behaves as if all
// missions were merged into one. Mission names never appear; their children
// are promoted under the POI root and grouped by name, and additional
// consumables roll up into the static Consumables group by type.
function buildSimplifiedNoMissionTree(poiRoot) {
  const label = getDirectTitle(poiRoot) || "Operational Points of Interest";
  const rootKey = getOperationsStateKey(poiRoot.id, 0);
  const rootBranch = document.createElement("div");
  rootBranch.className = "layer-group operations-poi-group";
  const heading = document.createElement("div");
  heading.className = "layer-group-heading operations-branch-heading";
  const controlsId = `${rootKey}-controls`;
  heading.append(
    createOperationsDisclosure(label, controlsId),
    createOperationsToggle(poiRoot, label, 0, false, true),
  );
  const childContainer = document.createElement("div");
  childContainer.className = "layer-children";
  childContainer.id = controlsId;

  const promoted = new Map();
  getOperationsChildren(poiRoot).forEach((missionGroup) => {
    missionGroup.style.display = "";
    if (!missionGroup.id.startsWith("op_")) {
      childContainer.append(
        createOperationsBranch(
          missionGroup,
          getDirectTitle(missionGroup),
          1,
          rootKey,
          true,
        ),
      );
      return;
    }
    getOperationsChildren(missionGroup).forEach((child) => {
      if (child.id.startsWith("add_consumables_")) {
        child.style.display = "";
        bindConditionalConsumables(child);
        return;
      }
      const title = getDirectTitle(child);
      if (!promoted.has(title)) promoted.set(title, []);
      promoted.get(title).push(child);
    });
  });
  [...promoted.entries()]
    .sort((first, second) => sidebarCollator.compare(first[0], second[0]))
    .forEach(([title, groups]) => {
      childContainer.append(
        createMergedOperationsBranch(title, groups, 1, rootKey),
      );
    });
  rootBranch.append(heading, childContainer);
  operationsPoiTree.append(rootBranch);
  applyOperationsVisibility();
}

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

const compactLayout = window.matchMedia("(max-width: 720px)");
setSidebarExpanded(!compactLayout.matches);
compactLayout.addEventListener("change", (event) => {
  setSidebarExpanded(!event.matches);
});

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
  "energy-ports",
  "ammo-boxes",
  "batteries",
  "grenade-cases",
  "medkits",
];

const overlapAvoidanceLayerNames = ["labels"];

const missionConsumableSelectors = [
  '[id^="add_energy-ports_"]',
  '[id^="add_ammo_"]',
  '[id^="add_batteries_"]',
  '[id^="add_grenade-cases_"]',
  '[id^="add_medkits_"]',
];

function getUprightObjects(svg) {
  const standardObjects = uprightLayerNames.flatMap((layerName) => {
    const group = svg.querySelector(`#${layerName}_${activeMap}`);
    return group ? [...group.querySelectorAll(":scope > g")] : [];
  });
  const missionObjects = missionConsumableSelectors.flatMap((selector) =>
    [...svg.querySelectorAll(selector)].flatMap((group) => [
      ...group.querySelectorAll(":scope > g"),
    ]),
  );
  return [...new Set([...standardObjects, ...missionObjects])];
}

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
  image.style.transform = `translate(calc(-50% + ${offsetXRatio * 100}%), calc(-50% + ${offsetYRatio * 100}%)) scale(${scale * baseMapScale})${rotation}`;
  zoomLevel.textContent = `${Math.round(scale * 100)}%`;
  rememberMapPointAtReticle();
}

function isLayerEffectivelyVisible(layerName) {
  if (layerVisibility[layerName] === false) return false;
  const parentName = layerParents[layerName];
  return parentName ? isLayerEffectivelyVisible(parentName) : true;
}

function applyLayerVisibility() {
  layerNames.forEach((layerName) => {
    const group = image.querySelector(`#${layerName}_${activeMap}`);
    if (group) {
      group.style.display = isLayerEffectivelyVisible(layerName)
        ? ""
        : "none";
    }
  });
  applyConditionalConsumableVisibility();
  updateHierarchyInteractivity();
}

// Children of an inactive hierarchy tick keep their own tick state but
// become muted and non-interactive, since toggling them has no effect
// until their parent is active again.
function updateHierarchyInteractivity() {
  document.querySelectorAll(".layer-toggle[data-layer]").forEach((button) => {
    let disabled = false;
    let parentName = layerParents[button.dataset.layer];
    while (parentName) {
      if (layerVisibility[parentName] === false) {
        disabled = true;
        break;
      }
      parentName = layerParents[parentName];
    }
    button.disabled = disabled;
  });
  conditionalToggles.forEach((button) => {
    button.disabled = layerVisibility.consumables === false;
  });
  document
    .querySelectorAll(".layer-toggle[data-operations-key]")
    .forEach((button) => {
      if (conditionalToggles.includes(button)) return;
      let disabled = false;
      let branch = button.closest(
        ".operations-branch, .operations-poi-group",
      );
      // A branch's own tick must not be disabled by its own state —
      // only by the state of its ancestors.
      if (
        branch &&
        branch.querySelector(":scope > .layer-group-heading > .layer-toggle") ===
          button
      ) {
        branch = branch.parentElement?.closest(
          ".operations-branch, .operations-poi-group",
        );
      }
      while (branch) {
        const parentToggle = branch.querySelector(
          ":scope > .layer-group-heading > .layer-toggle",
        );
        const parentKey = parentToggle?.dataset.operationsKey;
        const parentActive = parentKey
          ? conditionalConsumableState.has(parentKey)
            ? conditionalConsumableState.get(parentKey) !== false
            : operationsLayerVisibility.get(parentKey) !== false
          : true;
        if (!parentActive) {
          disabled = true;
          break;
        }
        branch = branch.parentElement?.closest(
          ".operations-branch, .operations-poi-group",
        );
      }
      button.disabled = disabled;
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

function applyOrientation() {
  const svg = image.querySelector("svg");
  if (!svg) return;
  getUprightObjects(svg).forEach((object) => {
    const baseTransform =
      object.dataset.baseTransform ?? object.getAttribute("transform") ?? "";
    object.dataset.baseTransform = baseTransform;
    object.dataset.uprightOffsetX = "0";
    object.dataset.uprightOffsetY = "0";
    setUprightTransform(object);
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

function refreshUprightLayout() {
  renderMap();
  const svg = image.querySelector("svg");
  avoidUprightOverlaps(svg);
}

function hasLayerContent(layerName) {
  if (layerName === "floors" || layerName === "elevated") {
    return layerNames.some(
      (childName) =>
        layerParents[childName] === layerName && hasLayerContent(childName),
    );
  }
  const group = image.querySelector(`#${layerName}_${activeMap}`);
  return Boolean(
    group?.querySelector(
      "path, rect, circle, ellipse, line, polyline, polygon, text, use, image",
    ),
  );
}

function applyLabelsPlacement() {
  const textGroup = document.querySelector('.layer-group[data-layer-group="text"]');
  const labelsButton = document.querySelector(
    ".layer-toggle[data-layer='labels']",
  );
  if (!textGroup || !labelsButton) return;
  const swatch = labelsButton.querySelector(".labels-swatch");
  if (isSimplifiedActive()) {
    textGroup.hidden = true;
    textGroup.before(labelsButton);
    let tick = labelsButton.querySelector(".labels-tick");
    if (!tick) {
      tick = document.createElement("span");
      tick.className = "labels-tick";
      labelsButton.append(tick);
    }
    if (swatch) tick.append(swatch);
  } else {
    textGroup.hidden = false;
    document.querySelector("#text-layers").append(labelsButton);
    labelsButton.querySelector(".labels-tick")?.remove();
    if (swatch) labelsButton.prepend(swatch);
  }
}

function updateLayerAvailability() {
  document.querySelectorAll(".layer-toggle[data-layer]").forEach((button) => {
    const layerName = button.dataset.layer;
    button.hidden = !hasLayerContent(layerName);
  });

  document.querySelectorAll(".layer-group[data-layer-group]").forEach((group) => {
    const layerName = group.dataset.layerGroup;
    group.hidden = !hasLayerContent(layerName);
  });

  document
    .querySelectorAll(".layer-subgroup")
    .forEach((subgroup) => {
    const children = subgroup.querySelector(":scope > .layer-children");
    if (!children) return;
    const visibleChildren = [...children.children].filter(
      (el) =>
        !el.hidden &&
        (el.classList.contains("layer-toggle") ||
          el.classList.contains("layer-subgroup") ||
          el.classList.contains("layer-group")),
    );
    const hasSingleChild = visibleChildren.length === 1;
    subgroup.hidden = visibleChildren.length === 0;
    subgroup.classList.toggle("has-single-child", hasSingleChild);

    if (hasSingleChild) {
      const disclosure = subgroup.querySelector(
        ":scope > .layer-group-heading > .layer-disclosure",
      );
      disclosure?.setAttribute("aria-expanded", "true");
      children.hidden = false;
    }
    });
  applyLabelsPlacement();
  restoreDisclosureStates();
  updateAllButton();
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
  svg.querySelector(`#headers_${mapKey}`)?.remove();
  svg.querySelector(`#footers_${mapKey}`)?.remove();
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
  buildOperationsPoiTree(svg);
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

function updateMissionButtons() {
  missionSelector.querySelectorAll(".mission-option").forEach((button) => {
    const selected = button.dataset.mission === selectedMission;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function buildMissionButtons() {
  missionSelector.replaceChildren();
  if (!operationsMetadata?.missions) return;
  Object.entries(operationsMetadata.missions).forEach(([key, mission]) => {
    const button = document.createElement("button");
    button.className = "mission-option";
    button.type = "button";
    button.dataset.mission = key;
    button.setAttribute("aria-pressed", "false");
    button.textContent = mission.title;
    button.addEventListener("click", () => selectMission(key));
    missionSelector.append(button);
  });
  updateMissionButtons();
}

function updateDeckAvailability() {
  const mission =
    isSimplifiedActive() && selectedMission
      ? operationsMetadata.missions[selectedMission]
      : null;
  document.querySelectorAll(".deck-option").forEach((button) => {
    button.hidden =
      Boolean(mission) && !mission.decks.includes(button.dataset.map);
  });
  document
    .querySelectorAll(".deck-option:not([hidden])")
    .forEach((button, index) => {
      button.setAttribute("aria-keyshortcuts", String(index + 1));
    });
  document.querySelectorAll(".deck-option[hidden]").forEach((button) => {
    button.removeAttribute("aria-keyshortcuts");
  });
}

function rebuildOperationsTree() {
  const svg = image.querySelector("svg");
  if (!svg) return;
  buildOperationsPoiTree(svg);
  updateLayerAvailability();
  applyLayerVisibility();
}

function persistSelectedMission() {
  if (selectedMission) {
    localStorage.setItem(missionStorageKey, selectedMission);
  } else {
    localStorage.removeItem(missionStorageKey);
  }
}

function selectMission(key) {
  selectedMission = selectedMission === key ? null : key;
  persistSelectedMission();
  updateMissionButtons();
  updateDeckAvailability();
  if (selectedMission) {
    const mission = operationsMetadata.missions[selectedMission];
    const targetDeck =
      mission.entryDeck && mission.decks.includes(mission.entryDeck)
        ? mission.entryDeck
        : (operationsMetadata.deckOrder || []).find((deckKey) =>
            mission.decks.includes(deckKey),
          );
    if (targetDeck && targetDeck !== activeMap) {
      document.querySelector(`.deck-option[data-map="${targetDeck}"]`)?.click();
      return;
    }
  }
  rebuildOperationsTree();
}

function applySimplifiedMode() {
  const active = isSimplifiedActive();
  missionControls.hidden = !active;
  if (active) {
    buildMissionButtons();
    const storedMission = localStorage.getItem(missionStorageKey);
    if (storedMission && operationsMetadata?.missions?.[storedMission]) {
      selectedMission = storedMission;
      updateMissionButtons();
    }
  } else {
    selectedMission = null;
    updateMissionButtons();
  }
  updateDeckAvailability();
  if (active && selectedMission) {
    const mission = operationsMetadata.missions[selectedMission];
    if (!mission.decks.includes(activeMap)) {
      const targetDeck =
        mission.entryDeck && mission.decks.includes(mission.entryDeck)
          ? mission.entryDeck
          : (operationsMetadata.deckOrder || []).find((deckKey) =>
              mission.decks.includes(deckKey),
            );
      if (targetDeck && targetDeck !== activeMap) {
        document
          .querySelector(`.deck-option[data-map="${targetDeck}"]`)
          ?.click();
        return;
      }
    }
  }
  rebuildOperationsTree();
}

document.querySelectorAll(".layer-toggle[data-layer]").forEach((button) => {
  button.addEventListener("click", () => {
    const layerName = button.dataset.layer;
    layerVisibility[layerName] = !layerVisibility[layerName];
    button.classList.toggle("is-visible", layerVisibility[layerName]);
    button.setAttribute("aria-pressed", String(layerVisibility[layerName]));
    applyLayerVisibility();
    persistLayerStates();
    updateAllButton();
  });
});

document.querySelectorAll(".layer-disclosure").forEach((button) => {
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    document.querySelector(`#${button.getAttribute("aria-controls")}`).hidden =
      expanded;
    persistDisclosureStates();
  });
});

const allButton = document.querySelector("#show-all-layers");

function getVisibleTickBoxes() {
  return [...document.querySelectorAll(".layer-toggle")].filter((button) => {
    if (button.hidden || button.closest("[hidden]")) return false;
    return true;
  });
}

function isAllTicked() {
  const buttons = getVisibleTickBoxes();
  return (
    buttons.length > 0 &&
    buttons.every((button) => button.classList.contains("is-visible"))
  );
}

function updateAllButton() {
  const allTicked = isAllTicked();
  allButton.classList.toggle("is-active", allTicked);
  allButton.setAttribute("aria-pressed", String(allTicked));
}

allButton.addEventListener("click", () => {
  if (isAllTicked()) {
    const rootTicks = [...document.querySelectorAll(".layer-parent")].filter(
      (button) => !button.closest("[hidden]"),
    );
    const labelsButton = document.querySelector(
      '.layer-tree > .layer-toggle[data-layer="labels"]',
    );
    if (labelsButton) rootTicks.push(labelsButton);
    rootTicks.forEach((button) => {
      if (button.classList.contains("is-visible")) button.click();
    });
  } else {
    getVisibleTickBoxes().forEach((button) => {
      button.disabled = false;
      if (!button.classList.contains("is-visible")) button.click();
    });
  }
  updateAllButton();
});
updateAllButton();

document.querySelectorAll(".orientation-option").forEach((button) => {
  button.addEventListener("click", () => {
    const mapPoint = getMapPointAtReticle();
    const nextOrientation = button.dataset.orientation;
    orientation = nextOrientation;
    document.querySelectorAll(".orientation-option").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("is-active", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    applyOrientation();
    syncOffsetsToMapSize();
    refreshUprightLayout();
    restoreMapPointAtReticle(mapPoint);
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

const layerShortcuts = {
  a: "architecture",
  b: "batteries",
  c: "consumables",
  e: "energy-ports",
  g: "grenade-cases",
  l: "labels",
  m: "medkits",
  t: "text",
  x: "ammo-boxes",
};

const floorShortcuts = {
  Digit0: "f0",
  Digit1: "f1",
  Digit2: "f2",
  Digit3: "f3",
};

const elevatedShortcuts = {
  Digit1: "e1",
  Digit2: "e2",
  Digit3: "e3",
};

function clickAvailableLayer(layerName) {
  if (!layerName) return false;
  const button = document.querySelector(`.layer-toggle[data-layer="${layerName}"]`);
  if (!button || button.hidden) return false;
  button.click();
  return true;
}

function isTypingOrUsingControl(target) {
  return Boolean(
    target.closest(
      'input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"])',
    ),
  );
}

function updateKeyboardPanMode(announce = false) {
  const mode = invertKeyboardPan ? "Move viewpoint" : "Move map";
  document.querySelector("#keyboard-pan-mode").textContent = mode;
  if (announce) {
    document.querySelector("#keyboard-shortcut-status").textContent =
      `Arrow keys now ${mode.toLowerCase()}`;
  }
}

updateKeyboardPanMode();

document.addEventListener("keydown", (event) => {
  if (
    event.defaultPrevented ||
    isTypingOrUsingControl(event.target) ||
    aboutDialog.open ||
    shortcutsDialog.open ||
    event.altKey ||
    event.metaKey
  ) {
    return;
  }

  const repeatable = event.key.startsWith("Arrow") || ["+", "=", "-", "_"].includes(event.key);
  if (event.repeat && !repeatable) return;

  let handled = false;

  if (event.ctrlKey && event.shiftKey && elevatedShortcuts[event.code]) {
    handled = clickAvailableLayer(elevatedShortcuts[event.code]);
  } else if (!event.ctrlKey && event.shiftKey && floorShortcuts[event.code]) {
    handled = clickAvailableLayer(floorShortcuts[event.code]);
  } else if (!event.ctrlKey && !event.shiftKey && /^Digit[1-4]$/.test(event.code)) {
    const deck = document.querySelectorAll(".deck-option:not([hidden])")[
      Number(event.code.at(-1)) - 1
    ];
    if (deck) {
      deck.click();
      handled = true;
    }
  } else if (!event.ctrlKey && !event.shiftKey && event.code === "Space") {
    document.querySelector("#show-all-layers").click();
    handled = true;
  } else if (!event.ctrlKey && ["+", "="].includes(event.key)) {
    document.querySelector("#zoom-in").click();
    handled = true;
  } else if (!event.ctrlKey && ["-", "_"].includes(event.key)) {
    document.querySelector("#zoom-out").click();
    handled = true;
  } else if (!event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "r") {
    document.querySelector("#reset-map").click();
    handled = true;
  } else if (!event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "p") {
    const nextOrientation = orientation === "portrait" ? "landscape" : "portrait";
    document.querySelector(`[data-orientation="${nextOrientation}"]`).click();
    handled = true;
  } else if (!event.ctrlKey && !event.shiftKey && event.key === "\\") {
    invertKeyboardPan = !invertKeyboardPan;
    updateKeyboardPanMode(true);
    handled = true;
  } else if (!event.ctrlKey && event.key === "?") {
    shortcutsDialog.showModal();
    handled = true;
  } else if (!event.ctrlKey && !event.shiftKey && event.key.startsWith("Arrow")) {
    const panStep = 40;
    const direction = invertKeyboardPan ? -1 : 1;
    if (event.key === "ArrowLeft") offsetX -= panStep * direction;
    if (event.key === "ArrowRight") offsetX += panStep * direction;
    if (event.key === "ArrowUp") offsetY -= panStep * direction;
    if (event.key === "ArrowDown") offsetY += panStep * direction;
    renderMap();
    handled = true;
  } else if (!event.ctrlKey && !event.shiftKey) {
    handled = clickAvailableLayer(layerShortcuts[event.key.toLowerCase()]);
  }

  if (handled) event.preventDefault();
});

document.querySelectorAll(".deck-option").forEach((button, index) => {
  button.setAttribute("aria-keyshortcuts", String(index + 1));
});
document.querySelector("#show-all-layers").setAttribute("aria-keyshortcuts", "Space");
document.querySelector("#zoom-in").setAttribute("aria-keyshortcuts", "+");
document.querySelector("#zoom-out").setAttribute("aria-keyshortcuts", "-");
document.querySelector("#reset-map").setAttribute("aria-keyshortcuts", "R");
document.querySelector("#open-shortcuts").setAttribute("aria-keyshortcuts", "?");
viewport.setAttribute(
  "aria-keyshortcuts",
  "ArrowLeft ArrowRight ArrowUp ArrowDown P \\",
);
Object.entries(layerShortcuts).forEach(([shortcut, layerName]) => {
  document
    .querySelector(`.layer-toggle[data-layer="${layerName}"]`)
    ?.setAttribute("aria-keyshortcuts", shortcut.toUpperCase());
});
Object.entries(floorShortcuts).forEach(([code, layerName]) => {
  document
    .querySelector(`.layer-toggle[data-layer="${layerName}"]`)
    ?.setAttribute("aria-keyshortcuts", `Shift+${code.at(-1)}`);
});
Object.entries(elevatedShortcuts).forEach(([code, layerName]) => {
  document
    .querySelector(`.layer-toggle[data-layer="${layerName}"]`)
    ?.setAttribute("aria-keyshortcuts", `Control+Shift+${code.at(-1)}`);
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

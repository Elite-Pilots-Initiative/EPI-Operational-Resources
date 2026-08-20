const mapData = {
  command: {
    title: "Command deck",
    image: "megaships/Ops-Megaship_Command.svg",
    description: "Bridge and operations spaces for primary ship command.",
  },
  cargo: {
    title: "Cargo deck",
    image: "megaships/Ops-Megaship_Cargo.svg",
    description: "Storage, transfer routes, and loading access points.",
  },
  engineering: {
    title: "Engineering deck",
    image: "megaships/Ops-Megaship_Engineering.svg",
    description: "Core systems, maintenance routes, and technical access.",
  },
  habitat: {
    title: "Habitat deck",
    image: "megaships/Ops-Megaship_Habitat.svg",
    description: "Living quarters, common spaces, and connecting corridors.",
  },
};

const mapButtons = document.querySelectorAll(".map-option");
const mapImage = document.querySelector("#map-image");
const mapTitle = document.querySelector("#map-title");
const mapDescription = document.querySelector("#map-description");

mapButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const map = mapData[button.dataset.map];

    mapButtons.forEach((option) => {
      const isSelected = option === button;
      option.classList.toggle("is-active", isSelected);
      option.setAttribute("aria-pressed", String(isSelected));
    });

    mapImage.classList.add("is-changing");
    window.setTimeout(() => {
      mapImage.src = map.image;
      mapImage.alt = `${map.title} megaship map`;
      mapTitle.textContent = map.title;
      mapDescription.textContent = map.description;
      mapImage.classList.remove("is-changing");
    }, 140);
  });
});

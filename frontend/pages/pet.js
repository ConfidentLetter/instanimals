function qs(k) {
  return new URL(location.href).searchParams.get(k);
}

async function fetchJson(url) {
  const r = await fetch(url);
  return await r.json();
}

function setList(id, arr) {
  const ul = document.getElementById(id);
  ul.innerHTML = "";
  (arr || []).forEach((x) => {
    const li = document.createElement("li");
    li.textContent = x;
    ul.appendChild(li);
  });
  if ((arr || []).length === 0) {
    const li = document.createElement("li");
    li.textContent = "—";
    ul.appendChild(li);
  }
}

async function loadPet(petId) {
  const j = await fetchJson(`/api/pets/${petId}`);
  if (!j.ok) throw new Error(j.error || "Failed to load pet");
  return j.pet;
}

async function loadMatch(petId) {
  const params = new URLSearchParams({
    hasYard: document.getElementById("hasYard").value,
    hoursPerWeek: document.getElementById("hoursPerWeek").value,
    experienceLevel: document.getElementById("experienceLevel").value,
    prefersSize: document.getElementById("prefersSize").value,
  });
  const j = await fetchJson(`/api/pets/${petId}/match?` + params.toString());
  if (!j.ok) throw new Error(j.error || "Failed to load match");
  return j;
}

async function refreshMatch(petId) {
  const m = await loadMatch(petId);
  document.getElementById("matchScore").textContent = `${m.score}%`;
  setList("reasons", m.reasons);
  setList("warnings", m.warnings);
}

async function init() {
  const petId = qs("petId");
  if (!petId) {
    document.getElementById("error").style.display = "block";
    document.getElementById("error").textContent =
      "Missing petId. Example: /pet.html?petId=...";
    return;
  }

  const pet = await loadPet(petId);
  document.getElementById("petName").textContent = pet.name || "Unnamed";
  document.getElementById("petMeta").textContent =
    `${pet.species || ""} • ${pet.breed || ""} • ${pet.size || ""} • ${pet.ageMonths ?? ""}mo`;
  document.getElementById("petStatus").textContent = pet.status || "—";
  document.getElementById("petEnergy").textContent =
    pet.energy != null ? `${pet.energy}/5` : "—";
  document.getElementById("petMedical").textContent = pet.medicalNeeds
    ? "yes"
    : "no";

  const img = document.getElementById("petImg");
  if (pet.coverImageUrl) img.src = pet.coverImageUrl;

  document.getElementById("applyBtn").onclick = () => {
    location.href = `/form.html?petId=${petId}`;
  };

  const hours = document.getElementById("hoursPerWeek");
  const hoursLabel = document.getElementById("hoursLabel");
  hours.addEventListener("input", () => (hoursLabel.textContent = hours.value));

  ["hasYard", "hoursPerWeek", "experienceLevel", "prefersSize"].forEach(
    (id) => {
      const el = document.getElementById(id);
      el.addEventListener("change", () => refreshMatch(petId));
      el.addEventListener("input", () => refreshMatch(petId));
    },
  );

  await refreshMatch(petId);
}

init().catch((e) => {
  console.error(e);
  const el = document.getElementById("error");
  el.style.display = "block";
  el.textContent = e.message || String(e);
});

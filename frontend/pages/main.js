async function fetchJson(url) {
  const r = await fetch(url);
  return await r.json();
}

function genderLabel(g) {
  const x = (g || "unknown").toLowerCase();
  if (x === "male") return "Male";
  if (x === "female") return "Female";
  return "Unknown";
}

function shortUrgentReason(p) {
  // Use your existing backend field: whyUrgent (array)
  if (Array.isArray(p.whyUrgent) && p.whyUrgent.length > 0)
    return p.whyUrgent[0];
  // fallback if you later add urgentReason
  if (p.urgentReason) return p.urgentReason;
  return "";
}

function makePetCard(p, badgeText) {
  const el = document.createElement("div");
  el.className = "pet-card";
  el.onclick = () => (location.href = `/pet.html?petId=${p.id}`);

  const img = p.coverImageUrl || "https://placehold.co/1200x800?text=Pet+Photo";
  const g = genderLabel(p.gender || p.sex);
  const reason = shortUrgentReason(p);

  el.innerHTML = `
    <div class="pet-img">
      <img src="${img}" alt="${p.name ?? "pet"}" onerror="this.src='https://placehold.co/1200x800?text=Pet+Photo'">
    </div>
    <div class="pet-body">
      <div class="pet-title-row">
        <div>
          <p class="pet-name">${p.name ?? "Unnamed"}</p>
          <div class="pet-meta">${p.breed ?? ""}</div>
        </div>
      </div>

      <div class="pet-mini">${p.species ?? ""} • ${p.size ?? "—"} • ${p.ageMonths ?? "—"}mo</div>

      <div class="pet-mini pet-mini-2">
        ${reason ? `<span>Why urgent: <b>${reason}</b></span>` : ``}
        <span>Gender: <b>${g}</b></span>
      </div>

      <div class="badge badge-with-logo">
        <span>${badgeText}</span>
        <img src="/assets/success/house-badge.png" alt="logo">
      </div>
    </div>
  `;
  return el;
}

async function load() {
  const urgentBox = document.getElementById("urgentCards");
  const exploreBox = document.getElementById("exploreCards");
  const hint = document.getElementById("dataHint");

  try {
    const urgent = await fetchJson(`/api/pets/urgent?limit=3`);
    urgentBox.innerHTML = "";
    (urgent.items || []).forEach((p) =>
      urgentBox.appendChild(makePetCard(p, "URGENT")),
    );

    const explore = await fetchJson(`/api/pets/explore?limit=5`);
    exploreBox.innerHTML = "";
    (explore.items || []).forEach((p) =>
      exploreBox.appendChild(makePetCard(p, "Seeking")),
    );

    if (
      (urgent.items || []).length === 0 &&
      (explore.items || []).length === 0
    ) {
      hint.textContent =
        "No pets found. Add Firestore docs in collection 'pets' with status='adoptable'.";
    } else {
      hint.textContent = "";
    }
  } catch (e) {
    console.error(e);
    hint.textContent = "Failed to load pets from API. Check backend logs.";
  }
}

load();

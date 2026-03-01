async function fetchJson(url){
  const r = await fetch(url);
  return await r.json();
}

function makePetCardLikeStory(p, badgeText){
  const el = document.createElement("div");
  el.className = "pet-card";
  el.onclick = () => location.href = `/pet.html?petId=${p.id}`;

  const img = p.coverImageUrl
    ? p.coverImageUrl
    : "https://placehold.co/1200x800?text=Pet+Photo";

  // 这里结构故意做成和 success stories 一样：图片区 + body区 + badge
  el.innerHTML = `
    <div class="pet-img">
      <img src="${img}" alt="${p.name ?? "pet"}" onerror="this.src='https://placehold.co/1200x800?text=Pet+Photo'">
    </div>
    <div class="pet-body">
      <p class="pet-name">${p.name ?? "Unnamed"}</p>
      <div class="pet-meta">${p.breed ?? ""}</div>
      <div class="pet-mini">${p.species ?? ""} • ${p.size ?? "—"} • ${p.ageMonths ?? "—"}mo</div>
      <div class="badge">${badgeText}</div>
    </div>
  `;
  return el;
}

async function load(){
  const urgentBox = document.getElementById("urgentCards");
  const exploreBox = document.getElementById("exploreCards");
  const hint = document.getElementById("dataHint");

  try{
    const urgent = await fetchJson(`/api/pets/urgent?limit=3`);
    urgentBox.innerHTML = "";
    (urgent.items || []).forEach(p => urgentBox.appendChild(makePetCardLikeStory(p, "URGENT 🏠")));

    const explore = await fetchJson(`/api/pets/explore?limit=5`);
    exploreBox.innerHTML = "";
    (explore.items || []).forEach(p => exploreBox.appendChild(makePetCardLikeStory(p, "Seeking 🏠")));

    if((urgent.items||[]).length === 0 && (explore.items||[]).length === 0){
      hint.textContent = "No pets found. Add Firestore docs in collection 'pets' with status='adoptable'.";
    } else {
      hint.textContent = "";
    }
  }catch(e){
    console.error(e);
    hint.textContent = "Failed to load pets from API. Check backend logs.";
  }
}

load();
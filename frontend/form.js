function qs(k){
  return new URL(location.href).searchParams.get(k);
}

function getToken(){
  return localStorage.getItem("idToken") || "";
}

async function submitApplication(petId, payload){
  const headers = { "Content-Type": "application/json" };

  // 如果你后端需要 token，就启用这一行
  const t = getToken();
  if(t) headers["Authorization"] = "Bearer " + t;

  const r = await fetch(`/api/pets/${petId}/apply`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(()=> ({}));
  if(!r.ok || !j.ok){
    throw new Error(j.error || `Submit failed (${r.status})`);
  }
  return j;
}

function val(id){ return (document.getElementById(id)?.value || "").trim(); }
function checked(id){ return !!document.getElementById(id)?.checked; }

async function onSubmit(e){
  e.preventDefault();
  const petId = qs("petId");
  if(!petId) return alert("Missing petId in URL. Open this page via a pet card.");

  // Minimal payload matching your backend shape
  const payload = {
    step1: {
      firstName: val("firstName"),
      lastName: val("lastName"),
      address: val("address"),
      city: val("city"),
      state: val("state"),
      zip: val("zip"),
      phone: val("phone"),
      email: val("email"),
    },
    step2: {
      hasYard: val("hasYard"),
      ownOrRent: val("ownOrRent"),
      householdSize: val("householdSize"),
      otherPets: val("otherPets"),
      landlordOk: val("landlordOk"),
    },
    step3: {
      experienceLevel: val("experienceLevel"),
      hoursPerWeek: val("hoursPerWeek"),
      experienceNotes: val("experienceNotes"),
    },
    step4: {
      preferredSpecies: val("preferredSpecies"),
      preferredSize: val("preferredSize"),
      canMedicate: val("canMedicate"),
      canTransport: val("canTransport"),
      notes: val("notes"),
      criteria: {
        age18: checked("crit_age18"),
        countyResident: checked("crit_county"),
        canTransportClinic: checked("crit_transport"),
        canSeparate: checked("crit_separate"),
        signature: val("signature"),
      }
    }
  };

  // basic required
  if(!payload.step1.firstName || !payload.step1.lastName || !payload.step1.email){
    return alert("Please fill at least First Name, Last Name, Email.");
  }

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  try{
    const res = await submitApplication(petId, payload);
    alert(`Submitted ✅\nApplication ID: ${res.appId}`);
    location.href = "/";
  }catch(err){
    console.error(err);
    alert(err.message || String(err));
  }finally{
    btn.disabled = false;
    btn.textContent = "Submit";
  }
}

document.getElementById("appForm").addEventListener("submit", onSubmit);
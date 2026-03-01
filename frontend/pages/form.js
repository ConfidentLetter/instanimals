function val(id) {
  return (document.getElementById(id)?.value || "").trim();
}
function checked(id) {
  return !!document.getElementById(id)?.checked;
}

async function onSubmit(e) {
  e.preventDefault();

  const payload = {
    personal: {
      firstName: val("firstName"),
      lastName: val("lastName"),
      address: val("address"),
      city: val("city"),
      state: val("state"),
      zip: val("zip"),
      phone: val("phone"),
      email: val("email"),
    },
    fosterOptions: {
      shortTerm: checked("opt_short"),
      longTerm: checked("opt_long"),
    },
    household: {
      hasYard: val("hasYard"),
      ownOrRent: val("ownOrRent"),
      householdSize: val("householdSize"),
      otherPets: val("otherPets"),
      landlordOk: val("landlordOk"),
      experienceLevel: val("experienceLevel"),
      hoursPerWeek: val("hoursPerWeek"),
      experienceNotes: val("experienceNotes"),
      preferredSpecies: val("preferredSpecies"),
      preferredSize: val("preferredSize"),
      canMedicate: val("canMedicate"),
      canTransport: val("canTransport"),
      notes: val("notes"),
    },
    criteria: {
      age18: checked("crit_age18"),
      countyResident: checked("crit_county"),
      canTransportClinic: checked("crit_transport"),
      canSeparate: checked("crit_separate"),
      signature: val("signature"),
    },
  };

  if (
    !payload.personal.firstName ||
    !payload.personal.lastName ||
    !payload.personal.email
  ) {
    return alert("Please fill in at least First Name, Last Name, and Email.");
  }

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  try {
    const r = await fetch("/api/foster-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || `Error ${r.status}`);

    // Show confirmation then redirect to create account
    btn.textContent = "Sent!";
    const form = document.getElementById("appForm");
    form.innerHTML = `
      <div style="text-align:center; padding:40px 20px;">
        <div style="font-size:48px; margin-bottom:16px;">🐾</div>
        <h2 style="font-weight:1000; font-size:24px; margin-bottom:10px;">Application Received!</h2>
        <p style="color:var(--brown2); font-weight:800; margin-bottom:24px; line-height:1.5;">
          Your foster interest has been sent to shelters in your area.<br>
          They will reach out to you soon to get further information.
        </p>
        <p style="color:var(--brown2); font-weight:800; margin-bottom:24px;">
          Create a free account to track your application and explore more animals.
        </p>
        <a href="/pages/login.html?mode=signup" class="btn" style="text-decoration:none; display:inline-flex;">
          Create My Account
        </a>
      </div>`;
  } catch (err) {
    console.error(err);
    alert(err.message || "Something went wrong. Please try again.");
    btn.disabled = false;
    btn.textContent = "Submit Application";
  }
}

document.getElementById("appForm").addEventListener("submit", onSubmit);

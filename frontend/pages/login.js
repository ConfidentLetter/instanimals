function val(id){ return (document.getElementById(id)?.value || "").trim(); }

document.getElementById("loginForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const email = val("email");
  const pass = val("password");
  if(!email || !pass) return alert("Enter email and password.");

  // Demo mode: just store email; token留空（如果你接真Firebase，这里会存idToken）
  localStorage.setItem("demoUserEmail", email);
  alert("Logged in (demo). Now you can submit the form.");
  location.href = "/";
});
(function () {
  const BTN_ID = "wl-paste-destination-fab";

  function setValue(el, value) {
    if (!el) return;
    el.value = value ?? "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setSelectByValueOrLabel(selectEl, valueOrLabel) {
    if (!selectEl || selectEl.tagName !== "SELECT") return;
    const target = (valueOrLabel || "").trim().toUpperCase();
    const opt = Array.from(selectEl.options).find((o) => {
      const v = (o.value || "").trim().toUpperCase();
      const t = (o.text || "").trim().toUpperCase();
      return v === target || t.startsWith(target + " ");
    });
    if (opt) setValue(selectEl, opt.value);
  }

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = "Paste Destination";
    btn.style.cssText = `
      position: fixed; right: 16px; bottom: 16px; z-index: 999999;
      padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc;
      background: white; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.12);
      font-size: 14px;
    `;

    btn.addEventListener("click", () => {
      chrome.storage.local.get("wl_destination", ({ wl_destination }) => {
        if (!wl_destination) {
          alert("No saved destination found. Copy it from Wanderella first.");
          return;
        }

        // Destination Address fields (LetterTrackPro)
        setValue(
          document.getElementById("FirstName_DA"),
          wl_destination.firstName,
        );
        setValue(
          document.getElementById("LastName_DA"),
          wl_destination.lastName,
        );
        setValue(document.getElementById("Company_DA"), wl_destination.company);
        setValue(
          document.getElementById("Address1_DA"),
          wl_destination.address1,
        );
        setValue(
          document.getElementById("Address2_DA"),
          wl_destination.address2,
        );
        setValue(document.getElementById("City_DA"), wl_destination.city);
        setSelectByValueOrLabel(
          document.getElementById("State_DA"),
          wl_destination.state,
        );
        setValue(document.getElementById("Zip_DA"), wl_destination.postalCode);

        alert("Destination pasted ✅");
      });
    });

    document.body.appendChild(btn);
  }

  injectButton();
  const obs = new MutationObserver(injectButton);
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();

(function () {
  const BTN_ID = "wl-copy-destination-fab";

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = "Copy Destination";
    btn.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 999999;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #ccc;
      background: white;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
      font-size: 14px;
    `;

    btn.addEventListener("click", async () => {
      // Placeholder data for now (will replace with real scraping from the modal)
      const destination = {
        fullName: "Allison Lee",
        company: "PathCrusher",
        phone: "4254140885",
        address1: "4230 120TH AVE SE",
        address2: "Apt101B",
        city: "BELLEVUE",
        stateRaw: "Washington",
        postalCode: "98006-1188",
        countryRaw: "United States (US)",
      };

      await chrome.storage.local.set({
        wl_destination: destination,
        wl_savedAt: Date.now(),
      });

      alert("Saved destination ✅ (placeholder)");
    });

    document.body.appendChild(btn);
  }

  // Inject once + keep trying if page is SPA-ish
  injectButton();
  const obs = new MutationObserver(injectButton);
  obs.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();

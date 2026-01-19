(function () {
  const BTN_ID = "wl-paste-destination-fab";

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = "Paste Destination";
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
      box-shadow: 0 2px 10px rgba(0,0,0,0.12);
      font-size: 14px;
    `;

    btn.addEventListener("click", async () => {
      const { wl_destination } =
        await chrome.storage.local.get("wl_destination");
      if (!wl_destination) {
        alert(
          "No saved destination found. Go to Wanderella and click Copy first.",
        );
        return;
      }

      alert(
        `Loaded destination ✅\n\n` +
          `${wl_destination.fullName}\n` +
          `${wl_destination.address1}\n` +
          `${wl_destination.city}, ${wl_destination.stateRaw} ${wl_destination.postalCode}`,
      );

      // Next step: fill actual LetterTrack inputs.
    });

    document.body.appendChild(btn);
  }

  injectButton();
  const obs = new MutationObserver(injectButton);
  obs.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();

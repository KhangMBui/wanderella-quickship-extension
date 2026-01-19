(function () {
  const BTN_ID = "wl-copy-destination-fab";

  function decodeHtmlEntities(str) {
    // data-args contains &quot; etc. This cnoverts it back into real JSON.
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  function readOrderNumber() {
    // Matches: "Order #29703 details"
    const h2 = document.querySelector("h2.woocommerce-order-data__heading");
    const text = (h2?.textContent || "").trim();
    const m = text.match(/Order\s*#\s*(\d+)/i);
    return m ? m[1] : "";
  }

  function readEmail() {
    // Matches: <strong>Email address:</strong> <a href="mailto:...">...</a>
    const addrBlocks = Array.from(document.querySelectorAll("div.address"));
    for (const block of addrBlocks) {
      const strongs = Array.from(block.querySelectorAll("strong"));
      const emailLabel = strongs.find(
        (s) => (s.textContent || "").trim().toLowerCase() === "email address:",
      );
      if (!emailLabel) continue;

      const a = emailLabel.parentElement?.querySelector('a[href^="mailto:"]');
      const email = (a?.textContent || "").trim();
      if (email) return email;
    }
    return "";
  }

  function pickDestinationFromArgs(args) {
    // Prefer explicit shipping address (good structure)
    const ship = args?.order?.shipping_address;
    if (ship?.address_1 || ship?.postcode) {
      return {
        firstName: ship.first_name || "",
        lastName: ship.last_name || "",
        company: ship.company || "",
        phone: args?.order?.billing_address?.phone || "",
        address1: ship.address_1 || "",
        address2: ship.address_2 || "",
        city: ship.city || "",
        state: ship.state || "",
        postalCode: ship.postcode || "",
        country: ship.country || "",
      };
    }

    // Fallback: sometimes destination is in labelsState.destination
    const dest = args?.labelsState?.destination;
    if (dest?.address || dest?.postcode) {
      const full = (dest.name || "").trim();
      const [firstName, ...rest] = full.split(/\s+/);
      return {
        firstName: firstName || "",
        lastName: rest.join(" "),
        company: dest.company || "",
        phone: dest.phone || "",
        address1: dest.address || "",
        address2: dest.address_2 || "",
        city: dest.city || "",
        state: dest.state || "",
        postalCode: dest.postcode || "",
        country: dest.country || "",
      };
    }

    return null;
  }

  function readDestination() {
    const el = document.querySelector(
      ".wc-connect-create-shipping-label[data-args]",
    );
    if (!el) return null;

    const raw = el.getAttribute("data-args");
    if (!raw) return null;

    const jsonStr = decodeHtmlEntities(raw);

    let args;
    try {
      args = JSON.parse(jsonStr);
    } catch (err) {
      console.error(
        "Failed to parse data-args JSON",
        el,
        jsonStr.slice(0, 200),
      );
      return null;
    }
    return pickDestinationFromArgs(args);
  }

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
      const destination = readDestination();
      const orderNumber = readOrderNumber();
      const email = readEmail();
      if (!destination) {
        alert(
          "Could not find destination address data. Make sure the Shipping Label section is visible",
        );
        return;
      }

      if (!orderNumber) {
        // Not fatal; still save address
        console.warn("Could not read order number from heading.");
      }

      const payload = { ...destination, orderNumber, email };

      chrome.storage.local.set(
        { wl_destination: payload, wl_savedAt: Date.now() },
        () => {
          const err = chrome.runtime?.lastError;
          if (err) {
            console.error("Storage set failed: ", err);
            alert("Failed to save destination. Check console.");
            return;
          }
          alert(
            `Destination copied ✅\nOrder #${orderNumber || "(not found)"}\n${email || "(no email found)"}`,
          );
        },
      );
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

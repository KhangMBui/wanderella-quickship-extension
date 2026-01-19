(function () {
  const BTN_ID = "wl-copy-destination-fab";

  const UI = {
    baseText: "Copy Destination",
    successText: "Copied ✅",
    errorText: "Copy failed",
    baseStyle: `
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
    `,
    okStyle: `
      border: 1px solid #3aa655;
      background: #e6f6ea;
    `,
    errStyle: `
      border: 1px solid #d93025;
      background: #fde8e6;
    `,
  };

  function setButtonState(
    btn,
    { text, style, disable = false, autoResetMs = null },
  ) {
    btn.textContent = text;
    btn.style.cssText = UI.baseStyle + style;
    btn.disabled = disable;

    if (autoResetMs) {
      window.setTimeout(() => {
        btn.textContent = UI.baseText;
        btn.style.cssText = UI.baseStyle;
        btn.disabled = false;
      }, autoResetMs);
    }
  }

  function waitForElement(selector, timeout = 8000, root = document) {
    return new Promise((resolve, reject) => {
      const el = root.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error("Element not found: " + selector));
      }, timeout);
    });
  }

  // function decodeHtmlEntities(str) {
  //   // data-args contains &quot; etc. This cnoverts it back into real JSON.
  //   const txt = document.createElement("textarea");
  //   txt.innerHTML = str;
  //   return txt.value;
  // }

  function readOrderNumber() {
    // Matches: "Order #29703 details"
    const h2 = document.querySelector("h2.woocommerce-order-data__heading");
    const text = (h2?.textContent || "").trim();
    const m = text.match(/Order\s*#\s*(\d+)/i);
    return m ? m[1] : "";
  }

  // ✅ EMAIL: outside of dialog (billing email input or mailto link)
  function readEmailOutsideDialog() {
    // Prefer the edit input (most stable)
    const input = document.querySelector("#_billing_email");
    if (input?.value) return input.value.trim();

    // Fallback: the visible billing block mailto link
    const mailto = document.querySelector(
      '.order_data_column .address a[href^="mailto:"]',
    );
    if (mailto?.textContent) return mailto.textContent.trim();

    return "";
  }

  function splitName(full) {
    const parts = (full || "").trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
    };
  }

  function parseCityStateZip(line) {
    // ex: "SEATTLE, WA 98109-4038"
    const s = (line || "").trim();
    const m = s.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
    if (!m) return { city: "", state: "", postalCode: "" };
    return { city: m[1].trim(), state: m[2].toUpperCase(), postalCode: m[3] };
  }

  function normalizeCountry(line) {
    // ex: "United States (US)" -> "US"
    const s = (line || "").trim();
    const m = s.match(/\(([A-Z]{2})\)\s*$/);
    return m ? m[1] : s;
  }

  function extractSuggestedAddressFromDialog(dialogRoot) {
    // Selected suggestion card
    const selected =
      dialogRoot.querySelector("label.address-step__suggestion.is-selected") ||
      dialogRoot
        .querySelector(
          "label.address-step__suggestion input[type='radio']:checked",
        )
        ?.closest("label.address-step__suggestion");

    if (!selected) return null;

    const summary = selected.querySelector(".address-step__summary");
    if (!summary) return null;

    // Each line is usually its own text node / element; grab visible text lines
    const text = summary.innerText || "";
    const lines = text
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    // Expected:
    // 0: NAME
    // 1: STREET
    // 2: CITY, ST ZIP
    // 3: COUNTRY
    const nameLine = lines[0] || "";
    const address1 = lines[1] || "";
    const { city, state, postalCode } = parseCityStateZip(lines[2] || "");
    const country = normalizeCountry(lines[3] || "");

    const { firstName, lastName } = splitName(nameLine);

    return {
      firstName,
      lastName,
      company: "",
      phone: "",
      address1,
      address2: "",
      city,
      state,
      postalCode,
      country,
      _source: "suggested",
    };
  }

  // function extractManualAddressFromDialog(dialogRoot) {
  //   // Your example: name="destination_address"
  //   const address1El =
  //     dialogRoot.querySelector('input[name="destination_address"]') ||
  //     dialogRoot.querySelector('input[name="destination-address"]') ||
  //     dialogRoot.querySelector('input[name="destinationAddress"]') ||
  //     dialogRoot.querySelector('input[name="destination_address_1"]') ||
  //     dialogRoot.querySelector('input[name="destination-address-1"]');

  //   if (!address1El) return null;

  //   // Best-effort nearby fields; if they don’t exist, still return address1
  //   const nameEl =
  //     dialogRoot.querySelector('input[name="destination_name"]') ||
  //     dialogRoot.querySelector('input[name="destination-name"]') ||
  //     dialogRoot.querySelector('input[name="destinationName"]');

  //   const cityEl =
  //     dialogRoot.querySelector('input[name="destination_city"]') ||
  //     dialogRoot.querySelector('input[name="destination-city"]') ||
  //     dialogRoot.querySelector('input[name="destinationCity"]');

  //   const stateEl =
  //     dialogRoot.querySelector(
  //       'input[name="destination_state"], select[name="destination_state"]',
  //     ) ||
  //     dialogRoot.querySelector(
  //       'input[name="destination-state"], select[name="destination-state"]',
  //     );

  //   const zipEl =
  //     dialogRoot.querySelector('input[name="destination_postcode"]') ||
  //     dialogRoot.querySelector('input[name="destination-postcode"]') ||
  //     dialogRoot.querySelector('input[name="destination_zip"]') ||
  //     dialogRoot.querySelector('input[name="destination-zip"]');

  //   const countryEl =
  //     dialogRoot.querySelector(
  //       'select[name="destination_country"], input[name="destination_country"]',
  //     ) ||
  //     dialogRoot.querySelector(
  //       'select[name="destination-country"], input[name="destination-country"]',
  //     );

  //   const fullName = (nameEl?.value || "").trim();
  //   const { firstName, lastName } = splitName(fullName);

  //   return {
  //     firstName,
  //     lastName,
  //     company: "",
  //     phone: "",
  //     address1: (address1El.value || "").trim(),
  //     address2: "",
  //     city: (cityEl?.value || "").trim(),
  //     state: (stateEl?.value || "").trim(),
  //     postalCode: (zipEl?.value || "").trim(),
  //     country: (countryEl?.value || "").trim(),
  //     _source: "manual",
  //   };
  // }

  async function ensureDialogOpen() {
    // If the shipping label modal is already open, return it
    const existing = document.querySelector(
      ".components-modal__frame.woocommerce.label-purchase-modal",
    );
    if (existing) return existing;

    // 1) If modal already open, return a modal root
    const modalRoot =
      document.querySelector('[role="dialog"]') ||
      document.querySelector(".components-modal__frame") ||
      document.querySelector(".woocommerce-shipping-label__modal");

    if (modalRoot && /create shipping label/i.test(modalRoot.innerText || "")) {
      return modalRoot;
    }

    // 2) Click the external "Create shipping label" button
    const openBtn =
      document.querySelector("button.shipping-label__new-label-button") ||
      Array.from(document.querySelectorAll("button")).find(
        (b) =>
          (b.textContent || "").trim().toLowerCase() ===
          "create shipping label",
      );

    if (!openBtn) throw new Error("Create shipping label button not found");

    // Use real user-like click
    openBtn.scrollIntoView({ block: "center" });
    openBtn.click();
    console.log("[Open modal] clicked create shipping label button", openBtn);

    // 3) Wait for modal to appear (look for title text)
    const modal = await waitForElement(
      ".components-modal__frame.woocommerce.label-purchase-modal",
      12000,
    );

    // 4) Optional: confirm title is correct
    const title = modal.querySelector(
      ".components-modal__header-heading",
    )?.textContent;
    console.log("[Modal found] title:", title);

    // Wait for address validation / suggestions to render
    await sleep(2000);

    return modal;
  }

  // (Optional) if you still want email: ONLY inside dialog, robust search.
  // async function readEmailFromDialog(dialogRoot) {
  //   const direct =
  //     dialogRoot.querySelector('input[name="destination-email"]') ||
  //     dialogRoot.querySelector('input[name="destination_email"]') ||
  //     dialogRoot.querySelector('input[type="email"]');

  //   if (direct?.value) return direct.value.trim();

  //   const inputs = Array.from(dialogRoot.querySelectorAll("input"));
  //   const emailLike = inputs.find((i) => {
  //     const n = (i.getAttribute("name") || "").toLowerCase();
  //     const id = (i.getAttribute("id") || "").toLowerCase();
  //     return n.includes("email") || id.includes("email");
  //   });

  //   return (emailLike?.value || "").trim();
  // }

  function logCopyFailure(reason, extra = {}) {
    console.groupCollapsed(
      "%c[Wanderella Copy Failed]",
      "color:#d93025;font-weight:bold;",
    );
    console.error("Reason:", reason);
    Object.entries(extra).forEach(([k, v]) => {
      console.log(`${k}:`, v);
    });
    console.groupEnd();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // function pickDestinationFromArgs(args) {
  //   // Prefer explicit shipping address (good structure)
  //   const ship = args?.order?.shipping_address;
  //   if (ship?.address_1 || ship?.postcode) {
  //     return {
  //       firstName: ship.first_name || "",
  //       lastName: ship.last_name || "",
  //       company: ship.company || "",
  //       phone: args?.order?.billing_address?.phone || "",
  //       address1: ship.address_1 || "",
  //       address2: ship.address_2 || "",
  //       city: ship.city || "",
  //       state: ship.state || "",
  //       postalCode: ship.postcode || "",
  //       country: ship.country || "",
  //     };
  //   }

  //   // Fallback: sometimes destination is in labelsState.destination
  //   const dest = args?.labelsState?.destination;
  //   if (dest?.address || dest?.postcode) {
  //     const full = (dest.name || "").trim();
  //     const [firstName, ...rest] = full.split(/\s+/);
  //     return {
  //       firstName: firstName || "",
  //       lastName: rest.join(" "),
  //       company: dest.company || "",
  //       phone: dest.phone || "",
  //       address1: dest.address || "",
  //       address2: dest.address_2 || "",
  //       city: dest.city || "",
  //       state: dest.state || "",
  //       postalCode: dest.postcode || "",
  //       country: dest.country || "",
  //     };
  //   }

  //   return null;
  // }

  // function readDestination() {
  //   const el = document.querySelector(
  //     ".wc-connect-create-shipping-label[data-args]",
  //   );
  //   if (!el) return null;

  //   const raw = el.getAttribute("data-args");
  //   if (!raw) return null;

  //   const jsonStr = decodeHtmlEntities(raw);

  //   let args;
  //   try {
  //     args = JSON.parse(jsonStr);
  //   } catch (err) {
  //     console.error(
  //       "Failed to parse data-args JSON",
  //       el,
  //       jsonStr.slice(0, 200),
  //     );
  //     return null;
  //   }
  //   return pickDestinationFromArgs(args);
  // }

  // function injectButton() {
  //   if (document.getElementById(BTN_ID)) return;

  //   const btn = document.createElement("button");
  //   btn.id = BTN_ID;
  //   btn.textContent = UI.baseText;
  //   btn.style.cssText = UI.baseStyle;

  //   btn.addEventListener("click", async () => {
  //     // Optimistic UI: prevent double clicks while saving
  //     setButtonState(btn, { text: "Copying…", style: "", disable: true });

  //     const destination = readDestination();
  //     const orderNumber = readOrderNumber();

  //     if (!destination) {
  //       setButtonState(btn, {
  //         text: "Open label dialog",
  //         style: UI.errStyle,
  //         disable: false,
  //         autoResetMs: 1600,
  //       });
  //       return;
  //     }

  //     let email = "";
  //     try {
  //       email = await readEmailFromDialog();
  //     } catch (e) {
  //       // no dialogs; just log + continue
  //       console.warn("Email not found in dialog", e);
  //     }

  //     const payload = { ...destination, orderNumber, email };

  //     chrome.storage.local.set(
  //       { wl_destination: payload, wl_savedAt: Date.now() },
  //       () => {
  //         const err = chrome.runtime?.lastError;
  //         if (err) {
  //           console.error("Storage set failed:", err);
  //           setButtonState(btn, {
  //             text: UI.errorText,
  //             style: UI.errStyle,
  //             disable: false,
  //             autoResetMs: 1600,
  //           });
  //           return;
  //         }

  //         // Success: persist green "Copied ✅" until next click/page refresh
  //         setButtonState(btn, {
  //           text: UI.successText,
  //           style: UI.okStyle,
  //           disable: false,
  //         });
  //       },
  //     );
  //   });

  //   document.body.appendChild(btn);
  // }

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = UI.baseText;
    btn.style.cssText = UI.baseStyle;

    btn.addEventListener("click", async () => {
      setButtonState(btn, { text: "Copying…", style: "", disable: true });

      try {
        const dialogRoot = await ensureDialogOpen();

        console.log("Dialog root: ", dialogRoot);

        // 1) Prefer Suggested address if present/selected
        let destination = extractSuggestedAddressFromDialog(dialogRoot);

        // 2) Otherwise use the manual/verified input address
        // if (!destination)
        //   destination = extractManualAddressFromDialog(dialogRoot);

        if (!destination || !destination.address1) {
          throw new Error("No verified address found in dialog");
        }

        const orderNumber = readOrderNumber();

        // ✅ email from OUTSIDE of dialog (required)
        const email = readEmailOutsideDialog();

        const payload = { ...destination, orderNumber, email };

        chrome.storage.local.set(
          { wl_destination: payload, wl_savedAt: Date.now() },
          () => {
            const err = chrome.runtime?.lastError;
            if (err) throw err;

            // Success state persists
            setButtonState(btn, {
              text: UI.successText,
              style: UI.okStyle,
              disable: false,
            });
          },
        );
      } catch (e) {
        const dialog = document.querySelector(
          ".wc-connect-create-shipping-label",
        );

        logCopyFailure(e.message || e, {
          dialogFound: !!dialog,
          hasSuggestedAddress: !!dialog?.querySelector(
            "label.address-step__suggestion.is-selected",
          ),
          hasManualAddressInput: !!dialog?.querySelector(
            'input[name="destination_address"]',
          ),
          orderNumber: readOrderNumber(),
        });
        setButtonState(btn, {
          text: UI.errorText,
          style: UI.errStyle,
          disable: false,
          autoResetMs: 1600,
        });
      }
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

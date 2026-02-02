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

  function extractManualAddressFromExpandedSection(dialogRoot) {
    // Find the destination address foldable card content
    const cards = Array.from(
      dialogRoot.querySelectorAll(".foldable-card.card"),
    );
    const destCard = cards.find((card) => {
      const title = card.querySelector(".label-purchase-modal__step-title");
      return title && /destination\s+address/i.test(title.textContent || "");
    });

    if (!destCard) {
      console.warn("[Extract] Destination address card not found");
      return null;
    }

    const content = destCard.querySelector(".foldable-card__content");
    if (!content) {
      console.warn("[Extract] Destination address content not found");
      return null;
    }

    // Try to find input fields within the expanded content
    // Look for inputs by their labels or common patterns
    const getInputValue = (labelText) => {
      const labels = Array.from(content.querySelectorAll("label"));
      const label = labels.find((l) =>
        (l.textContent || "").toLowerCase().includes(labelText.toLowerCase()),
      );
      if (!label) return "";

      const forAttr = label.getAttribute("for");
      if (forAttr) {
        const input = content.querySelector(`#${forAttr}`);
        return (input?.value || "").trim();
      }

      // Try to find input near the label
      const input =
        label.querySelector("input, select") ||
        label.nextElementSibling?.querySelector("input, select");
      return (input?.value || "").trim();
    };

    const fullName = getInputValue("name");
    const company = getInputValue("company");
    const phone = getInputValue("phone");
    const address1 = getInputValue("address");
    const city = getInputValue("city");
    const state = getInputValue("state");
    const postalCode = getInputValue("zip") || getInputValue("postal");
    const countryRaw = getInputValue("country");

    const { firstName, lastName } = splitName(fullName);

    // Only return if we have at least an address
    if (!address1) return null;

    return {
      firstName,
      lastName,
      company,
      phone,
      address1,
      address2: "",
      city,
      state,
      postalCode,
      country: normalizeCountry(countryRaw),
      _source: "manual",
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

  async function ensureDestinationAddressExpanded(dialogRoot) {
    // Find the "Destination address" foldable card
    const cards = Array.from(
      dialogRoot.querySelectorAll(".foldable-card.card"),
    );
    const destCard = cards.find((card) => {
      const title = card.querySelector(".label-purchase-modal__step-title");
      return title && /destination\s+address/i.test(title.textContent || "");
    });

    if (!destCard) {
      console.warn("[Expand] Destination address card not found");
      return;
    }

    // Check if already expanded
    if (destCard.classList.contains("is-expanded")) {
      console.log("[Expand] Destination address already expanded");
      return;
    }

    // Find and click the expand button
    const expandBtn = destCard.querySelector(
      "button.foldable-card__action.foldable-card__expand",
    );
    if (!expandBtn) {
      console.warn("[Expand] Expand button not found");
      return;
    }

    console.log("[Expand] Clicking destination address expand button");
    expandBtn.click();

    // Wait for expansion animation and content to render
    await sleep(500);
  }

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

  // function closeShippingLabelModal(modal) {
  //   if (!modal) return false;

  //   const closeBtn =
  //     modal.querySelector('button[aria-label="Close dialog"]') ||
  //     modal.querySelector(
  //       'button.components-button.has-icon[aria-label="Close dialog"]',
  //     );

  //   if (!closeBtn) {
  //     console.warn("[Close modal] close button not found");
  //     return false;
  //   }

  //   closeBtn.click();
  //   return true;
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

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = UI.baseText;
    btn.style.cssText = UI.baseStyle;

    btn.addEventListener("click", async () => {
      setButtonState(btn, { text: "Copying…", style: "", disable: true });
      let dialogRoot = null;
      try {
        dialogRoot = await ensureDialogOpen();

        console.log("Dialog root: ", dialogRoot);

        // Ensure destination address section is expanded
        await ensureDestinationAddressExpanded(dialogRoot);

        // 1) Prefer Suggested address if present/selected
        let destination = extractSuggestedAddressFromDialog(dialogRoot);

        // 2) Otherwise use the manual address from expanded section
        if (!destination)
          destination = extractManualAddressFromExpandedSection(dialogRoot);

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

            // ✅ close modal after copying
            // const closed = closeShippingLabelModal(dialogRoot);
            // console.log("[Close modal] attempted:", closed);
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

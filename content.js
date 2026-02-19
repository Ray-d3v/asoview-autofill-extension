(() => {
  "use strict";

  const STORAGE_KEY = "asoviewAutofillSettings";
  const ROOT_ID = "asv-autofill-root";
  const TOAST_ROOT_ID = "asv-autofill-toast-root";
  const MESSAGE_SOURCE = "asv-autofill";
  const MSG_CARD_FILL_REQUEST = "ASV_CARD_FILL_REQUEST";
  const MSG_CARD_FILL_RESULT = "ASV_CARD_FILL_RESULT";

  const DEFAULT_SETTINGS = {
    purchase: {
      lastName: "",
      firstName: "",
      lastNameKana: "",
      firstNameKana: "",
      phoneHead: "",
      phoneCenter: "",
      phoneTail: "",
      gender: "",
      birthYear: "",
      birthMonth: "",
      birthDay: "",
      postalHead: "",
      postalTail: "",
      prefectureCode: "",
      addressLine: ""
    },
    card: {
      number: "",
      expMonth: "",
      expYear: "",
      cvc: "",
      holderName: ""
    }
  };

  const PURCHASE_FIELD_MAP = [
    { key: "lastName", selector: 'input[name="personalInfo.name.lastName"]' },
    { key: "firstName", selector: 'input[name="personalInfo.name.firstName"]' },
    { key: "lastNameKana", selector: 'input[name="personalInfo.nameKana.lastName"]' },
    { key: "firstNameKana", selector: 'input[name="personalInfo.nameKana.firstName"]' },
    { key: "phoneHead", selector: 'input[name="personalInfo.contact.phoneNumber.headNumber"]' },
    { key: "phoneCenter", selector: 'input[name="personalInfo.contact.phoneNumber.centerNumber"]' },
    { key: "phoneTail", selector: 'input[name="personalInfo.contact.phoneNumber.tailNumber"]' },
    { key: "birthYear", selector: 'select[name="personalInfo.birthDate.year"]' },
    { key: "birthMonth", selector: 'select[name="personalInfo.birthDate.month"]' },
    { key: "birthDay", selector: 'select[name="personalInfo.birthDate.day"]' },
    { key: "postalHead", selector: 'input[name="personalInfo.contact.address.postalCode.headCode"]' },
    { key: "postalTail", selector: 'input[name="personalInfo.contact.address.postalCode.tailCode"]' },
    { key: "prefectureCode", selector: 'select[name="personalInfo.contact.address.prefectureCode"]' },
    { key: "addressLine", selector: 'input[name="personalInfo.contact.address.addressLine"]' }
  ];

  const CARD_FIELD_MAP = [
    { key: "number", selector: 'input[name="cardNumber"]' },
    { key: "expMonth", selector: 'input[name="cardExpirationMonth"]' },
    { key: "expYear", selector: 'input[name="cardExpirationYear"]' },
    { key: "cvc", selector: 'input[name="cvc"]' },
    { key: "holderName", selector: 'input[name="card-name"]' }
  ];

  let cardFrameMessageListenerBound = false;

  function cloneDefaultSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function mergeSettings(raw) {
    const merged = cloneDefaultSettings();
    if (!raw || typeof raw !== "object") {
      return merged;
    }

    if (raw.purchase && typeof raw.purchase === "object") {
      for (const key of Object.keys(merged.purchase)) {
        merged.purchase[key] = normalizeString(raw.purchase[key]);
      }
    }

    if (raw.card && typeof raw.card === "object") {
      for (const key of Object.keys(merged.card)) {
        merged.card[key] = normalizeString(raw.card[key]);
      }
    }

    return merged;
  }

  function loadSettings() {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.local
    ) {
      return Promise.resolve(cloneDefaultSettings());
    }

    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve(mergeSettings(result[STORAGE_KEY]));
      });
    });
  }

  function dispatchInputEvents(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function resolveElementValuePrototype(element) {
    const ownerWindow =
      element &&
      element.ownerDocument &&
      element.ownerDocument.defaultView
        ? element.ownerDocument.defaultView
        : window;

    if (element.tagName === "TEXTAREA") {
      return ownerWindow.HTMLTextAreaElement.prototype;
    }
    if (element.tagName === "SELECT") {
      return ownerWindow.HTMLSelectElement.prototype;
    }
    return ownerWindow.HTMLInputElement.prototype;
  }

  function setFieldValue(element, value) {
    if (!element || value === "") {
      return false;
    }

    try {
      if (typeof element.focus === "function") {
        element.focus({ preventScroll: true });
      }

      const prototype = resolveElementValuePrototype(element);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

      if (descriptor && typeof descriptor.set === "function") {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }

      dispatchInputEvents(element);
      return true;
    } catch (_error) {
      try {
        element.value = value;
        dispatchInputEvents(element);
        return true;
      } catch (_secondaryError) {
        return false;
      }
    }
  }

  function normalizePurchaseFieldValue(key, rawValue) {
    const value = normalizeString(rawValue);
    if (!value) {
      return "";
    }

    if (key === "birthYear") {
      return value.replace(/\D+/g, "").slice(0, 4);
    }

    if (key === "birthMonth") {
      const numeric = Number.parseInt(value.replace(/\D+/g, ""), 10);
      if (!Number.isFinite(numeric) || numeric < 1 || numeric > 12) {
        return "";
      }
      return String(numeric);
    }

    if (key === "birthDay") {
      const numeric = Number.parseInt(value.replace(/\D+/g, ""), 10);
      if (!Number.isFinite(numeric) || numeric < 1 || numeric > 31) {
        return "";
      }
      return String(numeric);
    }

    if (key === "prefectureCode") {
      return /^prf\d{6}$/i.test(value) ? value.toLowerCase() : "";
    }

    return value;
  }

  function fillPurchaseForm(purchaseSettings) {
    const values = purchaseSettings || {};
    let configured = 0;
    let filled = 0;
    let missing = 0;

    for (const field of PURCHASE_FIELD_MAP) {
      const value = normalizePurchaseFieldValue(field.key, values[field.key]);
      if (!value) {
        continue;
      }

      configured += 1;
      const element = document.querySelector(field.selector);
      if (!element) {
        missing += 1;
        continue;
      }

      if (setFieldValue(element, value)) {
        filled += 1;
      } else {
        missing += 1;
      }
    }

    const gender = normalizeString(values.gender);
    if (gender === "male" || gender === "female") {
      configured += 1;
      const radio = document.querySelector(
        `input[name="personalInfo.genderType"][value="${gender}"]`
      );

      if (!radio) {
        missing += 1;
      } else {
        if (!radio.checked) {
          radio.click();
        }
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        filled += 1;
      }
    }

    return { configured, filled, missing };
  }

  function fillCardFormInDocument(targetDocument, cardSettings) {
    const values = cardSettings || {};
    let configured = 0;
    let filled = 0;
    let missing = 0;

    for (const field of CARD_FIELD_MAP) {
      const value = normalizeString(values[field.key]);
      if (!value) {
        continue;
      }

      configured += 1;
      const element = targetDocument.querySelector(field.selector);
      if (!element) {
        missing += 1;
        continue;
      }

      if (setFieldValue(element, value)) {
        filled += 1;
      } else {
        missing += 1;
      }
    }

    return { configured, filled, missing };
  }

  function collectAccessibleDocuments(rootDocument) {
    const documents = [rootDocument];
    const queue = [rootDocument];
    const visited = new Set([rootDocument]);
    const inaccessibleFrames = [];

    while (queue.length > 0) {
      const current = queue.shift();
      const frames = current.querySelectorAll("iframe, frame");

      for (const frame of frames) {
        try {
          const childDocument = frame.contentDocument;
          if (childDocument && !visited.has(childDocument)) {
            visited.add(childDocument);
            documents.push(childDocument);
            queue.push(childDocument);
          } else if (!childDocument && isCrossOriginFrame(frame)) {
            inaccessibleFrames.push(describeFrame(frame));
          }
        } catch (_error) {
          inaccessibleFrames.push(describeFrame(frame));
        }
      }
    }

    return { documents, inaccessibleFrames };
  }

  function querySelectorInDocuments(documents, selector) {
    for (const currentDocument of documents) {
      const element = currentDocument.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  function isCrossOriginFrame(frame) {
    try {
      const src = frame.getAttribute("src");
      if (!src || src === "about:blank") {
        return false;
      }

      const url = new URL(src, window.location.href);
      return url.origin !== window.location.origin;
    } catch (_error) {
      return false;
    }
  }

  function describeFrame(frame) {
    const id = frame.id ? `#${frame.id}` : "";
    const name = frame.name ? `[name="${frame.name}"]` : "";
    const src = frame.getAttribute("src") || "";
    return `${frame.tagName.toLowerCase()}${id}${name} src=${src}`;
  }

  function isFrameAccessible(frame) {
    if (!frame) {
      return false;
    }

    try {
      return Boolean(frame.contentDocument);
    } catch (_error) {
      return false;
    }
  }

  function fillCardFormLocalAndSameOrigin(cardSettings) {
    const values = cardSettings || {};
    const frameInfo = collectAccessibleDocuments(document);
    const documents = frameInfo.documents;
    const fincodeFrame = document.querySelector("iframe#fincode-ui");
    let configured = 0;
    let filled = 0;
    let missing = 0;

    for (const field of CARD_FIELD_MAP) {
      const value = normalizeString(values[field.key]);
      if (!value) {
        continue;
      }

      configured += 1;
      const element = querySelectorInDocuments(documents, field.selector);
      if (!element) {
        missing += 1;
        continue;
      }

      if (setFieldValue(element, value)) {
        filled += 1;
      } else {
        missing += 1;
      }
    }

    return {
      configured,
      filled,
      missing,
      inaccessibleFrames: frameInfo.inaccessibleFrames,
      fincodeFramePresent: Boolean(fincodeFrame),
      fincodeFrameAccessible: isFrameAccessible(fincodeFrame)
    };
  }

  function getChildFrameWindows() {
    const windows = [];
    const frames = document.querySelectorAll("iframe, frame");
    for (const frame of frames) {
      try {
        if (frame.contentWindow) {
          windows.push(frame.contentWindow);
        }
      } catch (_error) {
        // Ignore inaccessible frame windows.
      }
    }
    return windows;
  }

  function requestCardFillViaMessages(cardSettings, timeoutMs) {
    const frameWindows = getChildFrameWindows();
    const sent = frameWindows.length;
    if (sent === 0) {
      return Promise.resolve({
        sent: 0,
        responders: 0,
        configured: 0,
        filled: 0,
        missing: 0
      });
    }

    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const results = [];

    return new Promise((resolve) => {
      const onMessage = (event) => {
        const data = event.data;
        if (!data || typeof data !== "object") {
          return;
        }
        if (data.source !== MESSAGE_SOURCE || data.type !== MSG_CARD_FILL_RESULT) {
          return;
        }
        if (data.requestId !== requestId) {
          return;
        }

        const result =
          data.result && typeof data.result === "object" ? data.result : {};
        results.push({
          configured: Number(result.configured) || 0,
          filled: Number(result.filled) || 0,
          missing: Number(result.missing) || 0
        });
      };

      window.addEventListener("message", onMessage);

      for (const frameWindow of frameWindows) {
        try {
          frameWindow.postMessage(
            {
              source: MESSAGE_SOURCE,
              type: MSG_CARD_FILL_REQUEST,
              requestId,
              payload: cardSettings || {}
            },
            "*"
          );
        } catch (_error) {
          // Ignore individual frame postMessage failures.
        }
      }

      window.setTimeout(() => {
        window.removeEventListener("message", onMessage);

        let configured = 0;
        let filled = 0;
        let missing = 0;

        for (const result of results) {
          configured = Math.max(configured, result.configured);
          filled = Math.max(filled, result.filled);
          missing = Math.max(missing, result.missing);
        }

        resolve({
          sent,
          responders: results.length,
          configured,
          filled,
          missing
        });
      }, timeoutMs);
    });
  }

  function combineCardResults(localResult, frameMessageResult) {
    const configured = Math.max(localResult.configured, frameMessageResult.configured);
    const filled = Math.min(
      configured,
      localResult.filled + frameMessageResult.filled
    );
    const missing = Math.max(0, configured - filled);

    return {
      configured,
      filled,
      missing,
      inaccessibleFrames: localResult.inaccessibleFrames,
      fincodeFramePresent: localResult.fincodeFramePresent,
      fincodeFrameAccessible: localResult.fincodeFrameAccessible,
      frameMessageSent: frameMessageResult.sent,
      frameMessageResponders: frameMessageResult.responders
    };
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function ensureNewCardModeSelected() {
    const radio = document.querySelector(
      'input[name="revalidateCreditCard"][value="new"]'
    );

    if (!radio) {
      return { present: false, selected: false };
    }

    if (!radio.checked) {
      radio.click();
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    }

    return { present: true, selected: Boolean(radio.checked) };
  }

  async function fillCardFormWithRetry(cardSettings) {
    let latestResult = {
      configured: 0,
      filled: 0,
      missing: 0,
      inaccessibleFrames: [],
      fincodeFramePresent: false,
      fincodeFrameAccessible: false,
      newCardModePresent: false,
      newCardModeSelected: false,
      frameMessageSent: 0,
      frameMessageResponders: 0
    };

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const cardMode = ensureNewCardModeSelected();
      const localResult = fillCardFormLocalAndSameOrigin(cardSettings);
      const frameMessageResult = await requestCardFillViaMessages(
        cardSettings,
        attempt < 4 ? 220 : 140
      );
      latestResult = combineCardResults(localResult, frameMessageResult);
      latestResult.newCardModePresent = cardMode.present;
      latestResult.newCardModeSelected = cardMode.selected;

      if (
        latestResult.configured === 0 ||
        latestResult.filled >= latestResult.configured
      ) {
        return latestResult;
      }

      await sleep(attempt < 4 ? 220 : 150);
    }

    return latestResult;
  }

  function setupCardFrameMessageListener() {
    if (cardFrameMessageListenerBound) {
      return;
    }
    cardFrameMessageListenerBound = true;

    window.addEventListener("message", (event) => {
      // Respond only from iframe contexts. The top page sends requests.
      if (window.top === window.self) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== "object") {
        return;
      }
      if (data.source !== MESSAGE_SOURCE || data.type !== MSG_CARD_FILL_REQUEST) {
        return;
      }

      const requestId = data.requestId;
      if (!requestId) {
        return;
      }

      const cardSettings =
        data.payload && typeof data.payload === "object" ? data.payload : {};
      const result = fillCardFormInDocument(document, cardSettings);

      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            {
              source: MESSAGE_SOURCE,
              type: MSG_CARD_FILL_RESULT,
              requestId,
              result
            },
            "*"
          );
        }
      } catch (_error) {
        // Ignore postMessage failures.
      }
    });
  }

  function ensureToastRoot() {
    let root = document.getElementById(TOAST_ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = TOAST_ROOT_ID;
      root.className = "asv-autofill-toast-root";
      document.documentElement.appendChild(root);
    }
    return root;
  }

  function showToast(message, type) {
    const root = ensureToastRoot();
    const toast = document.createElement("div");
    toast.className = `asv-autofill-toast asv-autofill-toast--${type}`;
    toast.textContent = message;
    root.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add("asv-autofill-toast--hide");
      window.setTimeout(() => {
        toast.remove();
      }, 220);
    }, 2600);
  }

  function resultToMessage(scope, result) {
    if (result.configured === 0) {
      return {
        type: "warn",
        text: `${scope}の設定値がありません。オプションで設定してください。`
      };
    }

    if (result.filled === 0) {
      if (scope === "カード情報") {
        if (result.fincodeFramePresent && !result.fincodeFrameAccessible) {
          if ((result.frameMessageResponders || 0) === 0) {
            return {
              type: "warn",
              text: "カード入力iframeを検出しましたが、入力処理に到達できませんでした。"
            };
          }
        }

        if (result.newCardModePresent && !result.newCardModeSelected) {
          return {
            type: "warn",
            text: "新規カード入力モードへの切り替えに失敗しました。"
          };
        }
      }

      return {
        type: "warn",
        text: `${scope}の入力欄が見つかりませんでした。`
      };
    }

    if (result.missing > 0) {
      return {
        type: "info",
        text: `${scope}を入力しました（入力 ${result.filled} 件 / 未検出 ${result.missing} 件）。`
      };
    }

    return {
      type: "success",
      text: `${scope}を入力しました（${result.filled} 件）。`
    };
  }

  async function onPurchaseButtonClick() {
    const settings = await loadSettings();
    const result = fillPurchaseForm(settings.purchase);
    const message = resultToMessage("購入者情報", result);
    showToast(message.text, message.type);
  }

  async function onCardButtonClick() {
    const settings = await loadSettings();
    const result = await fillCardFormWithRetry(settings.card);

    if (result.filled === 0) {
      console.info("[自動入力診断] カード", {
        fincodeFramePresent: result.fincodeFramePresent,
        fincodeFrameAccessible: result.fincodeFrameAccessible,
        newCardModePresent: result.newCardModePresent,
        newCardModeSelected: result.newCardModeSelected,
        frameMessageSent: result.frameMessageSent,
        frameMessageResponders: result.frameMessageResponders,
        inaccessibleFrames: result.inaccessibleFrames
      });
    }

    const message = resultToMessage("カード情報", result);
    showToast(message.text, message.type);
  }

  function createButton(label, variant, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `asv-autofill-btn asv-autofill-btn--${variant}`;
    button.textContent = label;
    button.addEventListener("click", () => {
      void onClick();
    });
    return button;
  }

  function mountOverlayButtons() {
    if (document.getElementById(ROOT_ID)) {
      return;
    }

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "asv-autofill-root";
    root.appendChild(createButton("購入者情報を入力", "purchase", onPurchaseButtonClick));
    root.appendChild(createButton("カード情報を入力", "card", onCardButtonClick));
    document.documentElement.appendChild(root);
  }

  function isTopWindow() {
    return window.top === window.self;
  }

  function isTargetPage() {
    return (
      isTopWindow() &&
      window.location.href.startsWith("https://www.asoview.com/purchase/")
    );
  }

  function init() {
    setupCardFrameMessageListener();

    if (!isTargetPage()) {
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mountOverlayButtons, {
        once: true
      });
    } else {
      mountOverlayButtons();
    }
  }

  init();
})();

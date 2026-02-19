(() => {
  "use strict";

  const STORAGE_KEY = "asoviewAutofillSettings";
  const AUTO_FILL_MIN_ATTEMPTS = 1;
  const AUTO_FILL_MAX_ATTEMPTS = 60;
  const AUTO_FILL_MIN_DELAY_MS = 80;
  const AUTO_FILL_MAX_DELAY_MS = 3000;

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
    },
    autoFill: {
      enabled: true,
      runPurchase: true,
      runCard: true,
      retryMaxAttempts: 20,
      retryBaseDelayMs: 220
    }
  };

  const ELEMENT_IDS = {
    purchase: {
      lastName: "purchase-last-name",
      firstName: "purchase-first-name",
      lastNameKana: "purchase-last-name-kana",
      firstNameKana: "purchase-first-name-kana",
      phoneHead: "purchase-phone-head",
      phoneCenter: "purchase-phone-center",
      phoneTail: "purchase-phone-tail",
      gender: "purchase-gender",
      birthYear: "purchase-birth-year",
      birthMonth: "purchase-birth-month",
      birthDay: "purchase-birth-day",
      postalHead: "purchase-postal-head",
      postalTail: "purchase-postal-tail",
      prefectureCode: "purchase-prefecture-code",
      addressLine: "purchase-address-line"
    },
    card: {
      number: "card-number",
      expMonth: "card-exp-month",
      expYear: "card-exp-year",
      cvc: "card-cvc",
      holderName: "card-holder-name"
    },
    autoFill: {
      enabled: "auto-fill-enabled",
      runPurchase: "auto-fill-run-purchase",
      runCard: "auto-fill-run-card",
      retryMaxAttempts: "auto-fill-retry-max-attempts",
      retryBaseDelayMs: "auto-fill-retry-base-delay-ms"
    }
  };

  function cloneDefaultSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeBoolean(value, fallback) {
    if (typeof value === "boolean") {
      return value;
    }
    return fallback;
  }

  function normalizeInteger(value, fallback, min, max) {
    let numeric = Number.NaN;

    if (typeof value === "number") {
      numeric = Math.trunc(value);
    } else if (typeof value === "string") {
      numeric = Number.parseInt(value.trim(), 10);
    }

    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, numeric));
  }

  function digitsOnly(value, maxLength) {
    return normalizeText(value).replace(/\D+/g, "").slice(0, maxLength);
  }

  function normalizeYear(value) {
    return digitsOnly(value, 4);
  }

  function normalizeMonthOrDay(value, max) {
    const digits = digitsOnly(value, 2);
    if (!digits) {
      return "";
    }

    const numeric = Number.parseInt(digits, 10);
    if (!Number.isFinite(numeric) || numeric < 1 || numeric > max) {
      return "";
    }

    return String(numeric);
  }

  function normalizePrefectureCode(value) {
    const normalized = normalizeText(value).toLowerCase();
    return /^prf\d{6}$/.test(normalized) ? normalized : "";
  }

  function mergeSettings(raw) {
    const merged = cloneDefaultSettings();
    if (!raw || typeof raw !== "object") {
      return merged;
    }

    if (raw.purchase && typeof raw.purchase === "object") {
      for (const key of Object.keys(merged.purchase)) {
        merged.purchase[key] = normalizeText(raw.purchase[key]);
      }
    }

    if (raw.card && typeof raw.card === "object") {
      for (const key of Object.keys(merged.card)) {
        merged.card[key] = normalizeText(raw.card[key]);
      }
    }

    if (raw.autoFill && typeof raw.autoFill === "object") {
      merged.autoFill.enabled = normalizeBoolean(
        raw.autoFill.enabled,
        merged.autoFill.enabled
      );
      merged.autoFill.runPurchase = normalizeBoolean(
        raw.autoFill.runPurchase,
        merged.autoFill.runPurchase
      );
      merged.autoFill.runCard = normalizeBoolean(
        raw.autoFill.runCard,
        merged.autoFill.runCard
      );
      merged.autoFill.retryMaxAttempts = normalizeInteger(
        raw.autoFill.retryMaxAttempts,
        merged.autoFill.retryMaxAttempts,
        AUTO_FILL_MIN_ATTEMPTS,
        AUTO_FILL_MAX_ATTEMPTS
      );
      merged.autoFill.retryBaseDelayMs = normalizeInteger(
        raw.autoFill.retryBaseDelayMs,
        merged.autoFill.retryBaseDelayMs,
        AUTO_FILL_MIN_DELAY_MS,
        AUTO_FILL_MAX_DELAY_MS
      );
    }

    return merged;
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function setFormValue(id, value) {
    const element = getElement(id);
    if (element) {
      element.value = String(value);
    }
  }

  function getFormValue(id) {
    const element = getElement(id);
    return element ? normalizeText(element.value) : "";
  }

  function setCheckboxValue(id, checked) {
    const element = getElement(id);
    if (element) {
      element.checked = Boolean(checked);
    }
  }

  function getCheckboxValue(id) {
    const element = getElement(id);
    return Boolean(element && element.checked);
  }

  function applySettingsToForm(settings) {
    const merged = mergeSettings(settings);

    for (const [key, id] of Object.entries(ELEMENT_IDS.purchase)) {
      setFormValue(id, merged.purchase[key]);
    }
    for (const [key, id] of Object.entries(ELEMENT_IDS.card)) {
      setFormValue(id, merged.card[key]);
    }

    setCheckboxValue(ELEMENT_IDS.autoFill.enabled, merged.autoFill.enabled);
    setCheckboxValue(ELEMENT_IDS.autoFill.runPurchase, merged.autoFill.runPurchase);
    setCheckboxValue(ELEMENT_IDS.autoFill.runCard, merged.autoFill.runCard);
    setFormValue(
      ELEMENT_IDS.autoFill.retryMaxAttempts,
      merged.autoFill.retryMaxAttempts
    );
    setFormValue(
      ELEMENT_IDS.autoFill.retryBaseDelayMs,
      merged.autoFill.retryBaseDelayMs
    );
  }

  function readSettingsFromForm() {
    const purchaseGenderRaw = getFormValue(ELEMENT_IDS.purchase.gender);
    const purchaseGender =
      purchaseGenderRaw === "male" || purchaseGenderRaw === "female"
        ? purchaseGenderRaw
        : "";

    return {
      purchase: {
        lastName: getFormValue(ELEMENT_IDS.purchase.lastName),
        firstName: getFormValue(ELEMENT_IDS.purchase.firstName),
        lastNameKana: getFormValue(ELEMENT_IDS.purchase.lastNameKana),
        firstNameKana: getFormValue(ELEMENT_IDS.purchase.firstNameKana),
        phoneHead: digitsOnly(getFormValue(ELEMENT_IDS.purchase.phoneHead), 6),
        phoneCenter: digitsOnly(getFormValue(ELEMENT_IDS.purchase.phoneCenter), 6),
        phoneTail: digitsOnly(getFormValue(ELEMENT_IDS.purchase.phoneTail), 6),
        gender: purchaseGender,
        birthYear: normalizeYear(getFormValue(ELEMENT_IDS.purchase.birthYear)),
        birthMonth: normalizeMonthOrDay(
          getFormValue(ELEMENT_IDS.purchase.birthMonth),
          12
        ),
        birthDay: normalizeMonthOrDay(
          getFormValue(ELEMENT_IDS.purchase.birthDay),
          31
        ),
        postalHead: digitsOnly(getFormValue(ELEMENT_IDS.purchase.postalHead), 3),
        postalTail: digitsOnly(getFormValue(ELEMENT_IDS.purchase.postalTail), 4),
        prefectureCode: normalizePrefectureCode(
          getFormValue(ELEMENT_IDS.purchase.prefectureCode)
        ),
        addressLine: getFormValue(ELEMENT_IDS.purchase.addressLine)
      },
      card: {
        number: digitsOnly(getFormValue(ELEMENT_IDS.card.number), 19),
        expMonth: digitsOnly(getFormValue(ELEMENT_IDS.card.expMonth), 2),
        expYear: digitsOnly(getFormValue(ELEMENT_IDS.card.expYear), 2),
        cvc: digitsOnly(getFormValue(ELEMENT_IDS.card.cvc), 4),
        holderName: getFormValue(ELEMENT_IDS.card.holderName)
      },
      autoFill: {
        enabled: getCheckboxValue(ELEMENT_IDS.autoFill.enabled),
        runPurchase: getCheckboxValue(ELEMENT_IDS.autoFill.runPurchase),
        runCard: getCheckboxValue(ELEMENT_IDS.autoFill.runCard),
        retryMaxAttempts: normalizeInteger(
          getFormValue(ELEMENT_IDS.autoFill.retryMaxAttempts),
          DEFAULT_SETTINGS.autoFill.retryMaxAttempts,
          AUTO_FILL_MIN_ATTEMPTS,
          AUTO_FILL_MAX_ATTEMPTS
        ),
        retryBaseDelayMs: normalizeInteger(
          getFormValue(ELEMENT_IDS.autoFill.retryBaseDelayMs),
          DEFAULT_SETTINGS.autoFill.retryBaseDelayMs,
          AUTO_FILL_MIN_DELAY_MS,
          AUTO_FILL_MAX_DELAY_MS
        )
      }
    };
  }

  function showStatus(message, type) {
    const status = getElement("status");
    if (!status) {
      return;
    }
    status.textContent = message;
    status.classList.remove("success", "error");
    if (type) {
      status.classList.add(type);
    }
  }

  function storageGet() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          resolve(cloneDefaultSettings());
          return;
        }
        resolve(mergeSettings(result[STORAGE_KEY]));
      });
    });
  }

  function storageSet(settings) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });
  }

  async function load() {
    const stored = await storageGet();
    applySettingsToForm(stored);
  }

  async function onSubmit(event) {
    event.preventDefault();
    const settings = readSettingsFromForm();
    applySettingsToForm(settings);

    try {
      await storageSet(settings);
      showStatus("保存しました。", "success");
    } catch (_error) {
      showStatus("保存に失敗しました。", "error");
    }
  }

  async function onReset() {
    const defaults = cloneDefaultSettings();
    applySettingsToForm(defaults);

    try {
      await storageSet(defaults);
      showStatus("空欄にリセットしました。", "success");
    } catch (_error) {
      showStatus("リセットに失敗しました。", "error");
    }
  }

  function bindEvents() {
    const form = getElement("settings-form");
    const resetButton = getElement("reset-button");

    if (form) {
      form.addEventListener("submit", (event) => {
        void onSubmit(event);
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        void onReset();
      });
    }
  }

  async function init() {
    bindEvents();
    await load();
  }

  void init();
})();

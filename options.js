(() => {
  "use strict";

  const STORAGE_KEY = "asoviewAutofillSettings";

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
    }
  };

  function cloneDefaultSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
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

    return merged;
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function setFormValue(id, value) {
    const element = getElement(id);
    if (element) {
      element.value = value;
    }
  }

  function getFormValue(id) {
    const element = getElement(id);
    return element ? normalizeText(element.value) : "";
  }

  function applySettingsToForm(settings) {
    const merged = mergeSettings(settings);

    for (const [key, id] of Object.entries(ELEMENT_IDS.purchase)) {
      setFormValue(id, merged.purchase[key]);
    }
    for (const [key, id] of Object.entries(ELEMENT_IDS.card)) {
      setFormValue(id, merged.card[key]);
    }
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

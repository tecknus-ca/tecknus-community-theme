import { apiInitializer } from "discourse/lib/api";

const COPY = {
  en: {
    proposal: "The proposal",
    about: "About me",
    community: "Community",
    contact: "Contact",
    privacy: "Privacy",
    language: "Language",
    or: "OR",
  },
  fr: {
    proposal: "La démarche",
    about: "À propos de moi",
    community: "Communauté",
    contact: "Contact",
    privacy: "Confidentialité",
    language: "Langue",
    or: "OU",
  },
  pt: {
    proposal: "A proposta",
    about: "Sobre mim",
    community: "Comunidade",
    contact: "Contato",
    privacy: "Privacidade",
    language: "Idioma",
    or: "OU",
  },
};

const MARKETING = "https://tecknus.ca";

function themeUpload(name) {
  const uploads = typeof settings !== "undefined" ? settings.theme_uploads : null;
  if (!uploads) {
    return "";
  }
  const value = uploads[name];
  return typeof value === "string" ? value : "";
}

function bindThemeAssets() {
  document.querySelectorAll("[data-tecknus-asset]").forEach((img) => {
    const url = themeUpload(img.getAttribute("data-tecknus-asset"));
    if (url) {
      img.setAttribute("src", url);
    }
  });
}
const SUPPORTED = ["en", "fr", "pt"];

let themeApi = null;

function normalizeLocale(value) {
  const lang = String(value || "").toLowerCase().replace("_", "-");
  if (lang.startsWith("pt")) {
    return "pt";
  }
  if (lang.startsWith("fr")) {
    return "fr";
  }
  if (lang.startsWith("en")) {
    return "en";
  }
  return null;
}

function cookieLocale() {
  const match = document.cookie.match(/(?:^|; )locale=([^;]*)/);
  return match ? normalizeLocale(decodeURIComponent(match[1])) : null;
}

function browserLocale() {
  const languages = navigator.languages || [navigator.language || ""];
  for (const language of languages) {
    const supported = normalizeLocale(language);
    if (supported) {
      return supported;
    }
  }
  return "en";
}

function rememberLocale(lang, manual) {
  document.cookie = `locale=${lang};path=/;max-age=31536000;SameSite=Lax`;
  document.cookie = manual
    ? "tecknus_locale_manual=1;path=/;max-age=31536000;SameSite=Lax"
    : "tecknus_locale_manual=;path=/;max-age=0;SameSite=Lax";
}

function manualChoice() {
  return /(?:^|; )tecknus_locale_manual=1(?:;|$)/.test(document.cookie);
}

function transmittedLocale() {
  return normalizeLocale(new URLSearchParams(location.search).get("tl"));
}

function currentUser() {
  if (!themeApi || typeof themeApi.getCurrentUser !== "function") {
    return null;
  }
  return themeApi.getCurrentUser();
}

async function saveAccountLocale(lang) {
  const user = currentUser();
  if (!user || !SUPPORTED.includes(lang) || normalizeLocale(user.locale) === lang) {
    return true;
  }
  const token = document
    .querySelector("meta[name='csrf-token']")
    ?.getAttribute("content");
  if (!token) {
    return false;
  }
  const response = await fetch(`/u/${user.username}.json`, {
    method: "PUT",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": token,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ locale: lang }),
  });
  return response.ok;
}

function noteTransmittedLocale() {
  const transmitted = transmittedLocale();
  if (transmitted) {
    rememberLocale(transmitted, true);
  }
}

async function syncAccountLocale() {
  const user = currentUser();
  if (!user) {
    return;
  }
  const transmitted = transmittedLocale();
  const account = normalizeLocale(user.locale);
  const saved = cookieLocale();
  const target =
    transmitted || (manualChoice() && saved) || account || saved || browserLocale();
  if (account !== target) {
    const guard = `tecknus-locale:${target}`;
    if (sessionStorage.getItem(guard) === "1") {
      return;
    }
    sessionStorage.setItem(guard, "1");
    const savedOk = await saveAccountLocale(target);
    if (!savedOk) {
      sessionStorage.removeItem(guard);
      return;
    }
    rememberLocale(target, false);
    if (!document.documentElement.lang?.toLowerCase().startsWith(target)) {
      window.location.reload();
    }
    return;
  }
  if (saved !== account || manualChoice()) {
    rememberLocale(account || target, false);
  }
}

function locale() {
  const lang = (document.documentElement.lang || "en").toLowerCase();
  if (lang.startsWith("fr")) {
    return "fr";
  }
  if (lang.startsWith("pt")) {
    return "pt";
  }
  return "en";
}

function applyChrome() {
  bindThemeAssets();
  const lang = locale();
  const copy = COPY[lang];
  document.querySelectorAll("[data-auth-nav]").forEach((link) => {
    const key = link.getAttribute("data-auth-nav");
    if (copy[key]) {
      link.textContent = copy[key];
    }
    if (key === "community") {
      link.setAttribute("href", "https://community.tecknus.ca");
      return;
    }
    link.setAttribute("href", `${MARKETING}/${lang}/${key}`);
  });
  document.querySelectorAll("[data-auth-home]").forEach((link) => {
    link.setAttribute("href", `${MARKETING}/${lang}`);
  });
  document.querySelectorAll(".tecknus-auth-lang").forEach((select) => {
    select.setAttribute("aria-label", copy.language);
    if (select.value !== lang) {
      select.value = lang;
    }
    if (select.dataset.tecknusBound === "1") {
      return;
    }
    select.dataset.tecknusBound = "1";
    select.addEventListener("change", async () => {
      const next = normalizeLocale(select.value) || "en";
      rememberLocale(next, true);
      await saveAccountLocale(next);
      const url = new URL(window.location.href);
      url.searchParams.set("tl", next);
      window.location.assign(url.toString());
    });
  });

  document.querySelectorAll(".login-body, .signup-body").forEach((body) => {
    const right = body.querySelector(".login-right-side");
    const hasButton = right && right.querySelector("button, .btn, a");
    const title = body.querySelector(".login-welcome-header");
    if (right && title && title.nextElementSibling !== right) {
      title.insertAdjacentElement("afterend", right);
    }
    const current = body.querySelector(".tecknus-auth-or");
    if (!hasButton) {
      current?.remove();
      return;
    }
    const divider = current || document.createElement("div");
    divider.className = "tecknus-auth-or";
    divider.textContent = copy.or;
    if (!current) {
      right.insertAdjacentElement("afterend", divider);
    }
  });

  const forgot = document.querySelector(".login__password-links");
  const loginCta = document.querySelector(".login-page-cta");
  if (forgot && loginCta && loginCta.nextElementSibling !== forgot) {
    loginCta.insertAdjacentElement("afterend", forgot);
  }
}

export default apiInitializer((api) => {
  themeApi = api;
  noteTransmittedLocale();
  syncAccountLocale();
  api.onPageChange(() => {
    noteTransmittedLocale();
    applyChrome();
    syncAccountLocale();
  });
  applyChrome();
});

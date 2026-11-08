const STRINGS = {
  en: {
    brand: "Secret Santa",
    tagline: "A fair draw for your family gift exchange.",
    langToggle: "Español",
    homeCreateTitle: "Start an exchange",
    homeCreateHint: "You’ll be the moderator. Share private links after the draw.",
    exchangeName: "Exchange name",
    exchangeNamePh: "Family Christmas 2026",
    moderatorPin: "Moderator PIN",
    pinHint: "4–8 digits. Keep this private.",
    createBtn: "Create exchange",
    homeJoinTitle: "I have a private link",
    homeJoinHint: "Open the link your moderator sent, or enter your code.",
    codeLabel: "Your private code",
    codePh: "Paste code",
    openReveal: "See who I give to",
    openExchange: "Open my exchange",
    exchangeIdLabel: "Exchange ID",
    pinLabel: "Moderator PIN",
    unlockBtn: "Unlock as moderator",
    participants: "Participants",
    addPerson: "Add person",
    namePh: "First name",
    addBtn: "Add",
    emptyPeople: "Add everyone who is exchanging gifts.",
    exclusions: "Exclusions",
    exclusionsHint: "Choose pairs who must not draw each other (optional).",
    fromLabel: "This person",
    mustNot: "must not draw",
    addExclusion: "Add exclusion",
    noExclusions: "No exclusions yet.",
    drawTitle: "Run the draw",
    drawHint: "Everyone gets one person to gift. Assignments stay secret.",
    drawBtn: "Draw names",
    redrawLocked: "Draw complete — assignments are locked for secrecy.",
    shareTitle: "Share private links",
    shareHint: "Send each person only their own link. They will see only who they gift.",
    copyLink: "Copy link",
    copied: "Copied!",
    revealWaitingTitle: "Not drawn yet",
    revealWaiting: "The moderator hasn’t run the draw. Check back soon.",
    revealReadyTitle: "You are gifting",
    revealFor: "Hi {name} — for {exchange}",
    revealSecret: "Keep this to yourself.",
    backHome: "Home",
    remove: "Remove",
    statusSetup: "Setup",
    statusDrawn: "Drawn",
    needTwo: "Add at least two people before drawing.",
    impossible: "No fair draw is possible with these exclusions. Relax a rule and try again.",
    badPin: "Wrong PIN.",
    notFound: "Not found.",
    duplicate: "That name is already on the list.",
    alreadyDrawn: "This exchange is already drawn.",
    created: "Exchange created.",
    drawnOk: "Draw complete! Share each person’s private link.",
    errorGeneric: "Something went wrong. Try again.",
    invalidPin: "PIN must be 4–8 digits.",
    invalidName: "Enter a valid name.",
    selectBoth: "Choose both people.",
    loading: "Loading…",
    peopleCount: "{n} people",
  },
  es: {
    brand: "Amigo Secreto",
    tagline: "Un sorteo justo para el intercambio familiar.",
    langToggle: "English",
    homeCreateTitle: "Crear un intercambio",
    homeCreateHint: "Serás el moderador. Comparte enlaces privados después del sorteo.",
    exchangeName: "Nombre del intercambio",
    exchangeNamePh: "Navidad familiar 2026",
    moderatorPin: "PIN de moderador",
    pinHint: "4–8 dígitos. Guárdalo en privado.",
    createBtn: "Crear intercambio",
    homeJoinTitle: "Tengo un enlace privado",
    homeJoinHint: "Abre el enlace que te envió el moderador, o escribe tu código.",
    codeLabel: "Tu código privado",
    codePh: "Pega el código",
    openReveal: "Ver a quién regalo",
    openExchange: "Abrir mi intercambio",
    exchangeIdLabel: "ID del intercambio",
    pinLabel: "PIN de moderador",
    unlockBtn: "Entrar como moderador",
    participants: "Participantes",
    addPerson: "Añadir persona",
    namePh: "Nombre",
    addBtn: "Añadir",
    emptyPeople: "Añade a todos los que intercambian regalos.",
    exclusions: "Exclusiones",
    exclusionsHint: "Elige parejas que no deben sacarse entre sí (opcional).",
    fromLabel: "Esta persona",
    mustNot: "no debe sacar a",
    addExclusion: "Añadir exclusión",
    noExclusions: "Sin exclusiones todavía.",
    drawTitle: "Hacer el sorteo",
    drawHint: "Cada uno regala a una persona. Las asignaciones permanecen en secreto.",
    drawBtn: "Sortear nombres",
    redrawLocked: "Sorteo listo — las asignaciones están bloqueadas por secreto.",
    shareTitle: "Comparte enlaces privados",
    shareHint: "Envía a cada persona solo su enlace. Verán únicamente a quién regalan.",
    copyLink: "Copiar enlace",
    copied: "¡Copiado!",
    revealWaitingTitle: "Aún no hay sorteo",
    revealWaiting: "El moderador todavía no ha sorteado. Vuelve pronto.",
    revealReadyTitle: "Tú regalas a",
    revealFor: "Hola {name} — para {exchange}",
    revealSecret: "Guárdalo solo para ti.",
    backHome: "Inicio",
    remove: "Quitar",
    statusSetup: "Preparación",
    statusDrawn: "Sorteado",
    needTwo: "Añade al menos dos personas antes de sortear.",
    impossible: "No hay un sorteo válido con estas exclusiones. Relaja una regla e inténtalo de nuevo.",
    badPin: "PIN incorrecto.",
    notFound: "No encontrado.",
    duplicate: "Ese nombre ya está en la lista.",
    alreadyDrawn: "Este intercambio ya está sorteado.",
    created: "Intercambio creado.",
    drawnOk: "¡Sorteo listo! Comparte el enlace privado de cada persona.",
    errorGeneric: "Algo salió mal. Inténtalo de nuevo.",
    invalidPin: "El PIN debe tener 4–8 dígitos.",
    invalidName: "Escribe un nombre válido.",
    selectBoth: "Elige ambas personas.",
    loading: "Cargando…",
    peopleCount: "{n} personas",
  },
};

function detectLang() {
  const saved = localStorage.getItem("ss-lang");
  if (saved === "en" || saved === "es") return saved;
  const nav = (navigator.language || "en").toLowerCase();
  return nav.startsWith("es") ? "es" : "en";
}

let current = detectLang();

export function getLang() {
  return current;
}

export function setLang(lang) {
  current = lang === "es" ? "es" : "en";
  localStorage.setItem("ss-lang", current);
  document.documentElement.lang = current;
}

export function t(key, vars = {}) {
  const table = STRINGS[current] || STRINGS.en;
  let text = table[key] ?? STRINGS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

export function applyStaticI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
}

setLang(current);

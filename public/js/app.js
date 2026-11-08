import { currencyOptionsHtml, formatBudget } from "./currencies.js";
import { applyStaticI18n, getLang, setLang, t } from "./i18n.js";

const view = document.getElementById("view");
const toastEl = document.getElementById("toast");
const langToggle = document.getElementById("langToggle");
const backHome = document.getElementById("backHome");

const PIN_KEY = (id) => `ss-pin:${id}`;
const POLL_MS = 4000;

let pollTimer = null;
let activeExchangeId = null;

function clearPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  activeExchangeId = null;
}

function route() {
  const hash = location.hash.slice(1) || "/";
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "e" && parts[1]) return { name: "exchange", id: parts[1] };
  if (parts[0] === "r" && parts[1]) return { name: "reveal", code: parts[1] };
  return { name: "home" };
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 2800);
}

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
  } catch {
    const err = new Error("network");
    err.code = "network";
    throw err;
  }
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const err = new Error("bad_response");
      err.code = "bad_response";
      err.status = res.status;
      throw err;
    }
  }
  if (!res.ok) {
    const err = new Error(data.error || "error");
    err.code = data.error || "server_error";
    err.status = res.status;
    throw err;
  }
  return data;
}

function mapError(code) {
  const map = {
    bad_pin: "badPin",
    not_found: "notFound",
    duplicate_name: "duplicate",
    already_drawn: "alreadyDrawn",
    need_two: "needTwo",
    impossible_draw: "impossible",
    invalid_pin: "invalidPin",
    invalid_name: "invalidName",
    invalid_budget: "invalidBudget",
    invalid_currency: "invalidBudget",
    network: "errorNetwork",
    bad_response: "errorGeneric",
    server_error: "errorGeneric",
    route_not_found: "errorGeneric",
  };
  return t(map[code] || "errorGeneric");
}

function extractPrivateCode(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const hashMatch = value.match(/#\/r\/([^/?#\s]+)/i);
  if (hashMatch) {
    try {
      return decodeURIComponent(hashMatch[1]);
    } catch {
      return hashMatch[1];
    }
  }
  const pathMatch = value.match(/\/r\/([^/?#\s]+)/i);
  if (pathMatch) {
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch {
      return pathMatch[1];
    }
  }
  return value;
}

function revealUrl(code) {
  return `${location.origin}${location.pathname}#/r/${code}`;
}

function budgetFromForm(root) {
  const enabled = root.querySelector("#budgetEnabled")?.checked;
  if (!enabled) return null;
  const amount = Number(root.querySelector("#budgetAmount")?.value);
  const currency = String(root.querySelector("#budgetCurrency")?.value || "USD");
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error("invalid_budget");
    err.code = "invalid_budget";
    throw err;
  }
  return { amount, currency };
}

function wireBudgetToggle(root) {
  const toggle = root.querySelector("#budgetEnabled");
  const fields = root.querySelector("#budgetFields");
  if (!toggle || !fields) return;
  const sync = () => fields.classList.toggle("hidden", !toggle.checked);
  toggle.addEventListener("change", sync);
  sync();
}

function trackingBadges(p) {
  if (p.revealedAt) {
    return `<span class="track-badge opened">${escapeHtml(t("statusOpened"))}</span>`;
  }
  if (p.linkSentAt) {
    return `<span class="track-badge sent">${escapeHtml(t("statusLinkSent"))}</span>`;
  }
  return `<span class="track-badge pending">${escapeHtml(t("statusLinkPending"))}</span>`;
}

function shareListHtml(participants) {
  return participants
    .map(
      (p) => `<li data-pid="${escapeHtml(p.id)}">
        <div class="share-meta">
          <div class="person-name">${escapeHtml(p.name)}</div>
          <div class="track-row">${trackingBadges(p)}</div>
          <div class="muted share-url">${escapeHtml(revealUrl(p.code))}</div>
        </div>
        <div class="share-actions">
          <button type="button" class="btn btn-ghost" data-copy="${escapeHtml(p.code)}" data-pid="${escapeHtml(p.id)}" data-i18n="copyLink"></button>
          ${
            p.linkSentAt
              ? ""
              : `<button type="button" class="btn btn-ghost" data-sent="${escapeHtml(p.id)}" data-i18n="markSent"></button>`
          }
        </div>
      </li>`
    )
    .join("");
}

function updateShareTracking(participants) {
  const list = document.getElementById("shareList");
  if (!list) return;
  for (const p of participants) {
    const li = list.querySelector(`li[data-pid="${CSS.escape(p.id)}"]`);
    if (!li) continue;
    const row = li.querySelector(".track-row");
    if (row) row.innerHTML = trackingBadges(p);
    const sentBtn = li.querySelector("[data-sent]");
    if (p.linkSentAt && sentBtn) sentBtn.remove();
  }
}

/* ---------- Views ---------- */

function renderHome() {
  clearPoll();
  backHome.classList.add("hidden");
  view.innerHTML = `
    <section class="hero">
      <h1 class="brand" data-i18n="brand"></h1>
      <p class="tagline" data-i18n="tagline"></p>
    </section>

    <section class="panel panel-primary">
      <h2 data-i18n="homeCreateTitle"></h2>
      <p class="hint" data-i18n="homeCreateHint"></p>
      <form id="createForm">
        <div class="field">
          <label for="exName" data-i18n="exchangeName"></label>
          <input id="exName" name="name" required maxlength="80" data-i18n-placeholder="exchangeNamePh" />
        </div>
        <div class="field">
          <label for="exPin" data-i18n="moderatorPin"></label>
          <input id="exPin" name="pin" inputmode="numeric" pattern="\\d{4,8}" required maxlength="8" autocomplete="off" />
          <span class="help" data-i18n="pinHint"></span>
        </div>
        <div class="budget-block">
          <label class="check-row">
            <input type="checkbox" id="budgetEnabled" />
            <span data-i18n="budgetEnable"></span>
          </label>
          <div id="budgetFields" class="budget-fields hidden">
            <p class="hint" data-i18n="budgetHint"></p>
            <div class="row">
              <div class="field">
                <label for="budgetAmount" data-i18n="budgetAmount"></label>
                <input id="budgetAmount" name="amount" inputmode="decimal" min="1" step="any" />
              </div>
              <div class="field">
                <label for="budgetCurrency" data-i18n="budgetCurrency"></label>
                <select id="budgetCurrency" name="currency">${currencyOptionsHtml("USD")}</select>
              </div>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" type="submit" data-i18n="createBtn"></button>
      </form>
    </section>

    <div class="join-wrap">
      <button type="button" class="join-toggle" id="joinToggle" aria-expanded="false">
        <span data-i18n="homeJoinToggle"></span>
        <span class="join-caret" aria-hidden="true">+</span>
      </button>
      <section class="panel panel-join hidden" id="joinPanel">
        <h2 data-i18n="homeJoinTitle"></h2>
        <p class="hint" data-i18n="homeJoinHint"></p>
        <form id="codeForm">
          <div class="field">
            <label for="code" data-i18n="codeLabel"></label>
            <input id="code" name="code" required data-i18n-placeholder="codePh" autocomplete="off" />
          </div>
          <button class="btn btn-secondary" type="submit" data-i18n="openReveal"></button>
        </form>
        <div class="divider"></div>
        <form id="modForm">
          <div class="field">
            <label for="modId" data-i18n="exchangeIdLabel"></label>
            <input id="modId" name="id" required autocomplete="off" />
          </div>
          <div class="field">
            <label for="modPin" data-i18n="pinLabel"></label>
            <input id="modPin" name="pin" inputmode="numeric" required maxlength="8" autocomplete="off" />
          </div>
          <button class="btn btn-ghost" type="submit" data-i18n="unlockBtn"></button>
        </form>
      </section>
    </div>
  `;
  applyStaticI18n(view);
  wireBudgetToggle(view);

  const joinToggle = document.getElementById("joinToggle");
  const joinPanel = document.getElementById("joinPanel");
  joinToggle.addEventListener("click", () => {
    const open = joinPanel.classList.toggle("hidden") === false;
    joinToggle.setAttribute("aria-expanded", open ? "true" : "false");
    joinToggle.querySelector(".join-caret").textContent = open ? "−" : "+";
  });

  document.getElementById("createForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get("name") || "").trim();
    const pin = String(fd.get("pin") || "").trim();
    if (!/^\d{4,8}$/.test(pin)) {
      showToast(t("invalidPin"));
      return;
    }
    let budget = null;
    try {
      budget = budgetFromForm(e.target);
    } catch (err) {
      showToast(mapError(err.code));
      return;
    }
    try {
      const data = await api("/exchanges", {
        method: "POST",
        body: JSON.stringify({ name, pin, budget }),
      });
      sessionStorage.setItem(PIN_KEY(data.exchange.id), pin);
      showToast(t("created"));
      location.hash = `#/e/${data.exchange.id}`;
    } catch (err) {
      showToast(mapError(err.code));
    }
  });

  document.getElementById("codeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = extractPrivateCode(new FormData(e.target).get("code"));
    if (!code) {
      showToast(t("invalidCode"));
      return;
    }
    location.hash = `#/r/${encodeURIComponent(code)}`;
  });

  document.getElementById("modForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = String(fd.get("id") || "").trim();
    const pin = String(fd.get("pin") || "").trim();
    try {
      await api(`/exchanges/${encodeURIComponent(id)}/unlock`, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      sessionStorage.setItem(PIN_KEY(id), pin);
      location.hash = `#/e/${id}`;
    } catch (err) {
      showToast(mapError(err.code));
    }
  });
}

function startTrackingPoll(id, pin) {
  clearPoll();
  activeExchangeId = id;
  pollTimer = setInterval(async () => {
    if (activeExchangeId !== id) return;
    try {
      const data = await api(`/exchanges/${encodeURIComponent(id)}/unlock`, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      if (activeExchangeId !== id) return;
      if (data.exchange?.status === "drawn") {
        updateShareTracking(data.exchange.participants);
      }
    } catch {
      /* keep last known UI */
    }
  }, POLL_MS);
}

async function renderExchange(id) {
  clearPoll();
  backHome.classList.remove("hidden");
  view.innerHTML = `<section class="panel"><p class="muted" data-i18n="loading"></p></section>`;
  applyStaticI18n(view);

  let pin = sessionStorage.getItem(PIN_KEY(id)) || "";
  let data;
  try {
    if (pin) {
      data = await api(`/exchanges/${encodeURIComponent(id)}/unlock`, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
    } else {
      view.innerHTML = `
        <section class="hero">
          <h1 class="brand" data-i18n="brand"></h1>
        </section>
        <section class="panel">
          <h2 data-i18n="unlockBtn"></h2>
          <form id="unlockForm">
            <div class="field">
              <label for="pin" data-i18n="pinLabel"></label>
              <input id="pin" name="pin" inputmode="numeric" required maxlength="8" autocomplete="off" />
            </div>
            <button class="btn btn-primary" type="submit" data-i18n="unlockBtn"></button>
          </form>
        </section>`;
      applyStaticI18n(view);
      document.getElementById("unlockForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const p = String(new FormData(e.target).get("pin") || "").trim();
        try {
          await api(`/exchanges/${encodeURIComponent(id)}/unlock`, {
            method: "POST",
            body: JSON.stringify({ pin: p }),
          });
          sessionStorage.setItem(PIN_KEY(id), p);
          renderExchange(id);
        } catch (err) {
          showToast(mapError(err.code));
        }
      });
      return;
    }
  } catch (err) {
    sessionStorage.removeItem(PIN_KEY(id));
    showToast(mapError(err.code));
    location.hash = "#/";
    return;
  }

  const ex = data.exchange;
  const drawn = ex.status === "drawn";
  const peopleOptions = ex.participants
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join("");
  const budgetText = ex.budget
    ? t("budgetLabel", { amount: formatBudget(ex.budget, getLang()) })
    : "";
  const selectedCurrency = ex.budget?.currency || "USD";

  view.innerHTML = `
    <section class="panel">
      <div class="exchange-head">
        <div>
          <h1>${escapeHtml(ex.name)}</h1>
          <p class="muted">${t("peopleCount", { n: ex.participants.length })} · ID ${escapeHtml(ex.id)}</p>
          ${budgetText ? `<p class="budget-pill">${escapeHtml(budgetText)}</p>` : ""}
        </div>
        <span class="badge ${drawn ? "drawn" : ""}">${drawn ? t("statusDrawn") : t("statusSetup")}</span>
      </div>
    </section>

    <section class="panel" id="peopleSection">
      <div class="section-label">
        <h2 data-i18n="participants"></h2>
      </div>
      ${
        drawn
          ? ""
          : `<form id="addForm" class="row" style="margin-bottom:0.85rem">
              <div class="field">
                <label class="hidden" for="pname" data-i18n="addPerson"></label>
                <input id="pname" name="name" required maxlength="60" data-i18n-placeholder="namePh" />
              </div>
              <button class="btn btn-secondary" type="submit" data-i18n="addBtn"></button>
            </form>`
      }
      <ul class="people-list" id="peopleList">
        ${
          ex.participants.length
            ? ex.participants
                .map(
                  (p) => `<li>
                    <span class="person-name">${escapeHtml(p.name)}</span>
                    ${
                      drawn
                        ? ""
                        : `<button type="button" class="btn-danger" data-remove="${p.id}" data-i18n="remove"></button>`
                    }
                  </li>`
                )
                .join("")
            : `<li class="muted" data-i18n="emptyPeople"></li>`
        }
      </ul>
    </section>

    ${
      drawn
        ? ""
        : `<section class="panel">
      <h2 data-i18n="budgetTitle"></h2>
      <p class="hint" data-i18n="budgetHint"></p>
      <form id="budgetForm">
        <label class="check-row">
          <input type="checkbox" id="budgetEnabled" ${ex.budget ? "checked" : ""} />
          <span data-i18n="budgetEnable"></span>
        </label>
        <div id="budgetFields" class="budget-fields ${ex.budget ? "" : "hidden"}">
          <div class="row">
            <div class="field">
              <label for="budgetAmount" data-i18n="budgetAmount"></label>
              <input id="budgetAmount" name="amount" inputmode="decimal" min="1" step="any" value="${ex.budget ? escapeHtml(String(ex.budget.amount)) : ""}" />
            </div>
            <div class="field">
              <label for="budgetCurrency" data-i18n="budgetCurrency"></label>
              <select id="budgetCurrency" name="currency">${currencyOptionsHtml(selectedCurrency)}</select>
            </div>
          </div>
        </div>
        <div class="row budget-actions">
          <button class="btn btn-secondary" type="submit" data-i18n="budgetSave"></button>
          <button class="btn btn-ghost" type="button" id="budgetClearBtn" data-i18n="budgetClear"></button>
        </div>
      </form>
    </section>

    <section class="panel">
      <h2 data-i18n="exclusions"></h2>
      <p class="hint" data-i18n="exclusionsHint"></p>
      <div class="exclusion-form">
        <div class="field">
          <label data-i18n="fromLabel"></label>
          <select id="exFrom"><option value="">—</option>${peopleOptions}</select>
        </div>
        <div class="must-not" data-i18n="mustNot"></div>
        <div class="field">
          <label class="hidden">to</label>
          <select id="exTo"><option value="">—</option>${peopleOptions}</select>
        </div>
        <button type="button" class="btn btn-ghost" id="addExcl" data-i18n="addExclusion"></button>
      </div>
      <ul class="exclusion-list" id="exclList">
        ${
          ex.exclusions.length
            ? ex.exclusions
                .map((e) => {
                  const from = ex.participants.find((p) => p.id === e.from)?.name || "?";
                  const to = ex.participants.find((p) => p.id === e.to)?.name || "?";
                  return `<li>
                    <span>${escapeHtml(from)} → ${escapeHtml(to)}</span>
                    <button type="button" class="btn-danger" data-unexclude="${e.from}|${e.to}" data-i18n="remove"></button>
                  </li>`;
                })
                .join("")
            : `<li class="muted" data-i18n="noExclusions"></li>`
        }
      </ul>
    </section>

    <section class="panel">
      <h2 data-i18n="drawTitle"></h2>
      <p class="hint" data-i18n="drawHint"></p>
      <button type="button" class="btn btn-primary" id="drawBtn" data-i18n="drawBtn"></button>
    </section>`
    }

    ${
      drawn
        ? `<section class="panel">
      <h2 data-i18n="shareTitle"></h2>
      <p class="hint" data-i18n="shareHint"></p>
      <p class="live-note" data-i18n="trackingLive"></p>
      <p class="muted" style="margin-top:0" data-i18n="redrawLocked"></p>
      <ul class="share-list" id="shareList">
        ${shareListHtml(ex.participants)}
      </ul>
    </section>`
        : ""
    }
  `;
  applyStaticI18n(view);
  wireBudgetToggle(view);

  const addForm = document.getElementById("addForm");
  if (addForm) {
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = String(new FormData(e.target).get("name") || "").trim();
      if (!name) return;
      try {
        await api(`/exchanges/${encodeURIComponent(id)}/participants`, {
          method: "POST",
          body: JSON.stringify({ name, pin }),
        });
        renderExchange(id);
      } catch (err) {
        showToast(mapError(err.code));
      }
    });
  }

  const budgetForm = document.getElementById("budgetForm");
  if (budgetForm) {
    budgetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      let budget;
      try {
        budget = budgetFromForm(budgetForm);
      } catch (err) {
        showToast(mapError(err.code));
        return;
      }
      try {
        await api(`/exchanges/${encodeURIComponent(id)}/budget`, {
          method: "PUT",
          body: JSON.stringify({ pin, budget }),
        });
        showToast(budget ? t("budgetSaved") : t("budgetCleared"));
        renderExchange(id);
      } catch (err) {
        showToast(mapError(err.code));
      }
    });
    document.getElementById("budgetClearBtn")?.addEventListener("click", async () => {
      try {
        await api(`/exchanges/${encodeURIComponent(id)}/budget`, {
          method: "PUT",
          body: JSON.stringify({ pin, budget: null }),
        });
        showToast(t("budgetCleared"));
        renderExchange(id);
      } catch (err) {
        showToast(mapError(err.code));
      }
    });
  }

  view.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(
          `/exchanges/${encodeURIComponent(id)}/participants/${btn.dataset.remove}?pin=${encodeURIComponent(pin)}`,
          { method: "DELETE" }
        );
        renderExchange(id);
      } catch (err) {
        showToast(mapError(err.code));
      }
    });
  });

  const addExcl = document.getElementById("addExcl");
  if (addExcl) {
    addExcl.addEventListener("click", async () => {
      const from = document.getElementById("exFrom").value;
      const to = document.getElementById("exTo").value;
      if (!from || !to || from === to) {
        showToast(t("selectBoth"));
        return;
      }
      const exclusions = [...ex.exclusions, { from, to }];
      try {
        await api(`/exchanges/${encodeURIComponent(id)}/exclusions`, {
          method: "PUT",
          body: JSON.stringify({ pin, exclusions }),
        });
        renderExchange(id);
      } catch (err) {
        showToast(mapError(err.code));
      }
    });
  }

  view.querySelectorAll("[data-unexclude]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const [from, to] = btn.dataset.unexclude.split("|");
      const exclusions = ex.exclusions.filter((e) => !(e.from === from && e.to === to));
      try {
        await api(`/exchanges/${encodeURIComponent(id)}/exclusions`, {
          method: "PUT",
          body: JSON.stringify({ pin, exclusions }),
        });
        renderExchange(id);
      } catch (err) {
        showToast(mapError(err.code));
      }
    });
  });

  const drawBtn = document.getElementById("drawBtn");
  if (drawBtn) {
    drawBtn.addEventListener("click", async () => {
      drawBtn.disabled = true;
      try {
        await api(`/exchanges/${encodeURIComponent(id)}/draw`, {
          method: "POST",
          body: JSON.stringify({ pin }),
        });
        showToast(t("drawnOk"));
        renderExchange(id);
      } catch (err) {
        showToast(mapError(err.code));
        drawBtn.disabled = false;
      }
    });
  }

  async function markSent(pid) {
    const data = await api(
      `/exchanges/${encodeURIComponent(id)}/participants/${encodeURIComponent(pid)}/sent`,
      { method: "POST", body: JSON.stringify({ pin }) }
    );
    updateShareTracking(data.exchange.participants);
  }

  view.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = revealUrl(btn.dataset.copy);
      try {
        await navigator.clipboard.writeText(url);
        showToast(t("copied"));
      } catch {
        prompt(t("copyLink"), url);
      }
      try {
        await markSent(btn.dataset.pid);
      } catch {
        /* copy still succeeded */
      }
    });
  });

  view.querySelectorAll("[data-sent]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await markSent(btn.dataset.sent);
        showToast(t("markedSent"));
      } catch (err) {
        showToast(mapError(err.code));
      }
    });
  });

  if (drawn) startTrackingPoll(id, pin);
}

async function renderReveal(code) {
  clearPoll();
  backHome.classList.remove("hidden");
  view.innerHTML = `<section class="panel"><p class="muted" data-i18n="loading"></p></section>`;
  applyStaticI18n(view);

  try {
    const data = await api(`/reveal/${encodeURIComponent(code)}`);
    const budgetLine = data.budget
      ? `<p class="budget-pill">${escapeHtml(
          t("budgetOnReveal", { amount: formatBudget(data.budget, getLang()) })
        )}</p>`
      : "";
    if (!data.ready) {
      view.innerHTML = `
        <section class="hero">
          <h1 class="brand" data-i18n="brand"></h1>
          <p class="tagline">${escapeHtml(t("revealFor", { name: data.yourName, exchange: data.exchangeName }))}</p>
        </section>
        <section class="panel reveal-stage">
          <h2 data-i18n="revealWaitingTitle"></h2>
          <p class="hint" data-i18n="revealWaiting"></p>
          ${budgetLine}
        </section>`;
    } else {
      view.innerHTML = `
        <section class="hero">
          <h1 class="brand" data-i18n="brand"></h1>
          <p class="tagline">${escapeHtml(t("revealFor", { name: data.yourName, exchange: data.exchangeName }))}</p>
        </section>
        <section class="panel reveal-stage">
          <p class="muted" data-i18n="revealReadyTitle"></p>
          <p class="who">${escapeHtml(data.giveTo)}</p>
          ${budgetLine}
          <p class="hint" data-i18n="revealSecret"></p>
        </section>`;
    }
    applyStaticI18n(view);
  } catch (err) {
    view.innerHTML = `<section class="panel"><p>${escapeHtml(mapError(err.code))}</p></section>`;
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function refreshChrome() {
  applyStaticI18n(document);
  langToggle.textContent = t("langToggle");
}

langToggle.addEventListener("click", () => {
  setLang(getLang() === "en" ? "es" : "en");
  refreshChrome();
  render();
});

async function render() {
  clearPoll();
  refreshChrome();
  const r = route();
  if (r.name === "exchange") return renderExchange(r.id);
  if (r.name === "reveal") return renderReveal(r.code);
  return renderHome();
}

window.addEventListener("hashchange", render);
render();

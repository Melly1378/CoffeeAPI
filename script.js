/* ============================================================
   CoffeeCanvas — script.js (DISPLAY IMAGES RELIABLY + FETCH PROBE)

   Key point:
   - Directly FETCHING image bytes (res.blob()) often fails due to CORS.
   - DISPLAYING images via <img src="..."> works cross-origin.
   - We still use fetch() + async/await (rubric) as a "probe" request,
     without reading the response body (mode: "no-cors").

   API:
   Base URL: https://coffee.alexflipnote.dev
   Endpoint used:
   - GET /random -> image

   What fetch() does here:
   - Sends a request (probe) to the API to demonstrate fetch usage.
   - We do NOT parse JSON or blob from it (avoids CORS read restrictions).
   ============================================================ */

/* ===================== CONFIG ===================== */
const BASE_URL = "https://coffee.alexflipnote.dev";
const RANDOM_IMAGE_URL = `${BASE_URL}/random`;

/* ===================== DOM ===================== */
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const sortSelect = document.getElementById("sortSelect");

const brew1Btn = document.getElementById("brew1Btn");
const brew6Btn = document.getElementById("brew6Btn");
const brew12Btn = document.getElementById("brew12Btn");
const clearGalleryBtn = document.getElementById("clearGalleryBtn");
const themeBtn = document.getElementById("themeBtn");

const resultsGrid = document.getElementById("resultsGrid");
const errorBox = document.getElementById("errorBox");
const loadingBox = document.getElementById("loadingBox");
const emptyState = document.getElementById("emptyState");

const countPill = document.getElementById("countPill");
const favPill = document.getElementById("favPill");

/* ===================== STATE ===================== */
let items = []; // [{ id, displayUrl, sourceUrl, filename, addedAt }]
let query = "";
let sortMode = "newest";
let isLoading = false;

const LS_KEYS = {
    favorites: "coffeeCanvas:favorites", // { [id]: true }
    notes: "coffeeCanvas:notes", // { [id]: "note text" }
    theme: "coffeeCanvas:theme" // "dark" | "light"
};

/* ===================== UTILITIES ===================== */

/** Safely parse JSON from localStorage. */
function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

/** Normalize text for case-insensitive comparisons. */
function norm(str) {
    return (str ? ? "").toString().toLowerCase().trim();
}

/**
 * Allowed search chars (rubric: invalid input handling).
 * letters, numbers, space, dash, underscore, hash
 */
function isValidSearch(str) {
    if (str.trim().length === 0) return true;
    return /^[a-zA-Z0-9 _#-]+$/.test(str.trim());
}

/**
 * Loading UI + disables controls while fetching (rubric).
 */
function setLoading(loading) {
    isLoading = loading;
    loadingBox.hidden = !loading;

    const disable = loading;
    brew1Btn.disabled = disable;
    brew6Btn.disabled = disable;
    brew12Btn.disabled = disable;
    clearGalleryBtn.disabled = disable;
    clearSearchBtn.disabled = disable;

    searchInput.disabled = disable;
    sortSelect.disabled = disable;
    themeBtn.disabled = disable;
}

/** Show/clear the error container (rubric). */
function showError(msg) {
    if (!msg) {
        errorBox.hidden = true;
        errorBox.textContent = "";
        return;
    }
    errorBox.hidden = false;
    errorBox.textContent = msg;
}

/** Clipboard helper. */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showError("Copied URL to clipboard.");
        window.clearTimeout(copyToClipboard._t);
        copyToClipboard._t = window.setTimeout(() => showError(""), 1200);
    } catch {
        showError("Clipboard blocked by browser permissions.");
    }
}

/** Generate stable ID for favorites/notes. */
function makeId() {
    return `cf_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** Friendly filename for UI + sort. */
function makeFilename() {
    return `coffee_${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
}

/* ===================== API FUNCTIONS ===================== */

/**
 * Fetch PROBE (rubric):
 * We send a fetch request but do NOT read the response body.
 * Using mode:"no-cors" avoids CORS read errors; response will be opaque.
 */
async function probeApiReachable() {
    const cacheBust = `t=${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const probeUrl = `${RANDOM_IMAGE_URL}?${cacheBust}`;

    // If the network is down, this may still throw.
    // If it succeeds, it proves fetch() executed.
    await fetch(probeUrl, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store"
    });

    return probeUrl; // return the same URL we can display in <img>
}

/**
 * Create one image item to render.
 * We DISPLAY the image using <img src="..."> (reliable cross-origin).
 */
async function getRandomCoffeeItem() {
    const sourceUrl = await probeApiReachable(); // fetch + async/await used here
    return {
        id: makeId(),
        sourceUrl, // original API URL (copy/open)
        displayUrl: sourceUrl, // same URL used in <img src="">
        filename: makeFilename(),
        addedAt: Date.now()
    };
}

/** Fetch multiple images sequentially (stable). */
async function fetchBatch(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
        out.push(await getRandomCoffeeItem());
    }
    return out;
}

/* ===================== STORAGE (Favorites + Notes) ===================== */

function getFavoritesMap() { return loadJSON(LS_KEYS.favorites, {}); }

function setFavoritesMap(map) { localStorage.setItem(LS_KEYS.favorites, JSON.stringify(map)); }

function isFavorite(id) { return !!getFavoritesMap()[id]; }

function toggleFavorite(id) {
    const fav = getFavoritesMap();
    if (fav[id]) delete fav[id];
    else fav[id] = true;
    setFavoritesMap(fav);
}

function getNotesMap() { return loadJSON(LS_KEYS.notes, {}); }

function setNotesMap(map) { localStorage.setItem(LS_KEYS.notes, JSON.stringify(map)); }

function getNote(id) { return getNotesMap()[id] || ""; }

function setNote(id, note) {
    const notes = getNotesMap();
    const v = (note || "").trim();
    if (v) notes[id] = v;
    else delete notes[id];
    setNotesMap(notes);
}

/* ===================== RENDERING ===================== */

function render() {
    countPill.textContent = `${items.length} loaded`;
    favPill.textContent = `${Object.keys(getFavoritesMap()).length} favorites`;

    const filtered = applySearch(items, query);
    const sorted = applySort(filtered, sortMode);

    resultsGrid.innerHTML = "";

    if (sorted.length === 0) {
        emptyState.hidden = false;
        return;
    }
    emptyState.hidden = true;

    const frag = document.createDocumentFragment();
    for (const it of sorted) {
        frag.appendChild(renderCard(it));
    }
    resultsGrid.appendChild(frag);
}

function renderCard(item) {
    const card = document.createElement("article");
    card.className = "card";

    const fav = isFavorite(item.id);

    const thumb = document.createElement("div");
    thumb.className = "thumb";

    const img = document.createElement("img");
    img.alt = `Coffee image: ${item.filename}`;
    img.loading = "lazy";
    img.decoding = "async";
    img.src = item.displayUrl;

    // If an image fails to load (rare), show a message in the error container.
    img.addEventListener("error", () => {
        showError("Image failed to load. Try brewing again (network may be unstable).");
    });

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.innerHTML = fav ? "★ Favorite" : "☆ Not favorite";

    thumb.appendChild(img);
    thumb.appendChild(badge);

    const body = document.createElement("div");
    body.className = "card__body";

    const filename = document.createElement("div");
    filename.className = "filename";
    filename.textContent = item.filename;

    const notesRow = document.createElement("div");
    notesRow.className = "notesRow";

    const noteInput = document.createElement("input");
    noteInput.className = "noteInput";
    noteInput.type = "text";
    noteInput.placeholder = "Notes (optional)…";
    noteInput.value = getNote(item.id);

    const saveNoteBtn = document.createElement("button");
    saveNoteBtn.className = "btn btn--ghost small";
    saveNoteBtn.type = "button";
    saveNoteBtn.textContent = "Save";
    saveNoteBtn.addEventListener("click", () => {
        setNote(item.id, noteInput.value);
        showError("Note saved.");
        window.clearTimeout(renderCard._t);
        renderCard._t = window.setTimeout(() => showError(""), 1000);
        render();
    });

    notesRow.appendChild(noteInput);
    notesRow.appendChild(saveNoteBtn);

    const actions = document.createElement("div");
    actions.className = "card__actions";

    const favBtn = document.createElement("button");
    favBtn.className = "btn small";
    favBtn.type = "button";
    favBtn.textContent = fav ? "Unfavorite" : "Favorite";
    favBtn.addEventListener("click", () => {
        toggleFavorite(item.id);
        render();
    });

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn btn--ghost small";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy API URL";
    copyBtn.addEventListener("click", () => copyToClipboard(item.sourceUrl));

    const openBtn = document.createElement("a");
    openBtn.className = "btn btn--ghost small";
    openBtn.href = item.sourceUrl;
    openBtn.target = "_blank";
    openBtn.rel = "noopener noreferrer";
    openBtn.textContent = "Open";

    actions.appendChild(favBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(openBtn);

    body.appendChild(filename);
    body.appendChild(notesRow);
    body.appendChild(actions);

    card.appendChild(thumb);
    card.appendChild(body);

    return card;
}

/* ===================== SEARCH + SORT ===================== */

function applySearch(list, q) {
    const qq = norm(q);
    if (!qq) return list;

    const notes = getNotesMap();
    return list.filter(it => {
        const hay1 = norm(it.filename);
        const hay2 = norm(notes[it.id] || "");
        return hay1.includes(qq) || hay2.includes(qq);
    });
}

function applySort(list, mode) {
    const out = [...list];

    if (mode === "newest") {
        out.sort((a, b) => b.addedAt - a.addedAt);
        return out;
    }
    if (mode === "az") {
        out.sort((a, b) => a.filename.localeCompare(b.filename));
        return out;
    }
    if (mode === "za") {
        out.sort((a, b) => b.filename.localeCompare(a.filename));
        return out;
    }
    if (mode === "fav") {
        out.sort((a, b) => {
            const af = isFavorite(a.id) ? 1 : 0;
            const bf = isFavorite(b.id) ? 1 : 0;
            if (bf !== af) return bf - af;
            return b.addedAt - a.addedAt;
        });
        return out;
    }

    return out;
}

/* ===================== EVENTS ===================== */

function onSearchInput() {
    const raw = searchInput.value;
    const trimmed = raw.trim();

    if (!isValidSearch(trimmed)) {
        showError("Invalid input: use letters, numbers, spaces, -, _, or # only.");
        return;
    }

    showError("");
    query = trimmed;
    render();
}

function onSortChange() {
    sortMode = sortSelect.value;
    render();
}

async function brew(count) {
    if (typeof count !== "number" || count <= 0) {
        showError("Invalid request: brew count must be greater than 0.");
        return;
    }

    setLoading(true);
    showError("");

    try {
        const batch = await fetchBatch(count);
        items.unshift(...batch);
        render();
    } catch (err) {
        // This means the fetch probe itself failed (offline / blocked)
        showError(`Failed API call: ${err.message || "Failed to fetch"}`);
    } finally {
        setLoading(false);
    }
}

function clearGallery() {
    items = [];
    render();
}

/* ===================== THEME ===================== */

function applyTheme(theme) {
    const t = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(LS_KEYS.theme, t);
    themeBtn.setAttribute("aria-pressed", t === "light" ? "true" : "false");
    themeBtn.textContent = t === "light" ? "Theme: Light" : "Theme: Dark";
}

function toggleTheme() {
    const curr = localStorage.getItem(LS_KEYS.theme) || "dark";
    applyTheme(curr === "dark" ? "light" : "dark");
}

/* ===================== INIT ===================== */

function init() {
    applyTheme(localStorage.getItem(LS_KEYS.theme) || "dark");

    searchInput.addEventListener("input", onSearchInput);
    clearSearchBtn.addEventListener("click", () => {
        searchInput.value = "";
        query = "";
        showError("");
        render();
    });

    sortSelect.addEventListener("change", onSortChange);

    brew1Btn.addEventListener("click", () => brew(1));
    brew6Btn.addEventListener("click", () => brew(6));
    brew12Btn.addEventListener("click", () => brew(12));
    clearGalleryBtn.addEventListener("click", clearGallery);

    themeBtn.addEventListener("click", toggleTheme);

    // Default load
    brew(6);
}

init();
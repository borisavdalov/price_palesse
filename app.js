console.log("app.js (GitHub direct fetch) ✅");

const statusEl = document.getElementById("status");
const searchEl = document.getElementById("search");
const theadEl = document.getElementById("thead");
const tbodyEl = document.getElementById("tbody");

// === ЛИСТЫ (твои published CSV) ===
const SHEETS = [
  {
    name: "Гомсельмаш Брянсксельмаш",
    csv: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRm6PdrELr2CY2wJU64uE02-rO9G_k7Gxpa5jpcdsSrPxTP66L8xWQIPTcsGcov0hn2mFtzX7y07EuC/pub?gid=988208971&single=true&output=csv",
  },
  {
    name: "БТЗ",
    csv: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRm6PdrELr2CY2wJU64uE02-rO9G_k7Gxpa5jpcdsSrPxTP66L8xWQIPTcsGcov0hn2mFtzX7y07EuC/pub?gid=1731123254&single=true&output=csv",
  },
  {
    name: "Бел",
    csv: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRm6PdrELr2CY2wJU64uE02-rO9G_k7Gxpa5jpcdsSrPxTP66L8xWQIPTcsGcov0hn2mFtzX7y07EuC/pub?gid=1865232731&single=true&output=csv",
  },
  {
    name: "Opall-agri",
    csv: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRm6PdrELr2CY2wJU64uE02-rO9G_k7Gxpa5jpcdsSrPxTP66L8xWQIPTcsGcov0hn2mFtzX7y07EuC/pub?gid=988208971&single=true&output=csv",
  },
];

const HEADER_LABELS = {
  name: "Наименование",
  photo: "Фото",
  spec: "Краткие технические характеристики и комплектация",
  price: "Цена",
  type: "Вид",
  plant: "Завод",
};

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function highlight(text, query) {
  if (!query) return escapeHtml(text);

  const safe = escapeHtml(text);
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const regex = new RegExp(`(${q})`, "gi");
  return safe.replace(regex, `<mark>$1</mark>`);
}

function normalizeHeader(h) {
  return String(h ?? "").replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
}

// CSV парсер (кавычки, запятые, переносы)
function parseCSV(text, delimiter = ",") {
  const rows = [];
  let row = [],
    cell = "",
    inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (c === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && next === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((v) => String(v).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cell += c;
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((v) => String(v).trim() !== "")) rows.push(row);
  }

  return rows;
}

// Ищем строку заголовков (где есть "наимен")
function rowsToObjects(rows) {
  if (!rows.length) return [];
  let headerIndex = rows.findIndex((r) =>
    r.some((cell) => String(cell).toLowerCase().includes("наимен"))
  );
  if (headerIndex === -1) headerIndex = 0;

  const headers = rows[headerIndex].map(normalizeHeader);

  return rows.slice(headerIndex + 1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj;
  });
}

function findKey(keys, includesAny) {
  const low = keys.map((k) => [k, k.toLowerCase()]);
  for (const inc of includesAny) {
    const needle = inc.toLowerCase();
    const found = low.find(([_, kl]) => kl.includes(needle));
    if (found) return found[0];
  }
  return "";
}

// Если фото — ссылка drive /file/d/ID/view → делаем прямую
function normalizeImageUrl(url) {
  if (!url) return "";
  const u = url.trim();
  const m = u.match(/https?:\/\/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m && m[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  return u;
}

function buildHeader() {
  theadEl.innerHTML = `
    <tr>
      <th class="col-name">${escapeHtml(HEADER_LABELS.name)}</th>
      <th class="col-photo">${escapeHtml(HEADER_LABELS.photo)}</th>
      <th class="col-spec">${escapeHtml(HEADER_LABELS.spec)}</th>
      <th class="col-price">${escapeHtml(HEADER_LABELS.price)}</th>
      <th class="col-type">${escapeHtml(HEADER_LABELS.type)}</th>
      <th class="col-plant">${escapeHtml(HEADER_LABELS.plant)}</th>
    </tr>
  `;
}

function isSectionRowByValues(name, spec, price) {
  if (name && !price && !spec) return true;
  if (!name && spec && !price) return true;
  return false;
}

function buildRow(item) {
  if (item.__sep) {
    return `<tr class="sheet-sep"><td colspan="6">Лист: ${escapeHtml(
      item.__sheet
    )}</td></tr>`;
  }

  const k = item.__keys;
  const name = (item[k.name] || "").trim();
  const photo = normalizeImageUrl((item[k.photo] || "").trim());
  const spec = (item[k.spec] || "").trim();
  const price = (item[k.price] || "").trim();
  const type = (item[k.type] || "").trim();
  const plant = (item[k.plant] || "").trim();

  if (isSectionRowByValues(name, spec, price)) {
    const title = name || spec;
    return `<tr class="section-row"><td colspan="6">${escapeHtml(
      title
    )}</td></tr>`;
  }

  const photoHtml = photo
    ? `<div class="cell-photo"><img src="${escapeHtml(photo)}" alt=""></div>`
    : `<div class="cell-photo"></div>`;

  return `
    <tr>
      <td class="col-name">${highlight(name, searchEl.value)}</td>
      <td class="col-photo">${photoHtml}</td>
      <td class="col-spec">${highlight(spec, searchEl.value)}</td>
      <td class="col-price">${highlight(price, searchEl.value)}</td>
      <td class="col-type">${highlight(type, searchEl.value)}</td>
      <td class="col-plant">${highlight(plant, searchEl.value)}</td>
    </tr>
  `;
}

let ALL = [];

function render(items) {
  tbodyEl.innerHTML = items.map(buildRow).join("");
  statusEl.textContent = `Показано: ${
    items.filter((x) => !x.__sep).length
  } / ${ALL.filter((x) => !x.__sep).length}`;
}

function applyFilter() {
  const q = (searchEl.value || "").trim().toLowerCase();
  if (!q) return render(ALL);

  const filtered = ALL.filter((item) => {
    if (item.__sep) return true;
    const k = item.__keys;
    const blob = [
      item[k.name],
      item[k.spec],
      item[k.price],
      item[k.type],
      item[k.plant],
      item.__sheet,
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });

  render(filtered);
}

async function loadSheet(sheet) {
  const resp = await fetch(sheet.csv, { cache: "no-store" });
  if (!resp.ok) throw new Error(`${sheet.name}: HTTP ${resp.status}`);

  const text = await resp.text();
  if (/^\s*</.test(text))
    throw new Error(`${sheet.name}: пришёл HTML вместо CSV (проверь публикацию)`);

  const rows = parseCSV(text, ",");
  const data = rowsToObjects(rows);

  const keys = Object.keys(data[0] || {});
  const mapKeys = {
    name: findKey(keys, ["наимен"]),
    photo: findKey(keys, ["фото", "изображ"]),
    spec: findKey(keys, ["кратк", "характер", "комплект"]),
    price: findKey(keys, ["цена"]),
    type: findKey(keys, ["вид", "катег"]),
    plant: findKey(keys, ["завод", "производ"]),
  };
  if (!mapKeys.name) throw new Error(`${sheet.name}: не найдена колонка "Наименование"`);

  const sep = { __sheet: sheet.name, __keys: mapKeys, __sep: true };

  const rowsData = data
    .filter((x) => Object.values(x).some((v) => String(v).trim() !== ""))
    .map((x) => ({ ...x, __sheet: sheet.name, __keys: mapKeys }));

  return [sep, ...rowsData];
}

async function main() {
  statusEl.textContent = "Загрузка…";
  buildHeader();
  ALL = [];
  const errors = [];

  for (const sheet of SHEETS) {
    try {
      const data = await loadSheet(sheet);
      ALL.push(...data);
      await new Promise((r) => setTimeout(r, 100));
    } catch (e) {
      console.warn(e);
      errors.push(e.message || String(e));
    }
  }

  render(ALL);

  const loaded = ALL.filter((x) => !x.__sep).length;
  statusEl.textContent = errors.length
    ? `Загружено: ${loaded}. Ошибки: ${errors.join(" | ")}`
    : `Загружено: ${loaded}`;
}

searchEl.addEventListener("input", applyFilter);
main().catch((err) => {
  console.error(err);
  statusEl.textContent = "Ошибка загрузки/парсинга";
});

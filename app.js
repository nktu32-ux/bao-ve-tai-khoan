"use strict";

const storageName = "credbox.vault";
const accounts = [];
let snapshot = null;
let vaultKey = null;
let vaultSalt = null;
const titles = {
  "tong-quan": "Tổng quan",
  "kho-tai-khoan": "Kho tài khoản",
  "kiem-tra": "Kiểm tra bảo mật",
  "canh-bao": "Cảnh báo"
};
const twoFactorLabels = { unknown: "Chưa xác minh", enabled: "Đã bật", disabled: "Chưa bật" };
const maskedPassword = "••••••••••••";
const state = { route: "", detailId: null, revealed: false };
let noticeTimer;

const select = (selector) => document.querySelector(selector);
const dialog = select("#dialog");
const dialogContent = select("#dialog-content");

function hasOpenVault() {
  return vaultKey !== null;
}

function isLocked() {
  return snapshot !== null && !hasOpenVault();
}

function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, char => entities[char]);
}

function icon(name) {
  return '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
}

function badge(label, tone, symbol) {
  return '<span class="badge tone-' + tone + '">' + (symbol ? icon(symbol) : "") + escapeHtml(label) + '</span>';
}

function accountStatus(account) {
  const reusedWith = accounts.filter(item => item.id !== account.id && item.password === account.password);
  const weak = [...account.password].length < 14;
  const unrecognized = account.loginHistory?.some(entry => entry.unrecognized) ?? false;
  return { reusedWith, weak, unrecognized, needsReview: unrecognized || weak || reusedWith.length > 0 || account.twoFactor !== "enabled" };
}

function serviceMark(account) {
  const letter = Array.from(account.name.trim())[0] || "•";
  return '<span class="service" aria-hidden="true">' + escapeHtml(letter.toLocaleUpperCase("vi")) + '</span>';
}

function encodeBytes(bytes) {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
}

function decodeBytes(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

async function deriveVaultKey(passphrase, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" }, material,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

async function readAccounts(passphrase, saved) {
  const envelope = JSON.parse(saved);
  if (envelope.version !== 1) throw new Error("Định dạng kho chưa được hỗ trợ.");
  const salt = decodeBytes(envelope.salt);
  const key = await deriveVaultKey(passphrase, salt);
  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBytes(envelope.iv) }, key, decodeBytes(envelope.data)
    );
  } catch {
    throw new Error("Không mở được kho. Kiểm tra mật khẩu chính và thử lại.");
  }
  const records = JSON.parse(new TextDecoder().decode(plaintext));
  if (!Array.isArray(records) || !records.every(record =>
    record && ["id", "name", "domain", "user", "password"].every(field => typeof record[field] === "string") &&
    /^[\da-f-]{36}$/i.test(record.id) && Object.hasOwn(twoFactorLabels, record.twoFactor) &&
    (record.loginHistory === undefined || (Array.isArray(record.loginHistory) && record.loginHistory.every(validLoginEntry)))
  )) throw new Error("Dữ liệu kho không đọc được.");
  return { key, salt, records };
}

async function writeAccounts(records, key, salt, previous) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(records)));
  const next = JSON.stringify({ version: 1, salt: encodeBytes(salt), iv: encodeBytes(iv), data: encodeBytes(new Uint8Array(bytes)) });
  // Only the tab editing the latest snapshot may commit its changes.
  await navigator.locks.request(storageName, () => {
    if (snapshot !== previous || localStorage.getItem(storageName) !== previous) {
      throw new Error("Kho đã thay đổi ở thẻ khác. Mở khóa lại để dùng dữ liệu mới nhất.");
    }
    localStorage.setItem(storageName, next);
    snapshot = next;
  });
}

function accountRow(account, label, action = "detail") {
  const { needsReview, unrecognized } = accountStatus(account);
  let status;
  if (unrecognized) status = badge("Đăng nhập cần xác minh", "risk");
  else if (action === "history") status = badge(`${account.loginHistory?.length || 0} lần ghi nhận`, "info");
  else status = badge(label || (needsReview ? "Cần kiểm tra" : "Đạt yêu cầu"), needsReview ? "warn" : "ok");
  return `
    <button class="account-row" type="button" data-action="${action}" data-account="${escapeHtml(account.id)}">
      <span class="account-identity">
        ${serviceMark(account)}
        <span><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(account.user)}</small></span>
      </span>
      ${status}${icon("chevron")}
    </button>`;
}

function emptyState(symbol, title, message) {
  return `<div class="empty-state">${icon(symbol)}<h3>${title}</h3><p>${message}</p></div>`;
}

function vaultPlaceholder() {
  return isLocked()
    ? emptyState("lock", "Kho đang khóa", "Mở khóa bằng mật khẩu chính để xem tài khoản của bạn.")
    : emptyState("vault", "Chưa có tài khoản", "Chọn “Thêm tài khoản” để lưu tài khoản đầu tiên.");
}

function renderOverview() {
  const checks = accounts.map(accountStatus);
  const reviewCount = checks.filter(info => info.needsReview).length;
  const cleared = accounts.length - reviewCount;
  const locked = isLocked();
  const count = value => locked ? "—" : value;
  select("#coverage-ratio").textContent = accounts.length ? Math.round(cleared / accounts.length * 100) + "%" : "—";
  select("#coverage-clear").textContent = count(cleared);
  select("#coverage-review").textContent = count(reviewCount);
  select("#coverage-ring").style.setProperty("--cleared", (accounts.length ? cleared / accounts.length * 100 : 0) + "%");
  select("#hero-copy").textContent = locked ? "Mở khóa kho để xem kết quả kiểm tra của bạn."
    : !accounts.length ? "Lưu tài khoản đầu tiên để bắt đầu theo dõi bảo mật."
    : reviewCount ? `Có ${reviewCount} tài khoản cần xem lại trong kho của bạn.`
    : "Tất cả tài khoản đã lưu đều đạt các mục kiểm tra.";
  const metrics = [
    [accounts.length, "Tài khoản đã lưu", "kho-tai-khoan", "vault", "info"],
    [checks.filter(info => info.reusedWith.length).length, "Tài khoản trùng mật khẩu", "canh-bao", "refresh", "warn"],
    [reviewCount, "Tài khoản cần kiểm tra", "kiem-tra", "shield", "info"]
  ];
  select("#metrics").innerHTML = metrics.map(([value, label, route, symbol, tone]) => `
    <a class="metric" href="#${route}">
      <span class="metric-label">${label}</span><strong>${count(value)}</strong>
      <span class="metric-icon tone-${tone}">${icon(symbol)}</span>
    </a>`).join("");
  select("#tong-quan .row-labels").hidden = !accounts.length;
  select("#recent-accounts").innerHTML = accounts.length
    ? accounts.slice(0, 3).map(account => accountRow(account)).join("") : vaultPlaceholder();
}

function normalized(text) {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
}

function renderVault() {
  const query = normalized(select("#vault-search").value.trim());
  const filter = select("#vault-filter").value;
  const filtered = accounts.filter((account) => {
    const matchesQuery = normalized([account.name, account.user, account.domain].join(" ")).includes(query);
    const { needsReview } = accountStatus(account);
    return matchesQuery && (filter === "all" || (filter === "review" ? needsReview : !needsReview));
  });
  select(".vault-toolbar").hidden = !accounts.length;
  select("#vault-count").hidden = !accounts.length;
  select("#kho-tai-khoan .row-labels").hidden = !filtered.length;
  select("#vault-count").textContent = filtered.length + " / " + accounts.length + " tài khoản";
  select("#vault-accounts").innerHTML = filtered.length ? filtered.map(account => accountRow(account)).join("")
    : accounts.length ? emptyState("search", "Không tìm thấy tài khoản", "Thử từ khóa khác hoặc đổi bộ lọc.") : vaultPlaceholder();
}

function renderHealth() {
  const root = select("#security-checks");
  if (isLocked()) {
    root.innerHTML = '<section class="panel">' + vaultPlaceholder() + '</section>';
    return;
  }
  const expanded = new Set(Array.from(root.querySelectorAll("details[open]"), panel => panel.dataset.check));
  const checks = [
    ["Lịch sử đăng nhập", "Chọn tài khoản để xem thời gian, thiết bị và địa điểm đăng nhập.", "history", accounts, "history"],
    ["Mật khẩu dùng lại", "Dùng mật khẩu riêng cho từng tài khoản.", "refresh", accounts.filter(a => accountStatus(a).reusedWith.length)],
    ["Mật khẩu ngắn", "Những mật khẩu trong danh sách này có dưới 14 ký tự.", "lock", accounts.filter(a => accountStatus(a).weak)],
    ["Xác thực hai yếu tố", "Bật bước xác minh thứ hai ở dịch vụ rồi cập nhật trạng thái trong kho.", "shield", accounts.filter(a => a.twoFactor !== "enabled")]
  ];
  root.innerHTML = checks.map(([title, description, symbol, records, action]) => `
    <details class="panel" data-check="${symbol}" ${expanded.has(symbol) ? "open" : ""}>
      <summary class="check-header"><span class="metric-icon tone-info">${icon(symbol)}</span>
        <span><strong class="check-title">${title}</strong><span class="check-count"> · ${records.length}</span>
          <span class="check-description">${description}</span></span>${icon("chevron")}
      </summary>
      ${records.length ? records.map(a => accountRow(a, undefined, action)).join("") : `<p class="empty">${action === "history" ? "Chưa có tài khoản trong kho." : "Không có tài khoản cần xử lý."}</p>`}
    </details>`).join("");
}

function renderAlerts() {
  const warnings = [];
  for (const account of accounts) {
    const { weak, reusedWith, unrecognized } = accountStatus(account);
    if (weak || reusedWith.length || unrecognized) {
      const label = weak && reusedWith.length ? "Ngắn và dùng lại" : weak ? "Mật khẩu ngắn" : "Dùng lại mật khẩu";
      warnings.push(accountRow(account, label));
    }
  }
  select("#alerts-content").innerHTML = '<div class="panel">' + (warnings.length ? warnings.join("")
    : !accounts.length ? vaultPlaceholder()
    : emptyState("shield", "Chưa có cảnh báo", "Dữ liệu đã lưu hiện không có mục cần cảnh báo.")) + '</div>';
  const counter = select("[data-unread]");
  counter.hidden = !warnings.length;
  counter.textContent = String(warnings.length);
}

function renderAll() {
  select('[data-action="lock"]').hidden = !hasOpenVault();
  select('[data-action="unlock"]').hidden = !isLocked();
  select('[data-action="add"]').hidden = isLocked();
  renderOverview();
  renderVault();
  renderHealth();
  renderAlerts();
}

function updateRoute(moveFocus = false) {
  const hash = location.hash.slice(1);
  if (hash === "main") return;
  const route = Object.hasOwn(titles, hash) ? hash : "tong-quan";
  if (state.route === route) {
    if (moveFocus) window.scrollTo(0, 0);
    return;
  }
  state.route = route;
  for (const link of document.querySelectorAll("[data-route]")) {
    if (link.dataset.route === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  for (const view of document.querySelectorAll(".view")) view.hidden = view.id !== route;
  select("#breadcrumb").textContent = titles[route];
  document.title = "CredBox · " + titles[route];
  if (moveFocus) {
    select("#" + route + " h1").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function announce(message) {
  const notice = select("#notice");
  notice.textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.textContent = ""; }, 3700);
}

function openDialog(title, markup) {
  select("#dialog-title").textContent = title;
  dialogContent.innerHTML = markup;
  if (!dialog.open) dialog.showModal();
}

function openAccess(addAfterUnlock) {
  try {
    syncSnapshot();
    if (!window.crypto?.subtle || !navigator.locks) throw new Error();
  } catch {
    openDialog("Không thể mở kho", '<p>Dùng HTTPS hoặc localhost trong trình duyệt hiện đại và cho phép trang lưu dữ liệu trên thiết bị.</p>');
    return;
  }
  if (hasOpenVault()) {
    if (addAfterUnlock) showAccountForm();
    return;
  }
  const create = !isLocked();
  openDialog(create ? "Tạo kho cá nhân" : "Mở khóa kho", `
    <form class="dialog-form" id="access-form" data-next="${addAfterUnlock ? "add" : ""}">
      <p class="form-help">${create
        ? "Đặt mật khẩu chính để mã hóa kho trên trình duyệt này. Hãy ghi nhớ mật khẩu vì CredBox không thể cấp lại."
        : "Nhập mật khẩu chính để mở kho đã lưu trong trình duyệt này."}</p>
      <label class="form-field"><span>Mật khẩu chính</span><input name="passphrase" type="password" autocomplete="${create ? "new-password" : "current-password"}" ${create ? 'minlength="12" placeholder="Ít nhất 12 ký tự"' : ""} required></label>
      ${create ? '<label class="form-field"><span>Nhập lại mật khẩu chính</span><input name="confirmation" type="password" autocomplete="new-password" required></label>' : ""}
      <p class="form-error" role="alert"></p>
      <div class="actions"><button type="submit" class="btn btn--primary">${create ? "Tạo kho" : "Mở khóa"}</button></div>
    </form>`);
  select('[name="passphrase"]').focus();
}

function showAccountForm(account) {
  state.detailId = account?.id || null;
  const options = Object.entries(twoFactorLabels).map(([value, label]) =>
    `<option value="${value}" ${account?.twoFactor === value ? "selected" : ""}>${label}</option>`).join("");
  openDialog(account ? "Sửa tài khoản" : "Thêm tài khoản", `
    <form class="dialog-form" id="account-form" autocomplete="off">
      <label class="form-field"><span>Tên dịch vụ</span><input name="name" maxlength="160" value="${escapeHtml(account?.name || "")}" required></label>
      <label class="form-field"><span>Trang web (không bắt buộc)</span><input name="domain" maxlength="2048" value="${escapeHtml(account?.domain || "")}" inputmode="url"></label>
      <label class="form-field"><span>Tên đăng nhập hoặc email</span><input name="user" maxlength="320" value="${escapeHtml(account?.user || "")}" required></label>
      <label class="form-field"><span>${account ? "Mật khẩu mới (nếu cần đổi)" : "Mật khẩu"}</span><input name="password" autocomplete="new-password" type="password" ${account ? "" : "required"}></label>
      <label class="form-field"><span>Xác thực hai yếu tố (2FA)</span><select name="twoFactor">${options}</select></label>
      <p class="form-error" role="alert"></p>
      <div class="actions"><button type="submit" class="btn btn--primary">Lưu tài khoản</button><button type="button" class="btn btn--secondary" data-action="close">Hủy</button></div>
    </form>`);
  select('[name="name"]').focus();
}

function showLoginHistory(account) {
  state.detailId = account.id;
  state.revealed = false;
  const provider = activityProvider(account);
  const entries = [...(account.loginHistory || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });
  const rows = entries.map(entry => `
    <li>
      <div class="login-summary"><time datetime="${escapeHtml(entry.at)}">${dateFormat.format(new Date(entry.at))}</time>
        ${entry.unrecognized ? badge("Cần xác minh", "warn", "alert") : ""}</div>
      <dl class="login-facts">
        <dt>Địa điểm</dt><dd>${escapeHtml(entry.place || "Chưa rõ")}</dd>
        <dt>Thiết bị</dt><dd>${escapeHtml(entry.device || "Chưa rõ")}</dd>
        <dt>Nguồn</dt><dd>${entry.source === "github" ? "Nhật ký GitHub" : "Ghi chú thủ công trước đây"}</dd>
      </dl>
      <button class="text-link login-review" type="submit" data-action="review-login" data-entry="${escapeHtml(entry.id)}">${entry.unrecognized ? "Tôi nhận ra lần này" : "Đánh dấu là đăng nhập lạ"}</button>
    </li>`).join("");
  openDialog("Lịch sử đăng nhập", `
    <div class="detail-service">${serviceMark(account)}<div><strong>${escapeHtml(account.name)}</strong><p>${escapeHtml(account.user)}</p></div></div>
    <div class="actions">
      ${provider ? `<a class="btn btn--primary" href="${escapeHtml(provider.url)}" target="_blank" rel="noopener noreferrer">Xem hoạt động trên ${escapeHtml(provider.name)}<span class="sr-only"> (mở thẻ mới)</span></a>` : ""}
      <button type="button" class="btn btn--secondary" data-action="detail" data-account="${escapeHtml(account.id)}">Về tài khoản</button>
    </div>
    ${provider?.name === "GitHub" ? `<details class="login-import"><summary>Nhập nhật ký từ GitHub</summary>
      <form class="dialog-form" id="github-log-form">
        <p class="form-help">Trong Security log của GitHub, chọn <strong>Export</strong> rồi chọn <strong>JSON</strong>. Tên đăng nhập đã lưu trong CredBox phải khớp với tên người dùng GitHub.</p>
        <label class="form-field"><span>Tệp nhật ký JSON</span><input type="file" name="logFile" accept=".json,application/json" required></label>
        <p class="form-error" role="alert"></p>
        <button type="submit" class="btn btn--secondary">Nhập lịch sử</button>
      </form></details>` : ""}
    ${entries.some(entry => entry.unrecognized) ? '<p class="login-warning tone-warn">Có lần đăng nhập được đánh dấu lạ. Hãy kiểm tra thiết bị và vị trí trong mục bảo mật của dịch vụ.</p>' : ""}
    ${entries.length ? `<form id="review-login-form"><input type="hidden" name="entryId">
      <ol class="login-list" aria-label="Các lần đăng nhập, mới nhất trước">${rows}</ol>
      <p class="form-error" role="alert"></p></form>` : '<p class="login-empty">Chưa có nhật ký trong kho. Bạn có thể kiểm tra hoạt động đăng nhập trong phần bảo mật của dịch vụ.</p>'}`);
  select("#dialog-content .actions > :first-child").focus();
}

function showDetail(id) {
  const account = accounts.find(item => item.id === id);
  if (!account) return;
  state.revealed = false;
  state.detailId = id;
  const info = accountStatus(account);
  const usedBy = info.reusedWith.map(item => item.name).join(", ");
  openDialog(account.name, `
    <div class="detail-service">${serviceMark(account)}<div><strong>${escapeHtml(account.domain || account.name)}</strong><p>Thông tin đăng nhập trong kho</p></div></div>
    <div class="dialog-fields">
      <div class="field"><span>Tên đăng nhập</span><strong>${escapeHtml(account.user)}</strong></div>
      <div class="field"><span>Mật khẩu</span><span class="password-field">
        <output id="password-value" aria-live="polite">${maskedPassword}</output>
        <button class="btn icon-button" type="button" data-action="toggle-password" aria-label="Hiện mật khẩu" aria-pressed="false">${icon("eye")}</button>
      </span></div>
    </div>
    <div class="detail-checks">
      <div><span>Độ dài mật khẩu</span>${info.weak ? badge("Dưới 14 ký tự", "warn") : badge("Từ 14 ký tự", "ok")}</div>
      <div><span>Mật khẩu dùng lại</span>${usedBy ? badge("Trùng với " + usedBy, "warn") : badge("Không trùng trong kho", "ok")}</div>
      <div><span>Xác thực hai yếu tố</span>${badge(twoFactorLabels[account.twoFactor], account.twoFactor === "enabled" ? "ok" : "warn")}</div>
    </div>
    <div class="actions"><button class="btn btn--primary" type="button" data-action="history">Lịch sử đăng nhập</button>
      <button class="btn btn--secondary" type="button" data-action="edit">Sửa tài khoản</button>
      <button class="btn btn--secondary" type="button" data-action="delete">Xóa tài khoản</button></div>`);
}

function clearSession() {
  vaultKey = null;
  vaultSalt = null;
  accounts.length = 0;
  state.detailId = null;
  state.revealed = false;
  if (dialog.open) dialog.close();
  dialogContent.replaceChildren();
  select("#vault-search").value = "";
  select("#vault-filter").value = "all";
  renderAll();
}

function syncSnapshot() {
  const latest = localStorage.getItem(storageName);
  if (latest !== snapshot) {
    snapshot = latest;
    clearSession();
  }
}

async function submitAccess(form) {
  const passphrase = form.elements.passphrase.value;
  const previous = snapshot;
  let session;
  if (form.elements.confirmation) {
    if (passphrase !== form.elements.confirmation.value) throw new Error("Hai lần nhập mật khẩu chính chưa khớp.");
    if (previous !== null) throw new Error("Kho đã được tạo ở thẻ khác. Mở khóa để tiếp tục.");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveVaultKey(passphrase, salt);
    session = { key, salt, records: [] };
    if (!form.isConnected) return;
    await writeAccounts([], key, salt, null);
  } else {
    session = await readAccounts(passphrase, previous);
    if (localStorage.getItem(storageName) !== previous) throw new Error("Kho đã thay đổi. Mở khóa lại để tiếp tục.");
  }
  if (!form.isConnected) return;
  vaultKey = session.key;
  vaultSalt = session.salt;
  accounts.splice(0, accounts.length, ...session.records);
  renderAll();
  if (form.dataset.next === "add") showAccountForm();
  else dialog.close();
}

async function submitAccount(form) {
  const current = accounts.find(item => item.id === state.detailId);
  const records = accounts.slice();
  let savedId = null;
  if (form.id === "delete-form") {
    if (!current) return;
    records.splice(records.indexOf(current), 1);
  } else {
    const fields = new FormData(form);
    const record = {
      ...current,
      id: current?.id || crypto.randomUUID(),
      name: fields.get("name").trim(), domain: fields.get("domain").trim(),
      user: fields.get("user").trim(), password: fields.get("password") || current?.password,
      twoFactor: fields.get("twoFactor")
    };
    if (!record.name || !record.user || !record.password || !Object.hasOwn(twoFactorLabels, record.twoFactor)) {
      throw new Error("Điền tên dịch vụ, tên đăng nhập và mật khẩu để lưu.");
    }
    if (current) records.splice(records.indexOf(current), 1);
    records.unshift(record);
    savedId = record.id;
  }
  await writeAccounts(records, vaultKey, vaultSalt, snapshot);
  if (!hasOpenVault() || !form.isConnected) return;
  accounts.splice(0, accounts.length, ...records);
  select("#vault-search").value = "";
  select("#vault-filter").value = "all";
  renderAll();
  dialog.close();
  if (savedId) location.hash = "kho-tai-khoan";
  announce(savedId ? "Đã lưu tài khoản vào kho." : "Đã xóa tài khoản khỏi kho.");
}

function validLoginEntry(entry) {
  return entry && typeof entry.id === "string" && entry.id.length > 0 && entry.id.length <= 256 &&
    typeof entry.at === "string" && Number.isFinite(Date.parse(entry.at)) &&
    typeof entry.place === "string" && entry.place.length <= 160 &&
    typeof entry.device === "string" && entry.device.length <= 512 &&
    typeof entry.unrecognized === "boolean" && (entry.source === undefined || entry.source === "github");
}

async function submitLoginHistory(form) {
  const account = accounts.find(item => item.id === state.detailId);
  if (!account || !hasOpenVault()) throw new Error("Mở khóa và chọn lại tài khoản để tiếp tục.");
  const previous = snapshot;
  const fields = new FormData(form);
  const entries = [...(account.loginHistory || [])];
  let message;
  if (form.id === "review-login-form") {
    const index = entries.findIndex(entry => entry.id === fields.get("entryId"));
    if (index < 0) throw new Error("Không tìm thấy lần đăng nhập này.");
    entries[index] = { ...entries[index], unrecognized: !entries[index].unrecognized };
    message = "Đã cập nhật trạng thái lần đăng nhập.";
  } else if (form.id === "github-log-form") {
    const file = fields.get("logFile");
    if (!file?.size) throw new Error("Chọn tệp JSON đã xuất từ GitHub.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Tệp lớn hơn 10 MB. Hãy xuất nhật ký theo khoảng ngày ngắn hơn.");
    const imported = githubLogEntries(await file.text(), account);
    const ids = new Set(entries.map(entry => entry.id));
    let added = 0;
    for (const entry of imported) {
      if (ids.has(entry.id)) continue;
      if (!validLoginEntry(entry)) throw new Error("Dữ liệu lần đăng nhập trong tệp không hợp lệ.");
      entries.push(entry);
      ids.add(entry.id);
      added++;
    }
    if (!added) {
      form.querySelector(".form-error").textContent = "Các lần đăng nhập trong tệp đã có trong lịch sử.";
      return;
    }
    message = `Đã ghi thêm ${added} mục từ nhật ký GitHub.`;
  } else {
    return;
  }
  if (!form.isConnected || !hasOpenVault()) return;
  const updated = { ...account, loginHistory: entries };
  const records = accounts.map(item => item.id === account.id ? updated : item);
  await writeAccounts(records, vaultKey, vaultSalt, previous);
  if (!form.isConnected || !hasOpenVault()) return;
  accounts.splice(0, accounts.length, ...records);
  renderAll();
  showLoginHistory(updated);
  announce(message);
}

document.addEventListener("click", event => {
  const control = event.target.closest("[data-action]");
  if (!control || dialog.hasAttribute("aria-busy")) return;
  const account = accounts.find(item => item.id === (control.dataset.account || state.detailId));
  switch (control.dataset.action) {
    case "add":
    case "unlock":
      openAccess(control.dataset.action === "add");
      break;
    case "lock":
      clearSession();
      announce("Đã khóa kho tài khoản.");
      break;
    case "close":
      dialog.close();
      break;
    case "detail":
      showDetail(control.dataset.account);
      break;
    case "history":
      if (account) showLoginHistory(account);
      break;
    case "review-login":
      control.form.elements.entryId.value = control.dataset.entry;
      break;
    case "edit":
      if (account) showAccountForm(account);
      break;
    case "delete":
      if (!account) break;
      openDialog("Xóa tài khoản?", `<form id="delete-form" class="dialog-form">
        <p>Xóa <strong>${escapeHtml(account.name)}</strong> khỏi kho CredBox? Tài khoản tại dịch vụ vẫn hoạt động.</p>
        <p class="form-error" role="alert"></p>
        <div class="actions"><button type="button" class="btn btn--secondary" data-action="detail" data-account="${account.id}">Giữ tài khoản</button>
        <button type="submit" class="btn btn--primary">Xóa khỏi kho</button></div></form>`);
      break;
    case "toggle-password":
      if (!account) break;
      state.revealed = !state.revealed;
      select("#password-value").textContent = state.revealed ? account.password : maskedPassword;
      control.setAttribute("aria-pressed", String(state.revealed));
      control.setAttribute("aria-label", state.revealed ? "Ẩn mật khẩu" : "Hiện mật khẩu");
      break;
  }
});

select("#vault-search").addEventListener("input", renderVault);
select("#vault-filter").addEventListener("change", renderVault);
dialog.addEventListener("submit", async event => {
  event.preventDefault();
  if (dialog.hasAttribute("aria-busy")) return;
  const form = event.target;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  dialog.setAttribute("aria-busy", "true");
  try {
    if (form.id === "access-form") await submitAccess(form);
    else if (["review-login-form", "github-log-form"].includes(form.id)) await submitLoginHistory(form);
    else if (form.id === "account-form" || form.id === "delete-form") await submitAccount(form);
  } catch (error) {
    const message = error.name === "QuotaExceededError" ? "Bộ nhớ trình duyệt đã đầy. Thay đổi chưa được lưu."
      : error.name === "Error" ? error.message : "Không thể đọc hoặc ghi kho. Kiểm tra quyền lưu dữ liệu của trình duyệt.";
    form.querySelector(".form-error").textContent = message;
  } finally {
    dialog.removeAttribute("aria-busy");
    button.disabled = false;
  }
});
dialog.addEventListener("cancel", event => {
  if (dialog.hasAttribute("aria-busy")) event.preventDefault();
});
dialog.addEventListener("close", () => {
  if (dialog.open) return;
  const closedAccount = state.detailId;
  state.detailId = null;
  state.revealed = false;
  dialogContent.replaceChildren();
  if (document.activeElement === document.body) {
    const view = document.getElementById(state.route);
    const row = closedAccount && view?.querySelector('[data-account="' + closedAccount + '"]');
    (row || view?.querySelector("h1"))?.focus();
  }
});
window.addEventListener("storage", event => {
  if (event.key !== null && event.key !== storageName) return;
  syncSnapshot();
});
window.addEventListener("pagehide", () => {
  if (hasOpenVault() || dialog.open) clearSession();
});
window.addEventListener("pageshow", event => {
  if (event.persisted) syncSnapshot();
});
window.addEventListener("hashchange", () => updateRoute(true));

document.addEventListener("DOMContentLoaded", () => {
  try {
    snapshot = localStorage.getItem(storageName);
  } catch {
    // The access dialog explains how to enable browser storage.
  }
  renderAll();
  if (location.hash === "#main") history.replaceState(null, "", "#tong-quan");
  updateRoute();
});

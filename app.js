"use strict";

const accounts = [
  { id: "google", name: "Google", domain: "google.com", user: "sv.nhom5", letter: "G", password: "Mau!Google-8R2-qV7", twoFactor: "enabled" },
  { id: "facebook", name: "Facebook", domain: "facebook.com", user: "sv.nhom5", letter: "f", password: "SinhVien123", twoFactor: "unknown" },
  { id: "forum", name: "Diễn đàn Sinh viên", domain: "diendan-sinhvien.example", user: "sv_nhom5", letter: "SV", password: "SinhVien123", twoFactor: "unknown" },
  { id: "github", name: "GitHub", domain: "github.com", user: "sv-nhom5", letter: "GH", password: "Mau!GitHub-4T7-aK3", twoFactor: "enabled" },
  { id: "notion", name: "Notion", domain: "notion.so", user: "sv.nhom5", letter: "N", password: "Mau!Notion-6H3-jS9", twoFactor: "disabled" },
  { id: "discord", name: "Discord", domain: "discord.com", user: "sv.nhom5", letter: "D", password: "Discord#26", twoFactor: "unknown" },
  { id: "teams", name: "Microsoft Teams", domain: "teams.microsoft.com", user: "sv.nhom5", letter: "T", password: "Mau!Teams-5K8-wQ2", twoFactor: "enabled" },
  { id: "instagram", name: "Instagram", domain: "instagram.com", user: "sv.nhom5", letter: "I", password: "Mau!Insta-7P-z4", twoFactor: "unknown" },
  { id: "tiktok", name: "TikTok", domain: "tiktok.com", user: "sv.nhom5", letter: "TT", password: "Mau!TikTok-3W-r8", twoFactor: "unknown" }
];

const serviceIcons = { google: "google-icon", facebook: "facebook", github: "github", notion: "notion", spotify: "spotify", discord: "discord", teams: "teams", instagram: "instagram", tiktok: "tiktok" };

const proposedAccount = { id: "spotify", name: "Spotify", domain: "spotify.com", user: "sv.nhom5", letter: "S", password: "Mau!Spotify-9R6-pQ4", twoFactor: "unknown" };
const titles = {
  "tong-quan": "Tổng quan",
  "kho-tai-khoan": "Kho tài khoản",
  "kiem-tra": "Kiểm tra bảo mật",
  "canh-bao": "Cảnh báo"
};
const twoFactorLabels = { unknown: "Chưa xác minh", enabled: "Đã xác nhận bật", disabled: "Đã xác nhận chưa bật" };
const maskedPassword = "••••••••••••";
const state = { route: "", alertRead: false, forumPasswordUpdated: false, detailId: null, revealed: false };
let noticeTimer;

const select = (selector) => document.querySelector(selector);
const dialog = select("#dialog");
const dialogContent = select("#dialog-content");

function icon(name) {
  return '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
}

function badge(label, tone, symbol) {
  return '<span class="badge tone-' + tone + '">' + (symbol ? icon(symbol) : "") + label + '</span>';
}

function accountStatus(account) {
  const reusedWith = accounts.filter((item) => item.id !== account.id && item.password === account.password);
  // The sample values illustrate the result of a future password-strength estimator.
  const weak = account.password.length < 14;
  const incident = account.id === "forum" && !state.forumPasswordUpdated;
  const needsReview = incident || weak || reusedWith.length > 0 || account.twoFactor !== "enabled";
  return { reusedWith, weak, incident, needsReview };
}

function serviceMark(account) {
  const name = serviceIcons[account.id];
  const mark = name
    ? '<img src="assets/icons/' + name + '.svg" alt="" width="20" height="20">'
    : account.letter;
  return '<span class="service service-' + account.id + '" aria-hidden="true">' + mark + '</span>';
}

function accountRow(account) {
  const status = accountStatus(account);
  const marker = status.incident
    ? badge("Cần xử lý", "risk")
    : status.needsReview ? badge("Cần kiểm tra", "warn") : badge("Đạt kiểm tra", "ok");
  return `
    <button class="account-row" type="button" data-action="detail" data-account="${account.id}">
      <span class="account-identity">
        ${serviceMark(account)}
        <span><strong>${account.name}</strong><small>${account.user}</small></span>
      </span>
      ${marker}${icon("chevron")}
    </button>`;
}

function renderOverview() {
  const reviewCount = accounts.filter((account) => accountStatus(account).needsReview).length;
  const cleared = accounts.length - reviewCount;
  select("#coverage-ratio").textContent = cleared + "/" + accounts.length;
  select("#coverage-clear").textContent = cleared;
  select("#coverage-review").textContent = reviewCount;
  select("#coverage-ring").style.setProperty("--cleared", (cleared / accounts.length * 100) + "%");
  select("#spotlight-status").textContent = state.alertRead ? "Đã đọc" : "Chưa đọc";
  const metrics = [
    [accounts.length, "Tài khoản đã lưu", "kho-tai-khoan", "vault", "info"],
    [reviewCount, "Cần kiểm tra", "kiem-tra", "shield", "warn"],
    [state.alertRead ? 0 : 1, "Cảnh báo chưa đọc", "canh-bao", "bell", "risk"]
  ];
  select("#hero-title").textContent = reviewCount
    ? reviewCount + " tài khoản cần xem lại"
    : "Đã xử lý các mục kiểm tra";
  select("#hero-copy").textContent = state.forumPasswordUpdated
    ? "Kiểm tra mật khẩu dùng lại và trạng thái xác thực hai yếu tố."
    : "Ưu tiên Diễn đàn Sinh viên. Thông báo sự cố mẫu ghi nhận mật khẩu bị lộ.";
  const metricsRoot = select("#metrics");
  if (!metricsRoot.childElementCount) {
    metricsRoot.innerHTML = metrics.map(([value, label, route, symbol, tone]) => `
      <a class="metric" href="#${route}">
        <span class="metric-label">${label}</span>
        <strong data-count data-value="${value}">${value}</strong>
        <span class="metric-icon tone-${tone}">${icon(symbol)}</span>
      </a>`).join("");
  } else {
    metricsRoot.querySelectorAll("[data-count]").forEach((count, index) => {
      const value = String(metrics[index][0]);
      if (count.dataset.value === value) return;
      count.dataset.value = value;
      count.classList.remove("mo-cr", "is-on");
      count.removeAttribute("aria-label");
      count.textContent = value;
    });
  }
  select("#recent-accounts").innerHTML = accounts.slice(0, 3).map(accountRow).join("");
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
  select("#vault-count").textContent = filtered.length + " / " + accounts.length + " tài khoản";
  select("#vault-accounts").innerHTML = filtered.length
    ? filtered.map(accountRow).join("")
    : '<p class="empty">Không tìm thấy tài khoản phù hợp.</p>';
}

function renderHealth() {
  const checks = [
    { title: "Liên quan đến sự cố", description: "Hãy đổi mật khẩu ở dịch vụ có cảnh báo trước.", icon: "alert", tone: "risk", records: accounts.filter((account) => accountStatus(account).incident) },
    { title: "Mật khẩu dùng lại", description: "Đổi sang mật khẩu riêng cho từng tài khoản trong danh sách.", icon: "refresh", tone: "warn", records: accounts.filter((account) => accountStatus(account).reusedWith.length) },
    { title: "Mật khẩu yếu", description: "Thay mật khẩu dễ đoán bằng mật khẩu dài và riêng biệt.", icon: "lock", tone: "warn", records: accounts.filter((account) => accountStatus(account).weak) },
    { title: "Xác thực hai yếu tố (2FA)", description: "Kiểm tra trong cài đặt của dịch vụ, sau đó ghi nhận vào kho.", icon: "shield", tone: "info", records: accounts.filter((account) => account.twoFactor !== "enabled") }
  ];
  select("#security-checks").innerHTML = checks.map((check) => `
    <section class="panel">
      <div class="check-header">
        <span class="metric-icon tone-${check.tone}">${icon(check.icon)}</span>
        <div><h2>${check.title}<span class="check-count"> · ${check.records.length}</span></h2><p>${check.description}</p></div>
      </div>
      ${check.records.length ? check.records.map(accountRow).join("") : '<p class="empty">Không có tài khoản cần xử lý ở mục này.</p>'}
    </section>`).join("");
}

function renderAlerts() {
  const forum = accounts.find((account) => account.id === "forum");
  const { reusedWith } = accountStatus(forum);
  const priority = state.forumPasswordUpdated
    ? "Đã ghi nhận đổi mật khẩu mẫu của Diễn đàn Sinh viên."
    : "Mở trang chính thức của diễn đàn và đổi mật khẩu.";
  select("#alerts-content").innerHTML = `
    <div class="alert-grid">
      <article class="panel alert-panel">
        <div class="alert-meta">
          ${badge("Sự cố giả lập", "risk", "alert")}
          ${badge(state.alertRead ? "Đã đọc" : "Chưa đọc", state.alertRead ? "neutral" : "info")}
        </div>
        <h2>Diễn đàn Sinh viên thông báo rò rỉ mật khẩu</h2>
        <p>Một số tài khoản trên diễn đàn bị ảnh hưởng. Chưa xác minh tài khoản trong kho thuộc danh sách bị lộ.</p>
        <p class="source">Nguồn tình huống · Bản tin mẫu của Diễn đàn Sinh viên</p>
        <div class="actions">
          <button class="btn btn--primary" type="button" data-action="detail" data-account="forum">Xem tài khoản</button>
          <button class="btn btn--secondary" type="button" data-action="read-alert" aria-disabled="${state.alertRead}">${state.alertRead ? "Đã đọc cảnh báo" : "Đánh dấu đã đọc"}</button>
        </div>
      </article>
      <aside class="panel ai-note" aria-labelledby="ai-title">
        <h2 id="ai-title"><span class="metric-icon tone-info">${icon("spark")}</span> Tóm tắt AI mẫu</h2>
        <ol>
          <li>${priority}</li>
          <li>Đổi mật khẩu ở những tài khoản từng dùng chung mật khẩu cũ.</li>
          <li>Xem dịch vụ có hỗ trợ 2FA và bật trong phần cài đặt nếu có.</li>
        </ol>
      </aside>
    </div>
    <section class="panel linked-accounts" aria-labelledby="linked-title">
      <div class="panel-heading"><h2 id="linked-title">Tài khoản liên quan</h2></div>
      ${[forum, ...reusedWith].map(accountRow).join("")}
    </section>`;
}

function renderAll() {
  renderOverview();
  renderVault();
  renderHealth();
  renderAlerts();
  const unread = select("[data-unread]");
  unread.hidden = state.alertRead;
  unread.textContent = state.alertRead ? "" : "1";
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
  document.title = "Lá Chắn · " + titles[route];
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

function showLogin() {
  if (accounts.some((account) => account.id === proposedAccount.id)) {
    showDetail(proposedAccount.id);
    return;
  }
  openDialog("Lưu tài khoản Spotify?", `
    <div class="detail-service">${serviceMark(proposedAccount)}<div><strong>Spotify</strong><p>Yêu cầu lưu thông tin đăng nhập</p></div></div>
    <p>Bạn vừa đăng nhập Spotify trong tình huống mẫu. Hãy chọn có lưu thông tin này vào kho tài khoản hay không.</p>
    <div class="dialog-fields">
      <div class="field"><span>Trang web</span><strong>${proposedAccount.domain}</strong></div>
      <div class="field"><span>Tên đăng nhập mẫu</span><strong>${proposedAccount.user}</strong></div>
      <div class="field"><span>Mật khẩu mẫu</span><output aria-label="Mật khẩu đang ẩn">${maskedPassword}</output></div>
    </div>
    <div class="actions">
      <button class="btn btn--primary" type="button" data-action="save-login">Cho phép lưu</button>
      <button class="btn btn--secondary" type="button" data-action="skip-login">Không lưu</button>
    </div>`);
}

function showDetail(id, preserveReveal = false) {
  const account = accounts.find((item) => item.id === id);
  if (!account) return;
  if (!preserveReveal) state.revealed = false;
  state.detailId = id;
  const info = accountStatus(account);
  const usedBy = info.reusedWith.map((item) => item.name).join(", ");
  const options = Object.entries(twoFactorLabels).map(([value, label]) =>
    `<option value="${value}" ${account.twoFactor === value ? "selected" : ""}>${label}</option>`
  ).join("");
  openDialog(account.name, `
    <div class="detail-service">${serviceMark(account)}<div><strong>${account.domain}</strong><p>Thông tin đăng nhập trong kho</p></div></div>
    <div class="dialog-fields">
      <div class="field"><span>Tên đăng nhập</span><strong>${account.user}</strong></div>
      <div class="field"><span>Mật khẩu mẫu</span><span class="password-field">
        <output id="password-value" aria-live="polite">${state.revealed ? account.password : maskedPassword}</output>
        <button class="btn icon-button" type="button" data-action="toggle-password" aria-label="${state.revealed ? "Ẩn mật khẩu mẫu" : "Hiện mật khẩu mẫu"}" aria-pressed="${state.revealed}">${icon("eye")}</button>
      </span></div>
    </div>
    <div class="detail-checks">
      <div><span>Độ mạnh mẫu</span>${info.weak ? badge("Yếu", "warn") : badge("Mạnh", "ok")}</div>
      <div><span>Mật khẩu dùng lại</span>${usedBy ? badge("Trùng với " + usedBy, "warn") : badge("Không trùng trong kho", "ok")}</div>
      ${id === "forum" ? '<div><span>Sự cố tại dịch vụ</span>' + (info.incident ? badge("Cần xử lý", "risk") : badge("Đã ghi nhận đổi", "ok")) + '</div>' : ""}
    </div>
    <label class="two-factor-control" for="factor-select"><span>Ghi nhận trạng thái 2FA</span><select id="factor-select">${options}</select></label>
    ${info.weak || usedBy || info.incident ? '<button class="btn btn--secondary" type="button" data-action="demo-change">Mô phỏng đổi mật khẩu</button>' : ""}`);
}

function showAbout() {
  openDialog("Về Lá Chắn", `
    <p>Phiên bản 1.0.0 · Nhóm 5 · Trường Đại học Công nghệ Thông tin và Truyền thông Việt – Hàn.</p>
    <p>Ứng dụng hiện dùng tài khoản và bản tin có sẵn để trình bày luồng bảo mật. Các thao tác chỉ thay đổi dữ liệu mẫu trong phiên và được đặt lại khi tải lại trang.</p>
    <p>Thiết kế sản phẩm dự kiến dùng tiện ích xin phép người dùng khi đăng nhập, kho mã hóa và AI đọc thông báo công khai từ các dịch vụ. Trang này chỉ cung cấp luồng mô phỏng cho những phần đó.</p>
    <button class="btn btn--secondary" type="button" data-action="close">Đóng</button>`);
}

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  switch (control.dataset.action) {
    case "login":
      showLogin();
      break;
    case "about":
      showAbout();
      break;
    case "close":
      dialog.close();
      break;
    case "detail":
      showDetail(control.dataset.account);
      break;
    case "skip-login":
      dialog.close();
      announce("Tài khoản Spotify chưa được lưu.");
      break;
    case "save-login":
      if (accounts.some((account) => account.id === proposedAccount.id)) break;
      accounts.unshift({ ...proposedAccount });
      select('[data-action="login"]').innerHTML = icon("check") + " Xem tài khoản vừa lưu";
      dialog.close();
      select("#vault-search").value = "";
      select("#vault-filter").value = "all";
      renderAll();
      if (state.route === "kho-tai-khoan") {
        select('#vault-accounts [data-account="spotify"]').focus();
      } else {
        location.hash = "kho-tai-khoan";
      }
      announce("Đã lưu tài khoản Spotify mẫu.");
      break;
    case "toggle-password": {
      const account = accounts.find((item) => item.id === state.detailId);
      if (!account) break;
      state.revealed = !state.revealed;
      select("#password-value").textContent = state.revealed ? account.password : maskedPassword;
      control.setAttribute("aria-pressed", String(state.revealed));
      control.setAttribute("aria-label", state.revealed ? "Ẩn mật khẩu mẫu" : "Hiện mật khẩu mẫu");
      break;
    }
    case "demo-change": {
      const account = accounts.find((item) => item.id === state.detailId);
      if (!account) break;
      account.password = "MauMoi!7nQ-" + account.id + "-K9";
      if (account.id === "forum") state.forumPasswordUpdated = true;
      renderAll();
      showDetail(account.id);
      select("#factor-select").focus();
      break;
    }
    case "read-alert":
      if (state.alertRead) break;
      state.alertRead = true;
      renderAll();
      select('[data-action="read-alert"]').focus();
      announce("Đã đánh dấu cảnh báo là đã đọc.");
      break;
  }
});

select("#vault-search").addEventListener("input", renderVault);
select("#vault-filter").addEventListener("change", renderVault);
dialog.addEventListener("change", (event) => {
  if (event.target.id !== "factor-select") return;
  const account = accounts.find((item) => item.id === state.detailId);
  if (account && Object.hasOwn(twoFactorLabels, event.target.value)) {
    account.twoFactor = event.target.value;
    renderAll();
  }
});
dialog.addEventListener("close", () => {
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
window.addEventListener("hashchange", () => updateRoute(true));
renderAll();
if (location.hash === "#main") history.replaceState(null, "", "#tong-quan");
updateRoute();

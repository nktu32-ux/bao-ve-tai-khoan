"use strict";

const activityProviders = [
  { name: "Google", aliases: ["google", "gmail"], domains: ["google.com", "gmail.com"], url: "https://www.google.com/devices" },
  { name: "Microsoft", aliases: ["microsoft", "outlook", "hotmail"], domains: ["microsoft.com", "outlook.com", "hotmail.com", "live.com"], url: "https://account.live.com/activity" },
  { name: "GitHub", aliases: ["github"], domains: ["github.com"], url: "https://github.com/settings/security-log" },
  { name: "Facebook", aliases: ["facebook"], domains: ["facebook.com", "messenger.com"], url: "https://accountscenter.facebook.com/password_and_security/login_activity/" }
];

function activityProvider(account) {
  const domain = account.domain.trim();
  if (!domain) {
    return activityProviders.find(provider => provider.aliases.includes(account.name.trim().toLowerCase())) || null;
  }
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(domain) ? domain : "https://" + domain);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.replace(/\.$/, "");
    return activityProviders.find(provider => provider.domains.some(base => host === base || host.endsWith("." + base))) || null;
  } catch {
    return null;
  }
}

function githubLogEntries(rawText, account) {
  if (activityProvider(account)?.name !== "GitHub") throw new Error("Chỉ nhập nhật ký GitHub vào tài khoản GitHub.");
  let events;
  try {
    events = JSON.parse(rawText.trim());
  } catch {
    throw new Error("Tệp không đọc được. Hãy chọn nhật ký bảo mật xuất từ GitHub ở định dạng JSON.");
  }
  if (!Array.isArray(events)) throw new Error("Tệp JSON cần chứa danh sách sự kiện do GitHub xuất.");
  const signIns = ["user.login", "user.new_device_used", "user.sign_in_from_unrecognized_device", "user.sign_in_from_unrecognized_device_and_location"];
  const username = account.user.trim().toLowerCase();
  const regions = new Intl.DisplayNames(["vi"], { type: "region" });
  const entries = [];
  for (const event of events) {
    if (!signIns.includes(event?.action)) continue;
    const actor = event.actor || event.user;
    if (typeof actor !== "string" || !username || actor.toLowerCase() !== username) continue;
    if (event.user && (typeof event.user !== "string" || event.user.toLowerCase() !== username)) continue;
    const timestamp = event.created_at ?? event["@timestamp"];
    if (typeof timestamp !== "number" && !(typeof timestamp === "string" && /^\d{4}-\d\d-\d\dT/.test(timestamp))) continue;
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= 0 || date.getTime() > Date.now()) continue;
    const at = date.toISOString();
    const country = event.actor_location?.country_code ?? event["actor_location.country_code"];
    const code = typeof country === "string" && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : "";
    const userAgent = event.user_agent ?? event.data?.user_agent;
    const device = typeof userAgent === "string" ? userAgent.trim().slice(0, 512) : "";
    const docId = event._document_id;
    const id = typeof docId === "string" && /^[a-z\d_-]{1,200}$/i.test(docId)
      ? "github:id:" + docId
      : ["github", event.action, at, code, device.slice(0, 130)].join(":");
    entries.push({ id, at, place: code ? regions.of(code) : "", device, unrecognized: event.action !== "user.login", source: "github" });
  }
  if (!entries.length) throw new Error("Không tìm thấy lượt đăng nhập thành công phù hợp. Kiểm tra tệp đã xuất và tên người dùng GitHub đã lưu trong kho.");
  return entries;
}

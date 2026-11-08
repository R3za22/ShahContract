import { seedStory, story, type Lang } from "./story";
import { SmartContractWallet } from "./wallet";
import { Revert } from "./adventure";

const T = {
  en: {
    banner: "Demo · sample data · ← rezaghamar.ir", home: "/", dismiss: "Dismiss",
    title: "Shahnameh on-chain", sub: "A branching story and a guardian wallet, running entirely in your browser. No network, no real ETH.",
    credit: "Contract based on Adventureum by anallergytoanalogy. Story text is an original retelling (draft).",
    tabStory: "Story", tabWallet: "Wallet", restart: "Start again", back: "Back", unwritten: "Not yet written — the epic goes on beyond this retelling.",
    onchain: "On-chain view", situation: "Situation", openPaths: "Open pathways", path: "Path", episode: "Episode",
    asking: "Acting as", fund: "Add 10 ETH", setAllowance: "Set allowance", spend: "Spend", amount: "Amount", to: "To",
    guardians: "Guardians", propose: "Vote for new owner", candidate: "Candidate", votes: "Guardian votes", of: "of", log: "Transaction log",
    owner: "Owner", balance: "Balance", allowance: "Allowance", ok: "OK", reverted: "Reverted",
    recovered: "Ownership moved", guardianOn: "is a guardian", guardianOff: "not a guardian", toggle: "Toggle guardian",
    actors: { owner: "Owner (Rostam)", g1: "Guardian 1", g2: "Guardian 2", g3: "Guardian 3", g4: "Guardian 4 (not set)", alice: "Alice (spender)", bob: "Bob (recipient)", newOwner: "New owner (Zal)" },
  },
  fa: {
    banner: "نسخه نمایشی · داده‌های نمونه · ← rezaghamar.ir", home: "/fa/", dismiss: "بستن",
    title: "شاهنامه روی زنجیره", sub: "یک داستان شاخه‌شاخه و یک کیف پول با نگهبان، کاملاً در مرورگر شما. بدون شبکه و بدون اتر واقعی.",
    credit: "قرارداد بر پایه‌ی Adventureum از anallergytoanalogy. متن داستان بازگویی اصلی است (پیش‌نویس).",
    tabStory: "داستان", tabWallet: "کیف پول", restart: "از نو", back: "بازگشت", unwritten: "هنوز نوشته نشده — حماسه فراتر از این بازگویی ادامه دارد.",
    onchain: "نمای زنجیره", situation: "موقعیت", openPaths: "مسیرهای باز", path: "مسیر", episode: "بخش",
    asking: "اقدام به‌عنوان", fund: "افزودن ۱۰ اتر", setAllowance: "تعیین سقف خرج", spend: "خرج کن", amount: "مقدار", to: "به",
    guardians: "نگهبانان", propose: "رأی به مالک جدید", candidate: "نامزد", votes: "رأی نگهبانان", of: "از", log: "گزارش تراکنش‌ها",
    owner: "مالک", balance: "موجودی", allowance: "سقف خرج", ok: "موفق", reverted: "رد شد",
    recovered: "مالکیت منتقل شد", guardianOn: "نگهبان است", guardianOff: "نگهبان نیست", toggle: "تغییر نگهبان",
    actors: { owner: "مالک (رستم)", g1: "نگهبان ۱", g2: "نگهبان ۲", g3: "نگهبان ۳", g4: "نگهبان ۴ (تعیین‌نشده)", alice: "آلیس (خرج‌کننده)", bob: "باب (گیرنده)", newOwner: "مالک جدید (زال)" },
  },
};
const ACTORS = ["owner", "g1", "g2", "g3", "g4", "alice", "bob", "newOwner"] as const;

const params = new URLSearchParams(location.search);
let lang: Lang = params.get("lang") === "fa" ? "fa" : "en";
let tab: "story" | "wallet" = "story";
let bannerOpen = true;
let chain = seedStory();
let current = 0;
let trail: number[] = [0];
let asActor: string = "owner";
let log: { ok: boolean; text: string }[] = [];

function freshWallet() {
  const w = new SmartContractWallet("owner");
  w.fund(10);
  (["g1", "g2", "g3"] as const).forEach((g) => w.setGuardian("owner", g, true));
  w.setAllowance("owner", "alice", 3);
  return w;
}
let wallet = freshWallet();

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const nameOf = (a: string) => (T[lang].actors as Record<string, string>)[a] ?? a;

function storyView(): string {
  const t = T[lang];
  const ev = chain.situation(current)!;
  const node = story.nodes[ev.situationText];
  const body = node[lang];
  const choices = body.choices.map((label, i) => {
    const next = chain.getNextSituation(current, i);
    return next
      ? `<button class="choice" data-choice="${i}">${esc(label)}</button>`
      : `<button class="choice open" disabled>${esc(label)}<small>${esc(t.unwritten)}</small></button>`;
  }).join("");
  const trailText = trail.map((id) => `#${id}`).join(" → ");
  return `<article class="card" data-testid="story">
    <p class="eyebrow">${t.episode} ${node.ep} · ${esc(story.episodes[node.ep][lang])}</p>
    <p class="story-text" data-testid="story-text">${esc(body.text)}</p>
    <div class="choices" data-testid="choices">${choices || ""}</div>
    <div class="row"><button class="ghost" data-act="back" ${trail.length < 2 ? "disabled" : ""}>${t.back}</button>
    <button class="ghost" data-act="restart">${t.restart}</button></div>
    <p class="chain" dir="ltr" data-testid="chain">${t.onchain}: ${t.situation} #${current} · ${t.openPaths}: ${chain.getPathwayCount()} · ${t.path}: ${trailText}</p>
  </article>`;
}

function walletView(): string {
  const t = T[lang];
  const w = wallet;
  const actorOpts = ACTORS.map((a) => `<option value="${a}" ${a === asActor ? "selected" : ""}>${esc(nameOf(a))}</option>`).join("");
  const guardians = (["g1", "g2", "g3", "g4"]).map((g) =>
    `<li><span>${esc(nameOf(g))} — ${w.guardians.get(g) ? t.guardianOn : t.guardianOff}</span>
     <button class="ghost" data-guardian="${g}">${t.toggle}</button></li>`).join("");
  const votes = ["g1", "g2", "g3", "g4"].filter((g) => w.hasVoted("newOwner", g)).map((g) => esc(nameOf(g))).join(", ");
  const rows = [...w.allowance.entries()].map(([k, v]) => `${esc(nameOf(k))}: ${v}`).join(" · ");
  return `<article class="card" data-testid="wallet">
    <div class="stats"><div><span>${t.owner}</span><b data-testid="owner">${esc(nameOf(w.owner))}</b></div>
    <div><span>${t.balance}</span><b data-testid="balance">${w.balance} ETH</b></div>
    <div><span>${t.allowance}</span><b data-testid="allowances">${rows || "—"}</b></div></div>
    <label>${t.asking} <select id="as" data-testid="as">${actorOpts}</select></label>
    <div class="row"><button data-act="fund" data-testid="fund">${t.fund}</button></div>
    <fieldset><legend>${t.setAllowance}</legend>
      <input id="allow-amt" type="number" min="0" value="3" aria-label="${t.amount}" />
      <button data-act="allow" data-testid="allow">${t.setAllowance} → ${esc(nameOf("alice"))}</button></fieldset>
    <fieldset><legend>${t.spend}</legend>
      <input id="spend-amt" type="number" min="0" value="2" aria-label="${t.amount}" />
      <button data-act="spend" data-testid="spend">${t.spend} → ${esc(nameOf("bob"))}</button></fieldset>
    <fieldset><legend>${t.guardians}</legend><ul class="guards">${guardians}</ul>
      <button data-act="propose" data-testid="propose">${t.propose}: ${esc(nameOf("newOwner"))}</button>
      <p data-testid="votes">${t.votes}: ${w.nextOwner === "newOwner" ? w.guardianResetCount : 0} ${t.of} ${SmartContractWallet.CONFIRMATIONS}${votes ? " (" + votes + ")" : ""}</p></fieldset>
    <h3>${t.log}</h3><ol class="log" aria-live="polite" data-testid="log">${log.map((l) => `<li class="${l.ok ? "ok" : "bad"}">${l.ok ? t.ok : t.reverted}: ${esc(l.text)}</li>`).join("")}</ol>
  </article>`;
}

function render() {
  const t = T[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  document.title = t.title;
  document.getElementById("app")!.innerHTML = `
    ${bannerOpen ? `<div class="banner" role="note" data-testid="banner"><a href="${t.home}">${esc(t.banner)}</a>
      <span><button class="ghost" data-act="lang">${lang === "en" ? "فارسی" : "English"}</button>
      <button class="ghost" data-act="dismiss" aria-label="${t.dismiss}">×</button></span></div>` : ""}
    <main class="${bannerOpen ? "with-banner" : ""}">
      <h1>${esc(t.title)}</h1><p class="sub">${esc(t.sub)}</p>
      <nav role="tablist"><button role="tab" aria-selected="${tab === "story"}" data-tab="story">${t.tabStory}</button>
      <button role="tab" aria-selected="${tab === "wallet"}" data-tab="wallet">${t.tabWallet}</button>
      ${bannerOpen ? "" : `<button class="ghost" data-act="lang">${lang === "en" ? "فارسی" : "English"}</button>`}</nav>
      ${tab === "story" ? storyView() : walletView()}
      <footer>${esc(t.credit)}</footer>
    </main>`;
}

function attempt(label: string, fn: () => void) {
  try { fn(); log.unshift({ ok: true, text: label }); }
  catch (e) { if (!(e instanceof Revert)) throw e; log.unshift({ ok: false, text: `${label} — ${e.message}` }); }
}

document.addEventListener("click", (ev) => {
  const el = (ev.target as HTMLElement).closest("button") as HTMLButtonElement | null;
  if (!el || el.disabled) return;
  const d = el.dataset;
  if (d.tab) tab = d.tab as typeof tab;
  else if (d.choice !== undefined) { current = chain.getNextSituation(current, Number(d.choice)); trail.push(current); }
  else if (d.guardian) { const g = d.guardian; attempt(`setGuardian(${g}, ${!wallet.guardians.get(g)})`, () => wallet.setGuardian(asActor, g, !wallet.guardians.get(g))); }
  else if (d.act === "dismiss") bannerOpen = false;
  else if (d.act === "lang") lang = lang === "en" ? "fa" : "en";
  else if (d.act === "restart") { current = 0; trail = [0]; }
  else if (d.act === "back") { trail.pop(); current = trail[trail.length - 1]; }
  else if (d.act === "fund") { wallet.fund(10); log.unshift({ ok: true, text: "deposit(10)" }); }
  else if (d.act === "allow") { const n = Number((document.getElementById("allow-amt") as HTMLInputElement).value); attempt(`setAllowance(alice, ${n})`, () => wallet.setAllowance(asActor, "alice", n)); }
  else if (d.act === "spend") { const n = Number((document.getElementById("spend-amt") as HTMLInputElement).value); attempt(`transfer(bob, ${n})`, () => wallet.transfer(asActor, "bob", n)); }
  else if (d.act === "propose") attempt(`proposeNewOwner(newOwner) by ${asActor}`, () => wallet.proposeNewOwner(asActor, "newOwner"));
  else return;
  render();
});
document.addEventListener("change", (ev) => {
  const t = ev.target as HTMLElement;
  if (t.id === "as") { asActor = (t as HTMLSelectElement).value; render(); }
});
render();

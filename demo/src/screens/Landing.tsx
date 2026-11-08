import { useI18n } from "../i18n";
import { href } from "../router";
import { Band, Logo } from "../ui/icons";

export function Landing() {
  const { t, lang } = useI18n();
  const features = [
    { n: lang === "fa" ? "۱" : "١", title: t("landing.f1.title"), body: t("landing.f1.body"), to: "/read", cta: t("landing.f1.cta") },
    { n: lang === "fa" ? "۲" : "٢", title: t("landing.f2.title"), body: t("landing.f2.body"), to: "/write", cta: t("landing.f2.cta") },
    { n: lang === "fa" ? "۳" : "٣", title: t("landing.f3.title"), body: t("landing.f3.body"), to: "/wallet", cta: t("landing.f3.cta") },
  ];
  const steps = [1, 2, 3].map((n) => ({ n: `0${n}`, title: t(`landing.s${n}.title`), body: t(`landing.s${n}.body`) }));
  return (
    <>
      <section class="wrap" style="padding-block:64px 48px">
        <div class="row" style="gap:48px;align-items:center">
          <div class="stack-lg" style="flex:1 1 460px">
            <span class="eyebrow">{t("landing.eyebrow")}</span>
            <h1 data-testid="landing-title">{t("landing.title")}</h1>
            <p class="muted" style="font-size:19px;max-width:540px">{t("landing.lede")}</p>
            <div class="row">
              <a class="btn btn-lg" href={href("/read")} data-testid="start-reading">{t("landing.cta.read")}</a>
              <a class="btn btn-lg btn-ghost" href={href("/write")}>{t("landing.cta.write")}</a>
            </div>
            <div lang={lang === "fa" ? "en" : "fa"} dir={lang === "fa" ? "ltr" : "rtl"} style={`font-family:${lang === "fa" ? "var(--font-display)" : "var(--font-fa)"};font-size:22px;color:var(--gold);font-weight:500`}>{t("landing.tagline.other")}</div>
          </div>
          <div style="flex:1 1 380px;display:flex;justify-content:center"><Hero label={t("landing.hero.alt")} /></div>
        </div>
      </section>
      <div class="wrap"><Band id="band-landing" /></div>
      <section class="wrap" style="padding-block:56px">
        <div class="stack-lg">
          <h2>{t("landing.features.title")}</h2>
          <div class="grid-auto">
            {features.map((f) => (
              <article class="card stack">
                <div class="badge-arch" aria-hidden="true">{f.n}</div>
                <h3>{f.title}</h3><p class="muted">{f.body}</p>
                <a href={href(f.to)} style="font-weight:600;min-height:44px;display:inline-flex;align-items:center">{f.cta}</a>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section class="wrap" style="padding-bottom:64px">
        <div class="card-ink row" style="gap:40px;align-items:flex-start">
          <div class="stack" style="flex:1 1 320px"><h2>{t("landing.how.title")}</h2><p style="color:#D9D5C8">{t("landing.how.body")}</p></div>
          <ol style="flex:2 1 480px;margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px">
            {steps.map((s) => (
              <li class="stack" style="gap:6px"><span class="mono" style="color:var(--gold-on-ink);font-size:14px">{s.n}</span><strong style="color:var(--folio)">{s.title}</strong><span style="color:#D9D5C8;font-size:15px">{s.body}</span></li>
            ))}
          </ol>
        </div>
        <p class="small muted row" style="margin-top:20px"><Logo size={18} /> {t("landing.note")}</p>
      </section>
    </>
  );
}

function Hero({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 420 480" width="100%" style="max-width:420px" role="img" aria-label={label}>
      <path d="M20 470 V210 C20 120 130 80 210 12 C290 80 400 120 400 210 V470Z" fill="#15213A" />
      <path d="M34 470 V214 C34 130 138 92 210 32 C282 92 386 130 386 214 V470Z" fill="none" stroke="#E3B964" stroke-width="1.5" />
      <circle cx="210" cy="116" r="26" fill="#E3B964" />
      <g stroke="#F5EFE2" stroke-opacity=".45" stroke-width="2" fill="none"><path d="M210 420 L130 340 M210 420 L290 340 M130 340 L80 262 M130 340 L180 262 M290 340 L250 262 M290 340 L340 262 M180 262 L150 196 M250 262 L270 196 M80 262 L70 206" /></g>
      <path d="M210 420 L130 340 L180 262 L210 190 L210 142" stroke="#E3B964" stroke-width="3.5" fill="none" />
      <g fill="#F5EFE2"><circle cx="80" cy="262" r="6" /><circle cx="250" cy="262" r="6" /><circle cx="340" cy="262" r="6" /><circle cx="150" cy="196" r="6" /><circle cx="270" cy="196" r="6" /><circle cx="70" cy="206" r="5" /><circle cx="290" cy="340" r="7" /></g>
      <g fill="#E3B964"><circle cx="130" cy="340" r="8" /><circle cx="180" cy="262" r="8" /><circle cx="210" cy="190" r="8" /></g>
      <circle cx="210" cy="420" r="11" fill="#A63A22" /><path d="M60 470h300" stroke="#E3B964" stroke-width="2" />
    </svg>
  );
}

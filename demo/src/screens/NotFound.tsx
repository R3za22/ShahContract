import { useI18n } from "../i18n";
import { href } from "../router";

export function NotFound() {
  const { t } = useI18n();
  return (
    <div class="wrap page"><div class="empty" data-testid="not-found">
      <h1>404</h1><h2>{t("notfound.title")}</h2><p class="muted">{t("notfound.body")}</p>
      <a class="btn" href={href("/")}>{t("notfound.home")}</a>
    </div></div>
  );
}

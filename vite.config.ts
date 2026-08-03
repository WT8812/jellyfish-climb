import { defineConfig, loadEnv } from "vite";
import siteConfig from "./site.config.json";

const pageEntries = [
  "index.html",
  "404.html",
  "play/index.html",
  "how-to-play/index.html",
  "about/index.html",
  "updates/index.html",
  "faq/index.html",
  "privacy/index.html",
  "terms/index.html",
  "contact/index.html",
  "development-story/index.html",
  "ja/index.html",
  "ja/play/index.html",
  "ja/how-to-play/index.html",
  "ja/about/index.html",
  "ja/updates/index.html",
  "ja/faq/index.html",
  "ja/privacy/index.html",
  "ja/terms/index.html",
  "ja/contact/index.html",
  "ja/development-story/index.html",
];

function normalizeSiteUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function getEntryName(filename: string): string {
  const normalized = filename.replaceAll("\\", "/");
  return [...pageEntries]
    .sort((left, right) => right.length - left.length)
    .find((entry) => normalized.endsWith(`/${entry}`)) ?? "index.html";
}

function getRootPath(entry: string): string {
  const depth = entry.split("/").length - 1;
  return depth === 0 ? "./" : "../".repeat(depth);
}

function getPageKey(entry: string): string {
  const localizedEntry = entry.startsWith("ja/") ? entry.slice(3) : entry;
  if (localizedEntry === "index.html") {
    return "home";
  }
  return localizedEntry.replace(/\/index\.html$/, "").replace(".html", "");
}

function getLocalizedHref(entry: string, rootPath: string): string {
  if (entry.startsWith("ja/")) {
    return `${rootPath}${entry.slice(3)}`;
  }
  if (entry === "404.html") {
    return `${rootPath}ja/`;
  }
  return `${rootPath}ja/${entry}`;
}

function renderHeader(entry: string, rootPath: string): string {
  const isJapanese = entry.startsWith("ja/");
  const pageKey = getPageKey(entry);
  const base = isJapanese ? `${rootPath}ja/` : rootPath;
  const items = isJapanese
    ? [
        ["home", "", "ホーム"],
        ["play", "play/", "プレイ"],
        ["how-to-play", "how-to-play/", "遊び方"],
        ["about", "about/", "このサイトについて"],
        ["updates", "updates/", "更新情報"],
        ["faq", "faq/", "よくある質問"],
      ]
    : [
        ["home", "", "Home"],
        ["play", "play/", "Play"],
        ["how-to-play", "how-to-play/", "How to Play"],
        ["about", "about/", "About"],
        ["updates", "updates/", "Updates"],
        ["faq", "faq/", "FAQ"],
      ];
  const nav = items
    .map(([key, path, label]) => {
      const current = key === pageKey ? ' aria-current="page"' : "";
      const playAttributes =
        key === "play"
          ? ' class="site-nav__play" data-play-source="header_nav"'
          : "";
      return `<a${playAttributes} href="${base}${path}"${current}>${label}</a>`;
    })
    .join("");
  const navLabel = isJapanese ? "メインナビゲーション" : "Main navigation";

  return `<header class="site-header"><div class="site-header__inner"><a class="site-brand" href="${base}" aria-label="Jellyfish Climb home"><span class="site-brand__mark" aria-hidden="true"></span><span>Jellyfish Climb</span></a><nav class="site-nav" aria-label="${navLabel}">${nav}</nav></div></header>`;
}

function renderFooter(entry: string, rootPath: string): string {
  const isJapanese = entry.startsWith("ja/");
  const base = isJapanese ? `${rootPath}ja/` : rootPath;
  const languageLabel = isJapanese ? "English" : "日本語";
  const copyright = isJapanese
    ? "Jellyfish Climb。ゲーム内音源の権利は各制作者・提供元に帰属します。"
    : "Jellyfish Climb. In-game audio remains the property of its respective creators and providers.";
  const links = isJapanese
    ? [
        ["privacy/", "プライバシーポリシー"],
        ["terms/", "利用規約"],
        ["contact/", "お問い合わせ"],
      ]
    : [
        ["privacy/", "Privacy"],
        ["terms/", "Terms"],
        ["contact/", "Contact"],
      ];
  const footerLinks = links
    .map(([path, label]) => `<a href="${base}${path}">${label}</a>`)
    .join("");

  return `<footer class="site-footer"><div class="site-footer__inner"><p>${copyright}</p><nav aria-label="Footer navigation">${footerLinks}<a href="${getLocalizedHref(entry, rootPath)}" hreflang="${isJapanese ? "en" : "ja"}">${languageLabel}</a></nav></div></footer>`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const siteUrl = normalizeSiteUrl(env.SITE_URL || siteConfig.defaultSiteUrl);
  const verification = env.VITE_GOOGLE_SITE_VERIFICATION?.trim();
  const verificationMeta = verification
    ? `<meta name="google-site-verification" content="${verification.replaceAll('"', "&quot;")}">`
    : "";

  return {
    base: "./",
    plugins: [
      {
        name: "jellyfish-site-html",
        transformIndexHtml: {
          order: "pre",
          handler(html, context) {
            const entry = getEntryName(context.filename);
            const rootPath = getRootPath(entry);
            return html
              .replaceAll("%SITE_URL%", siteUrl)
              .replaceAll("%ROOT_PATH%", rootPath)
              .replace("<!-- GOOGLE_SITE_VERIFICATION -->", verificationMeta)
              .replace("<!-- SITE_HEADER -->", renderHeader(entry, rootPath))
              .replace("<!-- SITE_FOOTER -->", renderFooter(entry, rootPath));
          },
        },
      },
    ],
    build: {
      rollupOptions: {
        input: pageEntries,
      },
    },
  };
});

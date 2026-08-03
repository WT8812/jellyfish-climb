import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const config = JSON.parse(await readFile(resolve(root, "site.config.json"), "utf8"));
const siteUrl = (process.env.SITE_URL || config.defaultSiteUrl).trim().replace(/\/+$/, "");
const siteBasePath = new URL(`${siteUrl}/`).pathname.replace(/\/+$/, "");
const soundPath = `${siteBasePath}/sound/`.replace(/^\/\//, "/");
const failures = [];

function routeToFile(route) {
  if (route === "/") {
    return resolve(dist, "index.html");
  }
  if (route.endsWith(".html")) {
    return resolve(dist, route.slice(1));
  }
  return resolve(dist, route.slice(1), "index.html");
}

function hasPattern(html, pattern) {
  return pattern.test(html);
}

async function validateInternalLinks(route, html, canonicalUrl) {
  for (const match of html.matchAll(/<a\s+[^>]*href="([^"]+)"/gi)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|tel:|#)/i.test(href)) continue;
    const resolvedUrl = new URL(href, canonicalUrl);
    if (resolvedUrl.origin !== new URL(siteUrl).origin) continue;
    let pathname = decodeURIComponent(resolvedUrl.pathname);
    if (siteBasePath && pathname.startsWith(siteBasePath)) pathname = pathname.slice(siteBasePath.length) || "/";
    const target = pathname.endsWith("/")
      ? resolve(dist, pathname.slice(1), "index.html")
      : resolve(dist, pathname.slice(1));
    try {
      await access(target);
    } catch {
      failures.push(`${route}: broken internal link ${href}`);
    }
  }
}

for (const route of config.indexableRoutes) {
  const file = routeToFile(route);
  let html;
  try {
    html = await readFile(file, "utf8");
  } catch {
    failures.push(`Missing built page: ${route}`);
    continue;
  }

  const expectedCanonical = `${siteUrl}${route}`;
  const expectedEnglish = route.startsWith("/ja/") ? `${siteUrl}${route.slice(3) || "/"}` : `${siteUrl}${route}`;
  const expectedJapanese = route.startsWith("/ja/") ? `${siteUrl}${route}` : `${siteUrl}/ja${route}`;

  if (!hasPattern(html, /<html\s+lang="(?:en|ja)"/i)) failures.push(`${route}: missing html lang`);
  if (!hasPattern(html, /<title>[^<]{4,}<\/title>/i)) failures.push(`${route}: missing title`);
  if (!hasPattern(html, /<meta\s+name="description"\s+content="[^"]{40,}"/i)) failures.push(`${route}: missing description`);
  if (!html.includes(`<link rel="canonical" href="${expectedCanonical}">`)) failures.push(`${route}: incorrect canonical`);
  if (!html.includes(`<link rel="alternate" hreflang="en" href="${expectedEnglish}">`)) failures.push(`${route}: incorrect hreflang en`);
  if (!html.includes(`<link rel="alternate" hreflang="ja" href="${expectedJapanese}">`)) failures.push(`${route}: incorrect hreflang ja`);
  if (!html.includes(`<link rel="alternate" hreflang="x-default" href="${expectedEnglish}">`)) failures.push(`${route}: incorrect hreflang x-default`);
  if (!hasPattern(html, /<meta\s+property="og:title"/i)) failures.push(`${route}: missing Open Graph title`);
  if (!hasPattern(html, /<meta\s+name="twitter:card"/i)) failures.push(`${route}: missing Twitter card`);

  await validateInternalLinks(route, html, expectedCanonical);
}

for (const route of config.noindexRoutes) {
  const html = await readFile(routeToFile(route), "utf8");
  if (!html.includes('<meta name="robots" content="noindex, follow">')) {
    failures.push(`${route}: missing noindex`);
  }
  const expectedCanonical = `${siteUrl}${route}`;
  if (!html.includes(`<link rel="canonical" href="${expectedCanonical}">`)) {
    failures.push(`${route}: incorrect canonical`);
  }
  await validateInternalLinks(route, html, expectedCanonical);
}

const robots = await readFile(resolve(dist, "robots.txt"), "utf8");
const sitemap = await readFile(resolve(dist, "sitemap.xml"), "utf8");
if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) failures.push("robots.txt: incorrect sitemap URL");
if (!robots.includes(`Disallow: ${soundPath}`)) failures.push("robots.txt: missing sound path exclusion");
for (const route of config.indexableRoutes) {
  if (!sitemap.includes(`<loc>${siteUrl}${route}</loc>`)) failures.push(`sitemap.xml: missing ${route}`);
}
for (const route of config.noindexRoutes) {
  if (sitemap.includes(`${siteUrl}${route}`)) failures.push(`sitemap.xml: noindex route included ${route}`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${config.indexableRoutes.length} indexable pages, internal links, robots.txt, and sitemap.xml.`);
}

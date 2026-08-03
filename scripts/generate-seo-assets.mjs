import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const config = JSON.parse(await readFile(resolve(root, "site.config.json"), "utf8"));
const siteUrl = (process.env.SITE_URL || config.defaultSiteUrl).trim().replace(/\/+$/, "");
const sitePath = new URL(`${siteUrl}/`).pathname.replace(/\/+$/, "");
const soundPath = `${sitePath}/sound/`.replace(/^\/\//, "/");

await mkdir(dist, { recursive: true });

const robots = [
  "User-agent: *",
  "Allow: /",
  `Disallow: ${soundPath}`,
  `Sitemap: ${siteUrl}/sitemap.xml`,
  "",
].join("\n");

const urls = config.indexableRoutes
  .map((route) => `  <url><loc>${siteUrl}${route}</loc></url>`)
  .join("\n");
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  urls,
  "</urlset>",
  "",
].join("\n");

await writeFile(resolve(dist, "robots.txt"), robots, "utf8");
await writeFile(resolve(dist, "sitemap.xml"), sitemap, "utf8");

// TODO(AdSense): Create dist/ads.txt only after a real Publisher ID is issued.
// Expected AdSense format is supplied by Google during account connection.

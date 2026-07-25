import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "sound");
const target = resolve(root, "dist", "sound");
const localOnlyRestrictedAssets = [
  resolve(target, "enviroment", "VSQSE_0612_wind_03.mp3"),
  resolve(target, "flow", "down", "VSQSE_1094_waterfal_01.mp3"),
];

await mkdir(resolve(root, "dist"), { recursive: true });
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true, force: true });

// Keep locally retained restricted assets out of publishable build output.
for (const asset of localOnlyRestrictedAssets) {
  await rm(asset, { force: true });
}

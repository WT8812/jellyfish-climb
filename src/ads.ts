const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID?.trim() ?? "";

/**
 * Future AdSense placements stay hidden until a real ad integration reports that
 * a slot is ready. This prevents blank space and layout shifts while ads are off.
 */
export function initializeAdPlacements(): void {
  const placements = document.querySelectorAll<HTMLElement>("[data-ad-placement]");

  for (const placement of placements) {
    placement.hidden = true;
    placement.dataset.adState = "disabled";
  }

  if (!publisherId) {
    return;
  }

  // TODO(AdSense): After approval, load the official script once and only reveal
  // a placement after its reserved dimensions and ad unit are configured.
  // TODO(AdSense): Generate ads.txt after the issued Publisher ID is confirmed.
}

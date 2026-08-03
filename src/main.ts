import "../styles.css";
import { initializeGame } from "./Game";
import { initializeAdPlacements } from "./ads";
import { initializeAnalytics, trackGameEntry } from "./analytics";

const audioCreditsButton = document.getElementById("audioCreditsButton");
const audioCreditsDialog = document.getElementById("audioCreditsDialog");

if (audioCreditsButton instanceof HTMLButtonElement && audioCreditsDialog instanceof HTMLDialogElement) {
  audioCreditsButton.addEventListener("click", () => {
    audioCreditsDialog.showModal();
  });
}

// アプリの起点。Analyticsは未設定なら何もせず、続けてゲーム本体を初期化する。
initializeAnalytics();
trackGameEntry();
initializeAdPlacements();
initializeGame();

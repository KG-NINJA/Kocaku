import "./styles.css";
import { Game } from "./game/Game";
import { AudioManager } from "./audio/AudioManager";
import { UIManager } from "./ui/UIManager";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
if (!canvas) throw new Error("Canvas element was not found.");

const ui = new UIManager();
const audio = new AudioManager();
let game: Game | undefined;

const launch = async (): Promise<void> => {
  try {
    if (!game) game = new Game(canvas, ui, audio, ui.lowMode.checked);
    await game.start();
  } catch (error) {
    console.error(error);
    ui.showError(error);
  }
};

ui.startButton.addEventListener("click", () => { void launch(); });
ui.retryButton.addEventListener("click", () => { void launch(); });
ui.volume.addEventListener("input", () => audio.setVolume(Number(ui.volume.value)));
ui.muteButton.addEventListener("click", () => {
  const muted = audio.toggleMute();
  ui.muteButton.textContent = muted ? "SOUND OFF" : "SOUND ON";
});

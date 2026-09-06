import "./styles.css";
import { Game } from "./game/Game";
import { AudioManager } from "./audio/AudioManager";
import { UIManager } from "./ui/UIManager";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
if (!canvas) throw new Error("Canvas element was not found.");

const ui = new UIManager();
const audio = new AudioManager();
let game: Game | undefined;
type StageNumber = 1 | 2 | 3 | 4;
let selectedStage: StageNumber = 1;
let launching = false;

const launch = async (stage: StageNumber = selectedStage): Promise<void> => {
  if (launching) return;
  launching = true;
  try {
    selectedStage = stage;
    if (!game) game = new Game(canvas, ui, audio, ui.lowMode.checked);
    ui.lowMode.disabled = true;
    ui.lowMode.title = "画質を変更するにはページを再読み込みしてください";
    await game.start(stage);
  } catch (error) {
    console.error(error);
    ui.showError(error);
  } finally {
    launching = false;
  }
};

ui.stageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const stage = Number(button.dataset.stageStart) as StageNumber;
    if (Number.isInteger(stage) && stage >= 1 && stage <= 4) void launch(stage);
  });
});
ui.retryButton.addEventListener("click", () => { void launch(game?.currentStage ?? selectedStage); });
ui.pauseButton.addEventListener("click", () => game?.setPaused(true));
ui.resumeButton.addEventListener("click", () => game?.setPaused(false));
ui.titleButtons.forEach(button => button.addEventListener("click", () => game?.returnToTitle()));
ui.volume.addEventListener("input", () => audio.setVolume(Number(ui.volume.value)));
ui.muteButton.addEventListener("click", () => {
  const muted = audio.toggleMute();
  ui.muteButton.textContent = muted ? "SOUND OFF" : "SOUND ON";
});

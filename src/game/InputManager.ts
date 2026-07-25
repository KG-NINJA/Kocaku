export interface InputSnapshot {
  forward: number;
  strafe: number;
  roll: number;
  aimX: number;
  aimY: number;
  fire: boolean;
  lock: boolean;
  boost: boolean;
  jumpPressed: boolean;
  scanPressed: boolean;
}

export class InputManager {
  readonly state: InputSnapshot = {
    forward: 0, strafe: 0, roll: 0, aimX: 0, aimY: 0,
    fire: false, lock: false, boost: false, jumpPressed: false, scanPressed: false
  };
  private readonly keys = new Set<string>();
  private movePointer: number | null = null;
  private aimPointer: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private aimLast = { x: 0, y: 0 };
  private readonly touch = matchMedia("(pointer: coarse)").matches;

  constructor(private readonly canvas: HTMLCanvasElement) {
    addEventListener("keydown", this.onKeyDown);
    addEventListener("keyup", this.onKeyUp);
    addEventListener("blur", this.reset);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    addEventListener("pointermove", this.onPointerMove);
    addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => this.touchAction(event, true));
      button.addEventListener("pointerup", (event) => this.touchAction(event, false));
      button.addEventListener("pointercancel", (event) => this.touchAction(event, false));
    });
  }

  get isTouch(): boolean { return this.touch; }

  update(): InputSnapshot {
    this.state.forward = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) || this.state.forward;
    this.state.strafe = (this.keys.has("KeyA") ? 1 : 0) - (this.keys.has("KeyD") ? 1 : 0) || this.state.strafe;
    if (!this.touch) {
      this.state.forward = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
      this.state.strafe = (this.keys.has("KeyA") ? 1 : 0) - (this.keys.has("KeyD") ? 1 : 0);
    }
    this.state.roll = (this.keys.has("KeyE") ? 1 : 0) - (this.keys.has("KeyQ") ? 1 : 0);
    this.state.boost ||= this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    return this.state;
  }

  endFrame(): void {
    this.state.jumpPressed = false;
    this.state.scanPressed = false;
    this.state.aimX *= 0.72;
    this.state.aimY *= 0.72;
    if (!this.keys.has("ShiftLeft") && !this.keys.has("ShiftRight")) this.state.boost = false;
  }

  dispose(): void {
    removeEventListener("keydown", this.onKeyDown);
    removeEventListener("keyup", this.onKeyUp);
    removeEventListener("blur", this.reset);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    removeEventListener("pointermove", this.onPointerMove);
    removeEventListener("pointerup", this.onPointerUp);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
    if (event.code === "Space" && !event.repeat) this.state.jumpPressed = true;
    if (event.code === "KeyF" && !event.repeat) this.state.scanPressed = true;
  };
  private onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };
  private reset = (): void => {
    this.keys.clear();
    Object.assign(this.state, { forward: 0, strafe: 0, roll: 0, fire: false, lock: false, boost: false });
  };
  private onPointerDown = (event: PointerEvent): void => {
    if (this.touch) return;
    if (event.button === 0) this.state.fire = true;
    if (event.button === 2) this.state.lock = true;
    if (!navigator.webdriver && document.pointerLockElement !== this.canvas && document.hasFocus()) {
      void this.canvas.requestPointerLock().catch(() => undefined);
    }
  };
  private onPointerMove = (event: PointerEvent): void => {
    if (!this.touch && document.pointerLockElement === this.canvas) {
      this.state.aimX += event.movementX * 0.0025;
      this.state.aimY += event.movementY * 0.0025;
      return;
    }
    if (event.pointerId === this.movePointer) {
      const dx = event.clientX - this.moveOrigin.x;
      const dy = event.clientY - this.moveOrigin.y;
      this.state.strafe = Math.max(-1, Math.min(1, dx / 55));
      this.state.forward = Math.max(-1, Math.min(1, -dy / 55));
      const stick = document.querySelector<HTMLElement>("#move-stick");
      if (stick) stick.style.transform = `translate(${this.state.strafe * 28}px, ${-this.state.forward * 28}px)`;
    }
    if (event.pointerId === this.aimPointer) {
      this.state.aimX += (event.clientX - this.aimLast.x) * 0.005;
      this.state.aimY += (event.clientY - this.aimLast.y) * 0.005;
      this.aimLast = { x: event.clientX, y: event.clientY };
    }
  };
  private onPointerUp = (event: PointerEvent): void => {
    if (!this.touch) {
      if (event.button === 0) this.state.fire = false;
      if (event.button === 2) this.state.lock = false;
    }
    if (event.pointerId === this.movePointer) {
      this.movePointer = null; this.state.forward = 0; this.state.strafe = 0;
      const stick = document.querySelector<HTMLElement>("#move-stick");
      if (stick) stick.style.transform = "";
    }
    if (event.pointerId === this.aimPointer) this.aimPointer = null;
  };
  bindTouchZones(): void {
    const move = document.querySelector<HTMLElement>("#move-zone");
    const aim = document.querySelector<HTMLElement>("#aim-zone");
    move?.addEventListener("pointerdown", (event) => {
      this.movePointer = event.pointerId; this.moveOrigin = { x: event.clientX, y: event.clientY };
      move.setPointerCapture(event.pointerId);
    });
    aim?.addEventListener("pointerdown", (event) => {
      this.aimPointer = event.pointerId; this.aimLast = { x: event.clientX, y: event.clientY };
      aim.setPointerCapture(event.pointerId);
    });
  }
  private touchAction(event: PointerEvent, active: boolean): void {
    const action = (event.currentTarget as HTMLElement).dataset.action;
    if (action === "fire") this.state.fire = active;
    if (action === "lock") this.state.lock = active;
    if (action === "boost") this.state.boost = active;
    if (action === "jump" && active) this.state.jumpPressed = true;
    if (action === "scan" && active) this.state.scanPressed = true;
  }
}

/** Keyboard, multitouch and gamepad input share one small action interface. */
(() => {
  const S = window.Skate720;
  const bindings = {
    up: ["ArrowUp", "KeyW"],
    down: ["ArrowDown", "KeyS"],
    left: ["ArrowLeft", "KeyA"],
    right: ["ArrowRight", "KeyD"],
    kick: ["KeyX", "ShiftLeft", "ShiftRight"],
    jump: ["Space", "KeyZ"],
    spin: ["KeyC"],
    grind: ["KeyG"],
    enter: ["KeyE", "Enter"],
    pause: ["KeyP", "Escape"],
    mute: ["KeyM"],
    fullscreen: ["KeyF"],
    map: ["Tab"],
  };
  class Input {
    constructor(canvas) {
      this.queuedCollisionToggles = 0;
      this.keys = new Set();
      this.previous = {};
      this.actions = {};
      this.touchKeys = new Set();
      this.controlMode = "point";
      this.deadzone = 0.18;
      this.stick = { x: 0, y: 0, magnitude: 0, active: false };
      this.padName = "";
      this.throttle = 0;
      this.brake = 0;
      this.padSpin = 0;
      this.touchStick = { x: 0, y: 0, magnitude: 0, active: false };
      this.touchStickPointer = null;
      const thumbstick = document.querySelector("#touch-stick");
      this.resetTouchStick = () => {
        this.touchStickPointer = null;
        this.touchStick = { x: 0, y: 0, magnitude: 0, active: false };
        thumbstick?.style.setProperty("--stick-x", "0px");
        thumbstick?.style.setProperty("--stick-y", "0px");
      };
      if (thumbstick) {
        const move = (event) => {
          if (event.pointerId !== this.touchStickPointer) return;
          event.preventDefault();
          const { x, y, radius } = this.touchStickBounds;
          let dx = (event.clientX - x) / radius,
            dy = (event.clientY - y) / radius;
          const length = Math.hypot(dx, dy);
          if (length > 1) {
            dx /= length;
            dy /= length;
          }
          const magnitude = Math.max(
            0,
            (Math.min(1, length) - this.deadzone) / (1 - this.deadzone),
          );
          this.touchStick =
            length > this.deadzone
              ? {
                  x: (dx / Math.min(1, length)) * magnitude,
                  y: (dy / Math.min(1, length)) * magnitude,
                  magnitude,
                  active: true,
                }
              : { x: 0, y: 0, magnitude: 0, active: false };
          thumbstick.style.setProperty("--stick-x", `${dx * radius}px`);
          thumbstick.style.setProperty("--stick-y", `${dy * radius}px`);
        };
        thumbstick.addEventListener("pointerdown", (event) => {
          if (this.touchStickPointer !== null) return;
          const rect = thumbstick.getBoundingClientRect();
          this.touchStickBounds = {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            radius: rect.width * 0.29,
          };
          this.touchStickPointer = event.pointerId;
          thumbstick.setPointerCapture(event.pointerId);
          move(event);
        });
        thumbstick.addEventListener("pointermove", move);
        const release = (event) => {
          if (event.pointerId === this.touchStickPointer)
            this.resetTouchStick();
        };
        for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
          thumbstick.addEventListener(name, release);
      }
      try {
        this.controlMode =
          localStorage.getItem("720-stick-mode") === "rotate"
            ? "rotate"
            : "point";
      } catch {}
      const known = new Set(Object.values(bindings).flat());
      window.addEventListener("keydown", (event) => {
        if (event.code === "F8") {
          event.preventDefault();
          if (!event.repeat) this.queuedCollisionToggles++;
          return;
        }
        // Let sliders, buttons and text fields keep their normal keyboard use.
        if (event.target?.closest?.("input,select,textarea,button,a")) return;
        if (!known.has(event.code)) return;
        event.preventDefault();
        this.keys.add(event.code);
      });
      window.addEventListener("keyup", (event) => this.keys.delete(event.code));
      window.addEventListener("blur", () => this.clear());
      document.querySelectorAll("[data-key]").forEach((button) => {
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
          this.touchKeys.add(button.dataset.key);
          button.classList.add("held");
        });
        const release = () => {
          this.touchKeys.delete(button.dataset.key);
          button.classList.remove("held");
        };
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("lostpointercapture", release);
      });
      canvas.addEventListener("pointerdown", () => canvas.focus());
    }
    consumeCollisionToggle() {
      const toggle = !!(this.queuedCollisionToggles & 1);
      this.queuedCollisionToggles = 0;
      return toggle;
    }
    clear() {
      this.resetTouchStick();
      this.queuedCollisionToggles = 0;
      this.keys.clear();
      this.touchKeys.clear();
      this.actions = {};
      this.previous = {};
      this.throttle = 0;
      this.brake = 0;
      this.padSpin = 0;
      this.stick = { x: 0, y: 0, magnitude: 0, active: false };
      document
        .querySelectorAll("[data-key].held")
        .forEach((button) => button.classList.remove("held"));
    }
    poll() {
      this.previous = this.actions;
      this.actions = {};
      for (const [name, codes] of Object.entries(bindings)) {
        this.actions[name] = codes.some(
          (code) => this.keys.has(code) || this.touchKeys.has(code),
        );
      }
      const pad = Array.from(navigator.getGamepads?.() || []).find(
        (pad) => pad && pad.connected !== false,
      );
      this.padName = pad?.id || "";
      this.throttle = 0;
      this.brake = 0;
      this.padSpin = 0;
      this.stick = { x: 0, y: 0, magnitude: 0, active: false };
      if (pad) {
        const pressed = (index) => !!pad.buttons[index]?.pressed;
        // A radial deadzone preserves arbitrary angles. Independent X/Y cutoffs
        // would turn a shallow diagonal into an unwanted cardinal direction.
        const x = pad.axes[0] || 0,
          y = pad.axes[1] || 0,
          length = Math.hypot(x, y);
        if (length > this.deadzone) {
          const magnitude = Math.min(
            1,
            (length - this.deadzone) / (1 - this.deadzone),
          );
          this.stick = {
            x: (x / length) * magnitude,
            y: (y / length) * magnitude,
            magnitude,
            active: true,
          };
        }
        this.actions.left ||= pressed(14);
        this.actions.right ||= pressed(15);
        this.actions.up ||= pressed(12);
        this.actions.down ||= pressed(13);
        this.actions.jump ||= pressed(1);
        this.actions.kick ||= pressed(0);
        this.actions.grind ||= pressed(2);
        this.actions.enter ||= pressed(3);
        this.actions.pause ||= pressed(9);
        this.actions.map ||= pressed(8);
        this.throttle = pressed(0) ? 1 : 0;
        // LT/RT are grounded turn tricks. Hysteresis prevents analog jitter
        // near the threshold from becoming unintended double taps.
        const leftTrigger = pad.buttons[6]?.value ?? Number(pressed(6));
        const rightTrigger = pad.buttons[7]?.value ?? Number(pressed(7));
        this.triggerLeftHeld =
          leftTrigger > (this.triggerLeftHeld ? 0.25 : 0.55);
        this.triggerRightHeld =
          rightTrigger > (this.triggerRightHeld ? 0.25 : 0.55);
        this.actions.pivotLeft = this.triggerLeftHeld;
        this.actions.pivotRight = this.triggerRightHeld;
        this.padSpin = (pressed(5) ? 1 : 0) - (pressed(4) ? 1 : 0);
        // The right stick is an additional proportional spin control in either mode.
        const right = pad.axes[2] || 0;
        if (Math.abs(right) > 0.2) this.padSpin = right;
      }
      // Touch and physical pads share exactly the same analog control path.
      if (this.touchStickPointer !== null) this.stick = { ...this.touchStick };
    }
    held(name) {
      return !!this.actions[name];
    }
    pressed(name) {
      return this.held(name) && !this.previous[name];
    }
    direction() {
      let x = Number(this.held("right")) - Number(this.held("left"));
      let y = Number(this.held("down")) - Number(this.held("up"));
      const length = Math.hypot(x, y);
      if (length)
        return {
          x: x / length,
          y: y / length,
          magnitude: 1,
          active: true,
          source: "keys",
        };
      if (this.controlMode === "point" && this.stick.active)
        return { ...this.stick, source: "analog" };
      return { x: 0, y: 0, magnitude: 0, active: false, source: "none" };
    }
    toggleMode() {
      this.controlMode = this.controlMode === "point" ? "rotate" : "point";
      try {
        localStorage.setItem("720-stick-mode", this.controlMode);
      } catch {}
      return this.controlMode;
    }
  }
  S.Input = Input;
})();

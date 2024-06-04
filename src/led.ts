import ws281x from "rpi-ws281x-native";

// Assume the second half of the strip has 50 LEDs
const numLEDs = 55;
const channel = ws281x(numLEDs, { stripType: "ws2812", gpio: 21 });

export const enum States {
  OFF = 0,
  WAITING = 1,
  COUNTDOWN = 2,
  PLAYING = 3,
  PHOTO = 4,
}

const FPS = 24;
const PHOTO_TIMEOUT = 1000;
const colorArray = channel.array;

// off animation
function* off(numLEDs: number) {
  const offColor = 0x000000;
  const offAnimation = new Uint32Array(numLEDs).fill(offColor);
  while (true) {
    yield offAnimation;
  }
}

function* white(numLEDs: number) {
  const whiteColor = 0xffffff;
  const whiteAnimation = new Uint32Array(numLEDs).fill(whiteColor);
  while (true) {
    yield whiteAnimation;
  }
}

// New generator function for glowing green animation
function* glowingGreen(numLEDs: number) {
  const minBrightness = 0x33; // 20% brightness in hex
  const maxBrightness = 0xcc; // 80% brightness in hex
  //   const period = 2 * Math.PI; // Full cycle (sine wave)
  const speed = 0.2; // Speed of transition

  let t = 0; // Time variable for sine wave

  while (true) {
    const brightness = Math.round(
      (maxBrightness - minBrightness) * 0.5 * (Math.sin(t) + 1) + minBrightness
    );
    const greenColor = brightness << 8; // Only the green component changes
    const glowingGreenAnimation = new Uint32Array(numLEDs).fill(greenColor);

    yield glowingGreenAnimation;

    t += speed;
  }
}

function* halfBrightnessWhite(numLEDs: number) {
  const whiteColor = 0x7f7f7f;
  const halfBrightnessWhite = new Uint32Array(numLEDs).fill(whiteColor);
  while (true) {
    yield halfBrightnessWhite;
  }
}

function* rainbowAnimation(numLEDs: number) {
  const offColor = 0x000000; // Black
  const greenAnimation = new Uint32Array(numLEDs).fill(offColor);
  let offset = 0;

  while (true) {
    for (let i = 0; i < numLEDs; i++) {
      const hue = (offset + i * 8) % 360;
      const rgbColor = hsvToRgb(hue, 1, 1);
      const color = (rgbColor.r << 16) | (rgbColor.g << 8) | rgbColor.b;
      greenAnimation[i] = color;
    }
    yield greenAnimation;

    // Update offset for shifting the rainbow
    offset = (offset + 12) % 360;
  }
}

// Function to convert HSV to RGB
function hsvToRgb(h: number, s: number, v: number) {
  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = v;
    return { r, g, b };
  }
  h /= 60; // sector 0 to 5
  const i = Math.floor(h);
  const f = h - i; // factorial part of h
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  switch (i) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    default:
      r = v;
      g = p;
      b = q;
      break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function* orangeSwipe(numLEDs: number) {
  const orangeColor = 0xffa500; // Orange color
  const backgroundColor = 0xff8000; // Orange color with reduced brightness
  const swipeLength = 20; // Length of the swipe in LEDs
  let offset = 0;

  while (true) {
    const swipeAnimation = new Uint32Array(numLEDs).fill(backgroundColor);

    for (let i = 0; i < swipeLength; i++) {
      const index = (offset + i) % numLEDs;
      swipeAnimation[index] = orangeColor;
    }

    yield swipeAnimation;

    offset = (offset + 1) % numLEDs;
  }
}

const animationMap: { [key in States]: Generator<Uint32Array> } = {
  [States.OFF]: off(numLEDs),
  [States.COUNTDOWN]: glowingGreen(numLEDs),
  [States.WAITING]: rainbowAnimation(numLEDs),
  [States.PLAYING]: halfBrightnessWhite(numLEDs),
  [States.PHOTO]: white(numLEDs),
};

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const applyAnimation = (animation: Uint32Array) => {
  for (let i = 0; i < numLEDs; i++) {
    colorArray[i] = animation[i];
  }
  ws281x.render();
};

const startAnimations = async () => {
  let state = States.WAITING;
  let stateBuffer: States = state;
  let stateLocked = false;
  process.on("message", (newState: States) => {
    // if locked buffer the state until its unlocked

    if (state == States.PHOTO && newState == States.PHOTO) {
      return;
    }

    if (stateLocked && newState != States.PHOTO) {
      stateBuffer = newState;
      return;
    }

    if (newState == States.PHOTO) {
      stateLocked = true;
      // save old state
      stateBuffer = state;
      setTimeout(() => {
        stateLocked = false;
        state = stateBuffer;
      }, PHOTO_TIMEOUT);
    }
    state = newState;
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const newFrame = animationMap[state].next().value;
    applyAnimation(newFrame);
    await sleep(1000 / FPS);
  }
};

startAnimations();

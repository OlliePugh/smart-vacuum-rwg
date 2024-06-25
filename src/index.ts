import express from "express";
import {
  ELEMENT_TYPE,
  MATCH_STATE,
  Player,
  RWG_EVENT,
  RwgGame,
} from "@OlliePugh/rwg-game";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import http from "http";
import { CONTROL_TYPE, RwgConfig } from "@OlliePugh/rwg-game";
import { init } from "raspi";
import { SoftPWM } from "raspi-soft-pwm";
import { exec, fork } from "child_process";
import { States } from "./led";

let LEFT_WHEEL_FORWARD: SoftPWM | undefined;
let LEFT_WHEEL_BACKWARD: SoftPWM | undefined;
let RIGHT_WHEEL_FORWARD: SoftPWM | undefined;
let RIGHT_WHEEL_BACKWARD: SoftPWM | undefined;
let SWEEPER: SoftPWM | undefined;
let SUCTION: SoftPWM | undefined;
try {
  init(() => {
    LEFT_WHEEL_FORWARD = new SoftPWM("GPIO17");
    LEFT_WHEEL_BACKWARD = new SoftPWM("GPIO22");
    RIGHT_WHEEL_FORWARD = new SoftPWM("GPIO23");
    RIGHT_WHEEL_BACKWARD = new SoftPWM("GPIO24");
    SWEEPER = new SoftPWM("GPIO25");
    SUCTION = new SoftPWM("GPIO8");
  });
} catch (e) {
  console.warn(
    "Failed to initialise GPIO pins, are you running on a Raspberry Pi?"
  );
}

const leds = fork("dist/led.js");
// start stream
exec("bash ./stream.sh", (err, stdout, stderr) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(stdout);
  console.error(stderr);
});

const off = () => {
  console.log("off");
  LEFT_WHEEL_BACKWARD?.write(0);
  LEFT_WHEEL_FORWARD?.write(0);
  RIGHT_WHEEL_BACKWARD?.write(0);
  RIGHT_WHEEL_FORWARD?.write(0);
  SWEEPER?.write(0);
  SUCTION?.write(0);
};

off();

const collected = new Set<number>();

interface Inputs {
  x: number;
  y: number;
}

const axis: Inputs = {
  x: 0,
  y: 0,
};

const directionThreshold = 10;

const updateMovement = () => {
  // Maximum motor speed
  const max_speed = 1;

  // Calculate left and right motor speeds based on joystick input
  let leftMotorSpeed = 0;
  let rightMotorSpeed = 0;

  // Calculate left and right motor speeds based on joystick input
  leftMotorSpeed = axis.y + axis.x;
  rightMotorSpeed = axis.y - axis.x;

  // Ensure motor speeds are within the allowable range
  leftMotorSpeed = Math.max(-max_speed, Math.min(max_speed, leftMotorSpeed));
  rightMotorSpeed = Math.max(-max_speed, Math.min(max_speed, rightMotorSpeed));

  if (leftMotorSpeed >= 0) {
    LEFT_WHEEL_BACKWARD?.write(0);
    LEFT_WHEEL_FORWARD?.write(leftMotorSpeed);
  } else if (leftMotorSpeed < 0) {
    LEFT_WHEEL_BACKWARD?.write(-leftMotorSpeed);
    LEFT_WHEEL_FORWARD?.write(0);
  }
  if (rightMotorSpeed >= 0) {
    RIGHT_WHEEL_BACKWARD?.write(0);
    RIGHT_WHEEL_FORWARD?.write(rightMotorSpeed);
  } else if (rightMotorSpeed < 0) {
    RIGHT_WHEEL_BACKWARD?.write(-rightMotorSpeed);
    RIGHT_WHEEL_FORWARD?.write(0);
  }
};

const onQrCodeScan = (qrValue: string | null, player: Player) => {
  const id = Number(qrValue);
  if (isNaN(id)) {
    return;
  }

  const alreadyCollected = collected.has(id);

  if (alreadyCollected) {
    return;
  }

  collected.add(id);
  player.updateUserInterface({
    "amount-left-text": {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      message: `You have collected ${collected.size} items`,
    },
  });
  console.log(qrValue);
};

const generateConfig = (): RwgConfig => ({
  id: "smart-vacuum-cleaner",
  queueServer: "https://queue.ollieq.co.uk",
  description: "Control a robot vacuum cleaner to clean up the room!",
  name: "Robot Vacuum Cleaner",
  authenticationRequired: false,
  timeLimit: 60,
  userInterface: [
    {
      id: "y-joystick",
      type: CONTROL_TYPE.JOYSTICK,
      control: [
        {
          id: "not-used-1",
          inputMap: [
            { keyCodes: [], weight: 0 },
            { keyCodes: [], weight: 0 },
          ],
        },
        {
          id: "forward-backward",
          inputMap: [
            { keyCodes: ["KeyW", "ArrowUp"], weight: 100 },
            { keyCodes: ["KeyS", "ArrowDown"], weight: -100 },
          ],
        },
      ],
      rateLimit: 10,
      position: {
        x: 0.2,
        y: 0.8,
      },
      displayOnDesktop: false,
      size: 0.5,
    },
    {
      id: "x-joystick",
      type: CONTROL_TYPE.JOYSTICK,
      control: [
        {
          id: "left-right",
          inputMap: [
            { keyCodes: ["KeyD", "ArrowRight"], weight: 100 },
            { keyCodes: ["KeyA", "ArrowLeft"], weight: -100 },
          ],
        },
        {
          id: "not-used-2",
          inputMap: [
            { keyCodes: [], weight: 0 },
            { keyCodes: [], weight: 0 },
          ],
        },
      ],
      rateLimit: 10,
      position: {
        x: 0.8,
        y: 0.8,
      },
      displayOnDesktop: false,
      size: 0.5,
    },
    {
      id: "countdown",
      type: ELEMENT_TYPE.COUNTDOWN,
      position: {
        x: 0.9,
        y: 0.1,
      },
      anchor: "topRight",
      shadow: true,
      size: 1,
      displayOnDesktop: true,
      color: "white",
    },
    {
      id: "qr-button",
      type: CONTROL_TYPE.BUTTON,
      control: {
        id: "qr-button",
        inputMap: [{ keyCodes: ["KeyE"], weight: 1 }],
      },
      rateLimit: 10,
      position: {
        x: 0.8,
        y: 0.4,
      },
      displayOnDesktop: true,
      size: 0.5,
      message: "Capture QR Code (E)",
    },
    {
      id: "amount-left-text",
      type: ELEMENT_TYPE.TEXT,
      anchor: "topCenter",
      position: {
        x: 0.5,
        y: 0.1,
      },
      displayOnDesktop: true,
      size: 0.5,
      color: "white",
      shadow: true,
      message: "You have collected 0 items",
    },
  ],
  countdownSeconds: 3,
  controllables: [
    {
      id: "roomba",
      onControl: (payload, { playerId }) => {
        const inputs = Array.isArray(payload) ? payload : [payload];
        inputs.forEach((input) => {
          if (input.controlName === "forward-backward") {
            if (
              input.value > directionThreshold ||
              input.value < -directionThreshold
            ) {
              axis.y = input.value / 100;
            } else {
              axis.y = 0;
            }
          }

          if (input.controlName === "left-right") {
            if (
              input.value > directionThreshold ||
              input.value < -directionThreshold
            ) {
              axis.x = input.value / 100;
            } else {
              axis.x = 0;
            }
          }
          const player = gameServer.currentMatch
            .getPlayers()
            .find((p) => p.id === playerId)!;

          if (input.controlName === "qr-button" && input.value) {
            leds.send(States.PHOTO);
            fetch("http://192.168.1.187:3333")
              .then(async (result) => onQrCodeScan(await result.text(), player))
              .catch(() => console.log("failed to scan QR code"));
          }
          updateMovement();
        });
      },
      stream: {
        address: "wss://stream.ollieq.co.uk/ws",
        id: 1,
        port: 8004,
      },
    },
  ],
});

const app = express();

app.use(
  cors({
    origin: "https://play.ollieq.co.uk",
  })
);

const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: "https://play.ollieq.co.uk",
  },
});

const gameServer = new RwgGame(generateConfig(), httpServer, app, io);

gameServer.on(RWG_EVENT.MATCH_STATE_CHANGE, (state) => {
  switch (state) {
    case MATCH_STATE.COMPLETED:
      off();
      leds.send(States.WAITING);
      collected.clear();
      break;
    case MATCH_STATE.COUNTDOWN:
      leds.send(States.COUNTDOWN);
      break;
    case MATCH_STATE.IN_MATCH:
      leds.send(States.PLAYING);
      SWEEPER?.write(1);
      SUCTION?.write(1);
      break;
    default:
      break;
  }
});

const port = process.env.PORT || 80;
httpServer.listen(port, () => {
  console.log(`listening to port ${port}`);
});

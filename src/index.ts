import express from "express";
import { MATCH_STATE, RWG_EVENT, RwgGame } from "@OlliePugh/rwg-game";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import http from "http";
import { Gpio } from "onoff";
import { CONTROL_TYPE, RwgConfig } from "@OlliePugh/rwg-game";

// move to
//https://www.npmjs.com/package/raspi-soft-pwm

let LEFT_WHEEL_FORWARD: Gpio | undefined;
let LEFT_WHEEL_BACKWARD: Gpio | undefined;
let RIGHT_WHEEL_FORWARD: Gpio | undefined;
let RIGHT_WHEEL_BACKWARD: Gpio | undefined;
try {
  LEFT_WHEEL_FORWARD = new Gpio(23, "out");
  LEFT_WHEEL_BACKWARD = new Gpio(24, "out");
  RIGHT_WHEEL_FORWARD = new Gpio(17, "out");
  RIGHT_WHEEL_BACKWARD = new Gpio(22, "out");
} catch (e) {
  console.warn(
    "Failed to initialise GPIO pins, are you running on a Raspberry Pi?"
  );
}

// const forwards = () => {
//   console.log("forwards");
//   LEFT_WHEEL_BACKWARD?.writeSync(0);
//   LEFT_WHEEL_FORWARD?.writeSync(1);
//   RIGHT_WHEEL_BACKWARD?.writeSync(0);
//   RIGHT_WHEEL_FORWARD?.writeSync(1);
// };

// const backwards = () => {
//   console.log("backwards");
//   LEFT_WHEEL_BACKWARD?.writeSync(1);
//   LEFT_WHEEL_FORWARD?.writeSync(0);
//   RIGHT_WHEEL_BACKWARD?.writeSync(1);
//   RIGHT_WHEEL_FORWARD?.writeSync(0);
// };

const off = () => {
  console.log("off");
  LEFT_WHEEL_BACKWARD?.writeSync(0);
  LEFT_WHEEL_FORWARD?.writeSync(0);
  RIGHT_WHEEL_BACKWARD?.writeSync(0);
  RIGHT_WHEEL_FORWARD?.writeSync(0);
};

// const left = () => {
//   console.log("left");
//   LEFT_WHEEL_BACKWARD?.writeSync(1);
//   LEFT_WHEEL_FORWARD?.writeSync(0);
//   RIGHT_WHEEL_BACKWARD?.writeSync(0);
//   RIGHT_WHEEL_FORWARD?.writeSync(1);
// };

// const right = () => {
//   console.log("left");
//   LEFT_WHEEL_BACKWARD?.writeSync(0);
//   LEFT_WHEEL_FORWARD?.writeSync(1);
//   RIGHT_WHEEL_BACKWARD?.writeSync(1);
//   RIGHT_WHEEL_FORWARD?.writeSync(0);
// };

off();

interface Inputs {
  x: number;
  y: number;
}

const axis: Inputs = {
  x: 0,
  y: 0,
};

const directionThreshold = 50;

const updateMovement = () => {
  console.log(axis);
};

const generateConfig = (): RwgConfig => ({
  id: "smart-vacuum-cleaner",
  queueServer: "https://queue.ollieq.co.uk",
  description: "Control a robot vacuum cleaner to clean up the room!",
  name: "Robot Vacuum Cleaner",
  authenticationRequired: false,
  // timeLimit: 60,
  userInterface: [
    {
      id: "control-joystick",
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
          id: "forward-backward",
          inputMap: [
            { keyCodes: ["KeyW", "ArrowUp"], weight: 100 },
            { keyCodes: ["KeyS", "ArrowDown"], weight: -100 },
          ],
        },
      ],
      rateLimit: 10,
      position: {
        x: 0.5,
        y: 0.8,
      },
      displayOnDesktop: true,
      size: 0.5,
    },
  ],
  countdownSeconds: 0,
  controllables: [
    {
      id: "roomba",
      onControl: (payload) => {
        const inputs = Array.isArray(payload) ? payload : [payload];
        inputs.forEach((input) => {
          console.log(input);
          if (input.controlName === "forward-backward") {
            if (
              input.value > directionThreshold ||
              input.value < -directionThreshold
            ) {
              axis.y = input.value;
            } else {
              axis.y = 0;
            }
          }

          if (input.controlName === "left-right") {
            if (
              input.value > directionThreshold ||
              input.value < -directionThreshold
            ) {
              axis.x = input.value;
            } else {
              axis.x = 0;
            }
          }
          updateMovement();
        });
      },
      stream: {
        address: "stream.ollieq.co.uk",
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
  if (state === MATCH_STATE.COMPLETED) {
    off();
  }
});

const port = process.env.PORT || 80;
httpServer.listen(port, () => {
  console.log(`listening to port ${port}`);
});

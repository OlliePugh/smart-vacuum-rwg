import express from "express";
import { MATCH_STATE, RWG_EVENT, RwgGame } from "@OlliePugh/rwg-game";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import http from "http";
import { CONTROL_TYPE, RwgConfig } from "@OlliePugh/rwg-game";
import { init } from "raspi";
import { SoftPWM } from "raspi-soft-pwm";

let LEFT_WHEEL_FORWARD: SoftPWM | undefined;
let LEFT_WHEEL_BACKWARD: SoftPWM | undefined;
let RIGHT_WHEEL_FORWARD: SoftPWM | undefined;
let RIGHT_WHEEL_BACKWARD: SoftPWM | undefined;
try {
  init(() => {
    LEFT_WHEEL_FORWARD = new SoftPWM("GPIO17");
    LEFT_WHEEL_BACKWARD = new SoftPWM("GPIO22");
    RIGHT_WHEEL_FORWARD = new SoftPWM("GPIO23");
    RIGHT_WHEEL_BACKWARD = new SoftPWM("GPIO24");
  });
} catch (e) {
  console.warn(
    "Failed to initialise GPIO pins, are you running on a Raspberry Pi?"
  );
}

const off = () => {
  console.log("off");
  LEFT_WHEEL_BACKWARD?.write(0);
  LEFT_WHEEL_FORWARD?.write(0);
  RIGHT_WHEEL_BACKWARD?.write(0);
  RIGHT_WHEEL_FORWARD?.write(0);
};

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
// TODO it seems like rightMotor speed is incorrect
  console.log({ leftMotorSpeed, rightMotorSpeed });

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

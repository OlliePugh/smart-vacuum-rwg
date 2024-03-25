import express from "express";
import { RwgGame } from "@OlliePugh/rwg-game";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import http from "http";

import { CONTROL_TYPE, RwgConfig } from "@OlliePugh/rwg-game";

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
            { keyCodes: ["D", "ArrowRight"], weight: 1 },
            { keyCodes: ["A", "ArrowLeft"], weight: -1 },
          ],
        },
        {
          id: "forward-backward",
          inputMap: [
            { keyCodes: ["W", "ArrowUp"], weight: 1 },
            { keyCodes: ["S", "ArrowDown"], weight: -1 },
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
        console.log(payload);
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

const port = process.env.PORT || 80;
httpServer.listen(port, () => {
  console.log(`listening to port ${port}`);
});

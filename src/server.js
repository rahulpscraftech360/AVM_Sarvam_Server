import express from "express";
import { WebSocketServer } from "ws";
import config from "./config/config.js";
import setupWebSocket from "./websocket/websocketHandler.js";
import audioService from "./services/audioService.js";
import transcriptionService from "./services/transcriptionService.js";

const app = express();
const server = app.listen(config.port, () => {
  console.log(`Express server is running on http://localhost:${config.port}`);
});

const wss = new WebSocketServer({ server });

setupWebSocket(wss);

// Set up the interval to save every 30 seconds
setInterval(async () => {
  console.log("30 seconds passed, saving file...");
  const fileName = await audioService.saveCurrentBuffer();
  if (fileName) {
    // Get the first connected client, if any
    const client =
      wss.clients.size > 0 ? wss.clients.values().next().value : null;
    transcriptionService.addToQueue(fileName, client);
  }
}, config.saveInterval);

// Cleanup function
process.on("SIGINT", () => {
  console.log("Shutting down...");
  process.exit();
});

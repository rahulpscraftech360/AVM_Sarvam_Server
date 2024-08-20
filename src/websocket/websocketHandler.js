import { WebSocket } from "ws";
import config from "../config/config.js";
import audioService from "../services/audioService.js";
import transcriptionService from "../services/transcriptionService.js";

export default function setupWebSocket(wss) {
  wss.on("connection", (ws) => {
    console.log("Client connected");
    let noDataTimer;

    const resetNoDataTimer = () => {
      clearTimeout(noDataTimer);
      noDataTimer = setTimeout(() => {
        console.log("No data received for 60 seconds, closing connection");
        ws.close();
      }, config.noDataTimeout);
    };

    resetNoDataTimer();

    ws.on("message", async (data) => {
      //console.log(`Received data chunk: ${data.length} bytes`);
      resetNoDataTimer();
      audioService.addAudioChunk(data);
    });

    ws.on("close", async () => {
      console.log("Client disconnected");
      clearTimeout(noDataTimer);
      const fileName = await audioService.saveCurrentBuffer();
      if (fileName) {
        transcriptionService.addToQueue(fileName, null);
      }
    });
  });
}

import { WebSocket } from "ws";
import FormData from "form-data";
import fetch from "node-fetch";
import { promises as fs } from "fs";
import config from "../config/config.js";

class TranscriptionService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  async transcribeFile(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const form = new FormData();
    form.append("file", fileBuffer, {
      filename: "audio.wav",
      contentType: "audio/wav",
    });
    form.append("model", "saaras:v1");

    const response = await fetch(
      "https://api.sarvam.ai/speech-to-text-translate",
      {
        method: "POST",
        headers: { "api-subscription-key": config.sarvamApiKey },
        body: form,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  addToQueue(fileName, client) {
    this.queue.push({ fileName, client });
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const { fileName, client } = this.queue.shift();

    try {
      const transcription = await this.transcribeFile(fileName);
      const transcript = transcription?.transcript || "";
      const responsePayload = {
        type: "Results",
        channel: { alternatives: [{ transcript }] },
        start: 0.0,
        duration: transcript.length / config.sampleRate,
      };

      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(responsePayload));
      } else {
        console.log("No active client to send transcription results");
      }

      await fs.unlink(fileName);
      console.log(`Deleted file: ${fileName}`);
    } catch (error) {
      console.error(`Error processing transcription for ${fileName}:`, error);
    } finally {
      this.isProcessing = false;
      this.processQueue();
    }
  }
}

export default new TranscriptionService();

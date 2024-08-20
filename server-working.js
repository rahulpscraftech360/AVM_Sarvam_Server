// import { WebSocketServer } from 'ws';
// import fs from 'fs/promises';
// import pkg from '@discordjs/opus';
// const { OpusEncoder } = pkg;
// import wav from 'node-wav';

// const wss = new WebSocketServer({ port: 8080 });

// let audioBuffer = [];
// let fileCounter = 0;

// const sampleRate = 16000;
// const channels = 1;
// const frameSize = 320;    // 20ms at 48kHz

// const decoder = new OpusEncoder(sampleRate, channels);

// async function saveBufferAsWav() {
//   if (audioBuffer.length === 0) {
//     console.log("Buffer is empty, skipping save.");
//     return;
//   }

//   let pcmData = [];
//   for (const chunk of audioBuffer) {
//     try {
//       const decoded = decoder.decode(chunk, frameSize);
//       pcmData.push(decoded);
//     } catch (error) {
//       console.error('Error decoding chunk:', error);
//       // Skip this chunk and continue
//     }
//   }

//   if (pcmData.length === 0) {
//     console.log("No valid audio data after decoding, skipping save.");
//     return;
//   }

//   const allPcmData = Buffer.concat(pcmData);

//   // Convert PCM to WAV
//   const wavData = wav.encode([allPcmData], { sampleRate, float: false, bitDepth: 16 });

//   const fileName = `audio_${fileCounter}.wav`;
//   try {
//     await fs.writeFile(fileName, wavData);
//     console.log(`Saved ${fileName} (${audioBuffer.length} chunks, ${wavData.length} bytes)`);
//     fileCounter++;
//     audioBuffer = [];
//   } catch (error) {
//     console.error(`Error saving file ${fileName}:`, error);
//   }
// }

// // Set up the interval to save every 30 seconds
// const saveInterval = 30000; // 30 seconds in milliseconds
// const saveIntervalId = setInterval(async () => {
//   console.log("30 seconds passed, saving file...");
//   await saveBufferAsWav();
// }, saveInterval);

// wss.on('connection', (ws) => {
//   console.log('Client connected');

//   ws.on('message', (data) => {
//     console.log(`Received data chunk: ${data.length} bytes`);
//     audioBuffer.push(Buffer.from(data));
//   });

//   ws.on('close', async () => {
//     console.log('Client disconnected');
//     await saveBufferAsWav();
//   });
// });

// // Cleanup function to clear the interval when the server is shutting down
// process.on('SIGINT', () => {
//   clearInterval(saveIntervalId);
//   console.log('Interval cleared. Shutting down...');
//   process.exit();
// });

// console.log('WebSocket server is running on ws://localhost:8080');
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { promises as fs } from "fs";
import path from "path";
import dotenv from "dotenv";
import FormData from "form-data";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const NO_DATA_TIMEOUT = 15000; // 60 seconds (adjust as needed)
// WebSocket setup
const server = app.listen(port, () => {
  console.log(`Express server is running on http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });

let audioBuffers = [[], []]; // Two buffers for double buffering
let currentBufferIndex = 0;
let fileCounter = 1;
let connectedClient = null;
let transcriptionQueue = []; // Queue to manage transcription tasks
let isProcessingQueue = false; // Flag to track if a transcription is being processed

const sampleRate = 16000;
const channels = 1;
const bitDepth = 16;
const saveInterval = 30000; // 30 seconds in milliseconds
console.log("transcriptionQueue++++++++>>>>>>>______", transcriptionQueue);
// Transcription function
const transcribeFile = async (filePath) => {
  const fileBuffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);

  const form = new FormData();
  form.append("file", fileBuffer, {
    filename: fileName,
    contentType: "audio/wav",
  });
  form.append("model", "saaras:v1");

  console.log("FormData:", form);

  const options = {
    method: "POST",
    headers: {
      "api-subscription-key": process.env.SARVAM_API_KEY,
    },
    body: form,
  };

  const response = await fetch(
    "https://api.sarvam.ai/speech-to-text-translate",
    options
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Response status: ${response.status}`);
    console.error(`Response body: ${errorBody}`);
    throw new Error(
      `HTTP error! status: ${response.status}, body: ${errorBody}`
    );
  }

  return await response.json();
};

// Queue processing function
async function processTranscriptionQueue() {
  if (isProcessingQueue || transcriptionQueue.length === 0) {
    return;
  }
  console.log("processing _____transcriptionQueue>>", transcriptionQueue);
  isProcessingQueue = true;

  const { fileName, client } = transcriptionQueue.shift();

  try {
    const transcription = await transcribeFile(fileName);
    console.log(`Transcription for ${fileName}:`, transcription);
    const transcript = transcription?.transcript || "";
    const responsePayload = {
      type: "Results",
      channel: {
        alternatives: [
          {
            transcript: transcript,
          },
        ],
      },
      start: 0.0, // Explicitly set as double
      duration: transcript.length / sampleRate, // Approximate duration based on length
    };

    console.log(`Transcription for ${fileName}: ${transcript}`);

    // Send the transcription result to the connected client
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(responsePayload));
    }

    // Delete the audio file after transcription
    await fs.unlink(fileName);
    console.log(`Deleted file: ${fileName}`);
  } catch (error) {
    console.error(`Error processing transcription for ${fileName}:`, error);
  } finally {
    isProcessingQueue = false;
    processTranscriptionQueue(); // Process the next task in the queue
  }
}

async function saveBufferAsWav(bufferToSave) {
  if (bufferToSave.length === 0) {
    console.log(bufferToSave);
    console.log("Buffer is empty, skipping save.");
    return;
  }

  const dataSize =
    bufferToSave.reduce((acc, chunk) => acc + chunk.length, 0) * 2; // 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataSize);

  // WAV header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28);
  buffer.writeUInt16LE(channels * (bitDepth / 8), 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Audio data
  let offset = 44;
  for (const chunk of bufferToSave) {
    for (let i = 0; i < chunk.length; i++) {
      buffer.writeInt16LE(chunk[i], offset);
      offset += 2;
    }
  }

  // Save the file with a unique name using fileCounter
  const fileName = `audio_${fileCounter}.wav`;
  try {
    await fs.writeFile(fileName, buffer);
    console.log(
      `Saved ${fileName} (${bufferToSave.length} chunks, ${dataSize} bytes)`
    );

    // Clear the buffer after saving
    bufferToSave.length = 0;

    fileCounter++; // Increment the counter after saving

    // Add the transcription task to the queue
    transcriptionQueue.push({ fileName, client: connectedClient });
    console.log("adde to queu");
    processTranscriptionQueue(); // Start processing the queue
  } catch (error) {
    console.error(`Error saving file ${fileName}:`, error);
  }
}

// Set up the interval to save every 30 seconds
const saveIntervalId = setInterval(async () => {
  console.log("30 seconds passed, saving file...");

  // Swap buffers
  const bufferToSave = audioBuffers[currentBufferIndex];
  currentBufferIndex = (currentBufferIndex + 1) % 2;

  // Save the buffer in the background
  saveBufferAsWav(bufferToSave);
}, saveInterval);

wss.on("connection", (ws) => {
  console.log("Client connected");
  connectedClient = ws; // Store the connected client

  let noDataTimer = setTimeout(() => {
    console.log("No data received for 60 seconds, closing connection");
    ws.close();
  }, NO_DATA_TIMEOUT);

  ws.on("message", (data) => {
    // console.log(`Received data chunk: ${data.length} bytes`);

    clearTimeout(noDataTimer);
    noDataTimer = setTimeout(() => {
      console.log("No data received for 60 seconds, closing connection");
      ws.close();
    }, NO_DATA_TIMEOUT);
    // Convert the received buffer to Int16Array
    const int16Array = new Int16Array(
      data.buffer,
      data.byteOffset,
      data.length / 2
    );
    audioBuffers[currentBufferIndex].push(int16Array);
  });

  ws.on("close", async () => {
    console.log("Client disconnected");
    connectedClient = null; // Clear the stored client
    clearTimeout(noDataTimer); // Clear the timer when the connection is closed

    // Save any remaining audio data
    const bufferToSave = audioBuffers[currentBufferIndex];
    currentBufferIndex = (currentBufferIndex + 1) % 2;
    await saveBufferAsWav(bufferToSave);
  });
});

// Cleanup function to clear the interval when the server is shutting down
process.on("SIGINT", () => {
  clearInterval(saveIntervalId);
  console.log("Interval cleared. Shutting down...");
  process.exit();
});

console.log("WebSocket server is running and attached to Express.js");

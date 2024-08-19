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




import { WebSocketServer } from 'ws';
import fs from 'fs/promises';

const wss = new WebSocketServer({ port: 8080 });

let audioBuffer = [];
let fileCounter = 0;

const sampleRate = 16000;
const channels = 1;
const bitDepth = 16;
const saveInterval = 10000; // 30 seconds in milliseconds

async function saveBufferAsWav() {
  if (audioBuffer.length === 0) {
    console.log("Buffer is empty, skipping save.");
    return;
  }

  const dataSize = audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0) * 2; // 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataSize);

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28);
  buffer.writeUInt16LE(channels * (bitDepth / 8), 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Audio data
  let offset = 44;
  for (const chunk of audioBuffer) {
    for (let i = 0; i < chunk.length; i++) {
      buffer.writeInt16LE(chunk[i], offset);
      offset += 2;
    }
  }

  // Save the file with a unique name using fileCounter
  const fileName = `audio_${fileCounter}.wav`;
  try {
    await fs.writeFile(fileName, buffer);
    console.log(`Saved ${fileName} (${audioBuffer.length} chunks, ${dataSize} bytes)`);
    fileCounter++; // Increment the counter after saving
    audioBuffer = []; // Clear the buffer
  } catch (error) {
    console.error(`Error saving file ${fileName}:`, error);
  }
}

// Set up the interval to save every 30 seconds
const saveIntervalId = setInterval(async () => {
  console.log("30 seconds passed, saving file...");
  await saveBufferAsWav();
}, saveInterval);

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    console.log(`Received data chunk: ${data.length} bytes`);
    // Convert the received buffer to Int16Array
    const int16Array = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
    audioBuffer.push(int16Array);
  });

  ws.on('close', async () => {
    console.log('Client disconnected');
    // Save any remaining audio data
    await saveBufferAsWav();
  });
});

// Cleanup function to clear the interval when the server is shutting down
process.on('SIGINT', () => {
  clearInterval(saveIntervalId);
  console.log('Interval cleared. Shutting down...');
  process.exit();
});

console.log('WebSocket server is running on ws://localhost:8080');
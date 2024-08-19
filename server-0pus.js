import { WebSocketServer } from 'ws';
import fs from 'fs/promises';

import pkg from 'audify';
const { OpusDecoder } = pkg;

import wav from 'wav';

const wss = new WebSocketServer({ port: 8080 });

let audioBuffer = Buffer.alloc(0);
let fileCounter = 0;

const opusDecoder = new OpusDecoder(16000, 1);  // 16000 Hz sample rate

function isValidJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

function stripJSONMessages(buffer) {
    let strippedBuffer = Buffer.from(buffer);
    let jsonStart = -1;
    let jsonEnd = -1;

    for (let i = 0; i < strippedBuffer.length - 1; i++) {
        if (strippedBuffer[i] === 123 && strippedBuffer[i + 1] === 34) { // '{' followed by '"'
            jsonStart = i;
        }
        if (jsonStart !== -1 && strippedBuffer[i] === 125) { // '}'
            jsonEnd = i;
            const jsonMessage = strippedBuffer.slice(jsonStart, jsonEnd + 1).toString();
            if (isValidJSON(jsonMessage)) {
                console.log('Found valid JSON message:', jsonMessage);
                strippedBuffer = Buffer.concat([
                    strippedBuffer.slice(0, jsonStart),
                    strippedBuffer.slice(jsonEnd + 1)
                ]);
                i = -1; // Reset to start of buffer
                jsonStart = -1;
                jsonEnd = -1;
            } else {
                jsonStart = -1;
                jsonEnd = -1;
            }
        }
    }

    return strippedBuffer;
}

function analyzeBuffer(buffer) {
    console.log('Buffer length:', buffer.length);
    console.log('First 32 bytes:', buffer.slice(0, 32).toString('hex'));
    console.log('Last 32 bytes:', buffer.slice(-32).toString('hex'));

    const sampleSize = 2; // Assuming 16-bit PCM
    const numSamples = Math.floor(buffer.length / sampleSize);
    console.log(`Potential number of 16-bit PCM samples: ${numSamples}`);

    const durationMs = (numSamples / 16000) * 1000;
    console.log(`Potential duration: ${durationMs.toFixed(2)} ms`);

    let maxAmplitude = 0;
    for (let i = 0; i < buffer.length; i += sampleSize) {
        const sample = buffer.readInt16LE(i);
        maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
    }
    console.log(`Max amplitude: ${maxAmplitude}`);
}

async function saveAsWav(buffer, filename, sampleRate = 16000, channels = 1, bitDepth = 16) {
    return new Promise((resolve, reject) => {
        const writer = new wav.FileWriter(filename, {
            channels: channels,
            sampleRate: sampleRate,
            bitDepth: bitDepth
        });

        writer.write(buffer);
        writer.end();
        writer.on('finish', () => resolve());
        writer.on('error', (err) => reject(err));
    });
}

async function processAudioData() {
    if (audioBuffer.length === 0) {
        console.log("Buffer is empty, skipping processing.");
        return;
    }

    const strippedBuffer = stripJSONMessages(audioBuffer);

    console.log('Analyzing stripped buffer:');
    analyzeBuffer(strippedBuffer);

    const rawFileName = `raw_audio_${fileCounter}.bin`;
    await fs.writeFile(rawFileName, strippedBuffer);
    console.log(`Saved raw file ${rawFileName} (${strippedBuffer.length} bytes)`);

    try {
        // Try to decode as Opus
        const decodedBuffer = opusDecoder.decode(strippedBuffer);
        await saveAsWav(Buffer.from(decodedBuffer.buffer), `decoded_audio_${fileCounter}.wav`, 16000, 1, 32);
        console.log(`Decoded and saved as WAV: decoded_audio_${fileCounter}.wav`);
    } catch (error) {
        console.error('Error decoding audio:', error.message);
        console.log('Attempting to save as raw PCM...');
        
        // If Opus decoding fails, try to save as raw PCM
        await saveAsWav(strippedBuffer, `raw_pcm_${fileCounter}.wav`, 16000, 1, 16);
        console.log(`Saved as raw PCM WAV: raw_pcm_${fileCounter}.wav`);
    }

    fileCounter++;
    audioBuffer = Buffer.alloc(0); // Clear the buffer
}

// Set up the interval to process data every 5 seconds
const processInterval = 5000; // 5 seconds in milliseconds
const processIntervalId = setInterval(async () => {
    console.log("5 seconds passed, processing data...");
    await processAudioData();
}, processInterval);

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (data) => {
        console.log(`Received data chunk: ${data.length} bytes`);
        audioBuffer = Buffer.concat([audioBuffer, data]);
    });

    ws.on('close', async () => {
        console.log('Client disconnected');
        await processAudioData();
    });
});

// Cleanup function to clear the interval when the server is shutting down
process.on('SIGINT', () => {
    clearInterval(processIntervalId);
    console.log('Interval cleared. Shutting down...');
    process.exit();
});

console.log('WebSocket server is running on ws://localhost:8080');
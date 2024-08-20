import { promises as fs } from "fs";
import config from "../config/config.js";

export const saveBufferAsWav = async (bufferToSave, fileCounter) => {
  if (bufferToSave.length === 0) {
    console.log("Buffer is empty, skipping save.");
    return null;
  }

  const { sampleRate, channels, bitDepth } = config;

  const dataSize =
    bufferToSave.reduce((acc, chunk) => acc + chunk.length, 0) * 2;
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

  const fileName = `audio_${fileCounter}.wav`;
  await fs.writeFile(fileName, buffer);
  console.log(
    `Saved ${fileName} (${bufferToSave.length} chunks, ${dataSize} bytes)`
  );

  return fileName;
};

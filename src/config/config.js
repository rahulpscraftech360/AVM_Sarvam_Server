import dotenv from "dotenv";

dotenv.config();

export default {
  port: process.env.PORT || 8080,
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16,
  saveInterval: 30000,
  noDataTimeout: 40000,
  sarvamApiKey: process.env.SARVAM_API_KEY,
};

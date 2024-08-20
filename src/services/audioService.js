import { saveBufferAsWav } from "../utils/wavEncoder.js";
import config from "../config/config.js";

class AudioService {
  constructor() {
    this.audioBuffers = [[], []];
    this.currentBufferIndex = 0;
    this.fileCounter = 1;
  }

  addAudioChunk(data) {
    const int16Array = new Int16Array(
      data.buffer,
      data.byteOffset,
      data.length / 2
    );
    this.audioBuffers[this.currentBufferIndex].push(int16Array);
  }

  async saveCurrentBuffer() {
    const bufferToSave = this.audioBuffers[this.currentBufferIndex];
    this.currentBufferIndex = (this.currentBufferIndex + 1) % 2;
    const fileName = await saveBufferAsWav(bufferToSave, this.fileCounter);
    if (fileName) {
      this.fileCounter++;
      bufferToSave.length = 0;
    }
    return fileName;
  }
}

export default new AudioService();

import FormData from 'form-data';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

// Example function to handle file upload
export const TranscribeFile = async (req, res) => {
    console.log("heree")
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(path.join(__dirname,'../', req.file.path))); // Use the uploaded file
    form.append('model', 'saaras:v1');

    const options = {
      method: 'POST',
      headers: {
        'api-subscription-key':process.env.SARVAM_API_KEY,
        ...form.getHeaders() // Automatically add the correct Content-Type header for multipart/form-data
      },
      body: form
    };

    const response = await fetch('https://api.sarvam.ai/speech-to-text-translate', options);
    const data = await response.json();
    console.log(data);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

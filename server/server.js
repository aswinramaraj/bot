import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { Groq } from 'groq-sdk';
import textToSpeech from '@google-cloud/text-to-speech';

import Chat from './models/Chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = new URL('.', import.meta.url).pathname;
dotenv.config({ path: `${__dirname}../.env` });

const app = express();
const PORT = Number(process.env.PORT) || 5010;
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:4179';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const mongoUri = process.env.MONGODB_URI;

if (mongoUri) {
  mongoose
    .connect(mongoUri)
    .then(() => console.log('MongoDB connected successfully'))
    .catch((error) => {
      console.error('MongoDB connection failed:', error.message);
    });
} else {
  console.log('MongoDB URI not set. Chat history will be disabled.');
}

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
const googleClient =
  process.env.GOOGLE_TTS_ENABLED === 'true' && process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? new textToSpeech.TextToSpeechClient()
    : null;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'AI bot server is running.' });
});

app.get('/api/history', async (_req, res) => {
  try {
    if (!mongoUri) {
      return res.json({ messages: [] });
    }

    const messages = await Chat.find({}).sort({ createdAt: 1 }).limit(50);
    return res.json({ messages });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch chat history',
      details: error.message,
    });
  }
});

app.post('/api/chat', async (req, res) => {
  const { messages = [] } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'The messages array is required.' });
  }

  if (!groq) {
    return res.status(500).json({
      error: 'GROQ_API_KEY is missing. Add your Groq API key to the .env file.',
    });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages,
      temperature: 0.6,
      max_completion_tokens: 2048,
      top_p: 0.95,
      reasoning_effort: 'default',
      stream: false,
      stop: null,
    });

    const answer =
      completion.choices?.[0]?.message?.content ||
      'I could not generate a response right now.';

    const responseText = Array.isArray(answer) ? answer.join(' ') : answer;

    if (mongoUri && mongoose.connection.readyState === 1) {
      await Chat.insertMany(
        messages
          .filter((message) => message && message.content)
          .map((message) => ({
            role: message.role || 'user',
            content: message.content,
          }))
          .concat({ role: 'assistant', content: responseText })
      );
    }

    return res.json({ text: responseText });
  } catch (error) {
    console.error('Groq chat error:', error);
    return res.status(500).json({
      error: 'Failed to generate a response from Groq.',
      details: error.message,
    });
  }
});

app.get('/api/tts', async (req, res) => {
  const text = req.query.text || 'Hello! I am your AI assistant.';
  const voice = req.query.voice || process.env.DEFAULT_TTS_VOICE || 'Aria';

  if (!groq && !googleClient) {
    return res.status(500).json({
      error: 'No speech provider is configured. Add GROQ_API_KEY or enable Google TTS.',
    });
  }

  try {
    if (process.env.GOOGLE_TTS_ENABLED === 'true' && googleClient) {
      const [response] = await googleClient.synthesizeSpeech({
        input: { text },
        voice: {
          languageCode: 'en-US',
          ssmlGender: 'FEMALE',
          name: 'en-US-Standard-A',
        },
        audioConfig: {
          audioEncoding: 'MP3',
        },
      });

      res.set('Content-Type', 'audio/mpeg');
      return res.send(response.audioContent);
    }

    if (!groq) {
      return res.status(500).json({ error: 'GROQ_API_KEY is missing.' });
    }

    const speech = await groq.audio.speech.create({
      model: 'playai-tts',
      voice,
      input: String(text),
    });

    const arrayBuffer = await speech.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set('Content-Type', 'audio/mpeg');
    return res.send(buffer);
  } catch (error) {
    console.error('TTS generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate speech audio.',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

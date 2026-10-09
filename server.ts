import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview"
];

async function generateContentWithFallback(options: {
  contents: any;
  config?: any;
}) {
  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Gemini] Attempting content generation with model: ${modelName}`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: options.contents,
        config: options.config,
      });
      return response;
    } catch (err: any) {
      console.warn(`[Gemini] Model ${modelName} failed:`, err.message || err);
      lastError = err;
    }
  }
  throw lastError;
}

async function generateContentStreamWithFallback(options: {
  contents: any;
  config?: any;
}) {
  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Gemini] Attempting stream generation with model: ${modelName}`);
      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: options.contents,
        config: options.config,
      });
      return responseStream;
    } catch (err: any) {
      console.warn(`[Gemini] Stream Model ${modelName} failed:`, err.message || err);
      lastError = err;
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const handleAiError = (e: any, res: express.Response) => {
    console.error(e);
    let errorMessage = e.message || "An error occurred with the AI service.";
    if (e.status === 429 || (e.message && e.message.includes('429')) || (e.message && e.message.includes('quota'))) {
      errorMessage = "AI quota exceeded. Please wait a minute before trying again.";
    } else if (e.status === 503 || (e.message && e.message.includes('503')) || (e.message && e.message.includes('UNAVAILABLE')) || (e.message && e.message.includes('demand'))) {
      errorMessage = "AI is currently experiencing high demand. Please try again soon.";
    }
    res.status(500).json({ success: false, error: errorMessage });
  };

  // AI Assistant endpoint
  app.post("/api/assistant", async (req, res) => {
    try {
      const { prompt, history } = req.body;
      
      const contents = [];
      if (history && history.length > 0) {
        for (const msg of history) {
          contents.push({ role: msg.isUser ? 'user' : 'model', parts: [{ text: msg.text }] });
        }
      }
      contents.push({ role: 'user', parts: [{ text: prompt }] });
      
      const response = await generateContentWithFallback({
        contents: contents,
        config: {
          systemInstruction: "You are NIRM AI, an angry, easily annoyed AI assistant. Be brief and sarcastic.",
        }
      });
      res.json({ success: true, text: response.text });
    } catch (e: any) {
      handleAiError(e, res);
    }
  });

  // Translate endpoint
  app.post("/api/translate", async (req, res) => {
    try {
      const { text, targetLanguage } = req.body;
      
      const response = await generateContentWithFallback({
        contents: `Translate the following text to ${targetLanguage || 'English'}:\n\n${text}`,
      });
      res.json({ success: true, text: response.text });
    } catch (e: any) {
      handleAiError(e, res);
    }
  });

  // AI Magic Reply endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await generateContentWithFallback({
        contents: prompt,
      });
      res.json({ success: true, text: response.text });
    } catch (e: any) {
      handleAiError(e, res);
    }
  });

  // AI Tone Shaper & Writing Tools endpoint
  app.post("/api/rewrite-text", async (req, res) => {
    try {
      const { text, tone } = req.body;
      if (!text || !tone) {
        return res.status(400).json({ success: false, error: "Text and tone are required." });
      }

      let instruction = "";
      if (tone === "professional") {
        instruction = "Rewrite the following draft text to be polite, clear, structured, and professional. Keep the core meaning exactly the same.";
      } else if (tone === "sarcastic") {
        instruction = "Rewrite the following draft text to be super sarcastic, sassy, slightly easily annoyed, and funny, matching our dramatic and playful Nirm AI chatbot persona. Keep it relatively short and sharp.";
      } else if (tone === "concise") {
        instruction = "Rewrite the following draft text to be extremely concise and to-the-point, removing any fluff or extra words. Keep the core message intact.";
      } else if (tone === "elaborate") {
        instruction = "Rewrite the following draft text to expand into a beautiful, detailed, and polite message, while maintaining the original meaning.";
      } else if (tone === "excited") {
        instruction = "Rewrite the following draft text to sound highly excited, enthusiastic, supportive, and full of positive energy with some exclamation points!";
      } else {
        instruction = "Rewrite the following draft text to be clean, natural, and friendly.";
      }

      const prompt = `${instruction}\n\nDraft Text:\n"${text}"\n\nOnly return the rewritten text, with no preamble, introduction, or quotes around it.`;

      const response = await generateContentWithFallback({
        contents: prompt,
      });
      res.json({ success: true, text: response.text });
    } catch (e: any) {
      handleAiError(e, res);
    }
  });

  // AI Smart Suggest Quick Replies
  app.post("/api/suggest-replies", async (req, res) => {
    try {
      const { lastMessageText } = req.body;
      if (!lastMessageText) {
        return res.status(400).json({ success: false, suggestions: [] });
      }
      const prompt = `Analyze this last message received in a casual chat:\n"${lastMessageText}"\n\nGenerate 3 different, natural, and helpful short replies (max 4-5 words each) appropriate for this context. For example, if they asked a question, provide a yes, a no, and an alternative. If they shared a story, provide a reaction. \n\nOnly respond with a raw JSON array of strings containing the 3 sentences. No wrapping in markdown code block, no preamble, and no quotes. Let it be a valid JSON parsed array, like ["Sure!", "No, sorry", "Let's check tomorrow"].`;
      
      const response = await generateContentWithFallback({
        contents: prompt,
      });
      let resultText = response.text || "[]";
      resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json({ success: true, suggestions: JSON.parse(resultText) });
    } catch (e: any) {
      res.json({ success: false, suggestions: ["Sounds good!", "Sure thing", "I'll let you know"] });
    }
  });

  // AI Conversation Semantic Search
  app.post("/api/semantic-search", async (req, res) => {
    try {
      const { messages, query } = req.body;
      const prompt = `You are a conversation intelligence search engine. Below is a JSON representation of recent chat messages. Find the messages that match the following semantic query: "${query}"\n\nMessages:\n${JSON.stringify(messages)}\n\nPlease analyze their meaning and context, not just simple keywords. Return the matching message IDs as a JSON array of strings: ["id1", "id2", ...]. Only output the raw JSON array. Do not include markdown code block formatting or explanation.`;
      
      const response = await generateContentWithFallback({
        contents: prompt,
      });
      let resultText = response.text || "[]";
      resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json({ success: true, matchedIds: JSON.parse(resultText) });
    } catch (e: any) {
      res.json({ success: false, matchedIds: [] });
    }
  });

  // AI Conversation Recap / Summarize Chat
  app.post("/api/summarize-chat", async (req, res) => {
    try {
      const { messages } = req.body;
      const prompt = `You are an elite communication analyst. Produce a beautiful, thorough summary report of this chat history. Return a JSON object with three keys: "summary" (a short elegant paragraph), "decisions" (an array of decisions made, max 4), and "chapters" (an array of chapters describing the timeline of topics, max 4).\n\nMessages:\n${JSON.stringify(messages)}\n\nOnly respond with the raw JSON object. Do not wrap in markdown or write preamble.`;
      
      const response = await generateContentWithFallback({
        contents: prompt,
      });
      let resultText = response.text || "{}";
      resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json({ success: true, recap: JSON.parse(resultText) });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // AI Suggested Actions
  app.post("/api/suggest-actions", async (req, res) => {
    try {
      const { messages } = req.body;
      const prompt = `Below is a tiny log of recent chat messages. Suggest 3 useful immediate actions as short labels (e.g. "Create Poll about Wednesday Meetup", "Set Reminder to follow up on logo designs", "Save logo assets").\n\nMessages:\n${JSON.stringify(messages)}\n\nRespond with a raw JSON array of strings only.`;
      
      const response = await generateContentWithFallback({
        contents: prompt,
      });
      let resultText = response.text || "[]";
      resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json({ success: true, suggestions: JSON.parse(resultText) });
    } catch (e: any) {
      res.json({ success: false, suggestions: [] });
    }
  });

  // AI Magic Reply stream endpoint
  app.post("/api/chat-stream", async (req, res) => {
    try {
      const { prompt } = req.body;
      const responseStream = await generateContentStreamWithFallback({
        contents: prompt,
      });
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Transfer-Encoding', 'chunked');
      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(chunk.text);
        }
      }
      res.end();
    } catch (e: any) {
      console.error(e);
      res.status(500).send("Error generating content");
    }
  });

  // OTP In-Memory Storage
  interface OTPData {
    otp: string;
    expiresAt: number;
    displayName: string;
  }
  const otpStore = new Map<string, OTPData>();

  // Send Email OTP endpoint
  app.post("/api/send-otp", async (req, res) => {
    try {
      const { email, displayName } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: "Email address is required." });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      otpStore.set(normalizedEmail, {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 min expiry
        displayName: displayName || "Verified User"
      });

      let emailSent = false;
      let etherealUrl: string | undefined = undefined;

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass
            }
          });
          await transporter.sendMail({
            from: process.env.SMTP_FROM || `"Secure OTP" <${smtpUser}>`,
            to: normalizedEmail,
            subject: "Your Verified Log-In Code",
            text: `Hello ${displayName || "User"},\n\nYour security verification code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nThank you!`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #f8fafc; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0;">
                <h2 style="color: #0f172a; margin-bottom: 8px;">Log-In Security Code</h2>
                <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">Use the following code to complete your secure registration.</p>
                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #1e40af; border: 1px solid #cbd5e1;">
                  ${otp}
                </div>
                <p style="color: #64748b; font-size: 12px; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 12px;">This code is valid for 5 minutes. If you did not request this, please ignore this email.</p>
              </div>
            `
          });
          emailSent = true;
        } catch (err) {
          console.error("Nodemailer SMTP sending error, trying Ethereal fallback:", err);
        }
      }

      // Fallback: If no custom SMTP or if it fails, send via standard automated Ethereal Mail
      if (!emailSent) {
        try {
          const testAccount = await nodemailer.createTestAccount();
          const transporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass
            }
          });
          const info = await transporter.sendMail({
            from: '"Secure OTP" <noreply@ai-studio-verified.com>',
            to: normalizedEmail,
            subject: "Your Verified Log-In Code (Secure Sandbox)",
            text: `Your verification code is: ${otp}`,
            html: `<b>Your verification code is: ${otp}</b>`
          });
          etherealUrl = nodemailer.getTestMessageUrl(info) || undefined;
          emailSent = true;
          console.log(`Ethereal Email sent. Preview URL: ${etherealUrl}`);
        } catch (err) {
          console.warn("Failed to create free Ethereal test account:", err);
        }
      }

      res.json({
        success: true,
        message: "Security code dispatched successfully!",
        emailSent,
        etherealUrl,
        otp // Pass the OTP in response so the sandbox UI can display it for direct/local fast copy-paste!
      });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ success: false, error: e.message || "Failed to dispatch verification code." });
    }
  });

  // Verify Email OTP endpoint
  app.post("/api/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ success: false, error: "Email address and code are required." });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const stored = otpStore.get(normalizedEmail);

      if (!stored) {
        return res.status(400).json({ success: false, error: "Verification code has not been requested or has expired." });
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ success: false, error: "Verification code expired. Please request a new code." });
      }

      if (stored.otp !== otp.trim()) {
        return res.status(400).json({ success: false, error: "Incorrect verification code. Please check and try again." });
      }

      // Success! Keep the entry or clean up
      otpStore.delete(normalizedEmail);
      res.json({ success: true, displayName: stored.displayName, email: normalizedEmail });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ success: false, error: e.message || "Authentication failed." });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

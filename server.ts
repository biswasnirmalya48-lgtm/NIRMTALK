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
    let errorMessage = e.message;
    if (e.status === 429 || (e.message && e.message.includes('429')) || (e.message && e.message.includes('quota'))) {
      errorMessage = "AI quota exceeded. Please wait a minute before trying again.";
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
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
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
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
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
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });
      res.json({ success: true, text: response.text });
    } catch (e: any) {
      handleAiError(e, res);
    }
  });

  // AI Magic Reply stream endpoint
  app.post("/api/chat-stream", async (req, res) => {
    try {
      const { prompt } = req.body;
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
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

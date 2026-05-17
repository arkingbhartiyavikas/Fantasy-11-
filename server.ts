import express from 'express';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 image uploads
  app.use(express.json({ limit: '50mb' }));

  // API route to send email
  app.post('/api/notify-admin', async (req, res) => {
    const { paymentId, userEmail, planId, utr, screenshotPreview } = req.body;
    
    try {
      const targetEmail = 'arkingbhartiyavikas@gmail.com';
      
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("WARN: SMTP_USER or SMTP_PASS environment variables are missing.");
        return res.status(500).json({ 
          error: "ईमेल की सेटिंग (SMTP) सेव नहीं हुई है। कृपया Settings में जाकर SMTP_USER और SMTP_PASS सही से भरें।" 
        });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Construct action links that go back to the app
      const origin = req.headers.origin || req.protocol + '://' + req.get('host');
      const approveTargetUrl = `${origin}/?admin_action=approve&pid=${paymentId}`;
      const rejectTargetUrl = `${origin}/?admin_action=reject&pid=${paymentId}`;

      const mailOptions = {
        from: process.env.SMTP_USER || '"ARKING System" <noreply@arking.com>',
        to: targetEmail,
        subject: `New Premium Payment - UTR: ${utr}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
            <h2 style="color: #0f172a; margin-top: 0;">New Payment Request</h2>
            <p><strong>User Email:</strong> ${userEmail}</p>
            <p><strong>Selected Plan:</strong> ${planId}</p>
            <p><strong>UTR Number:</strong> ${utr}</p>
            <p style="color: #64748b; font-size: 13px;">The payment screenshot is attached to this email.</p>
            
            <div style="margin-top: 30px; display: flex; gap: 15px;">
              <a href="${approveTargetUrl}" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 15px;">Approve & Unlock</a>
              <a href="${rejectTargetUrl}" style="background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reject Payment</a>
            </div>
            
            <p style="margin-top: 30px; font-size: 11px; color: #94a3b8;">
              *Clicking an action will open the app in a new tab. You must be logged into ARKING as the admin to execute the decision.
            </p>
          </div>
        `,
        attachments: screenshotPreview ? [
          {
            filename: `payment_${utr}.jpeg`,
            path: screenshotPreview // base64 data URI supports this natively in nodemailer
          }
        ] : []
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("WARN: SMTP_USER or SMTP_PASS environment variables are missing.");
        return res.status(500).json({ error: "Email delivery simulated due to missing credentials." });
      }

      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Email send error:", error);
      let errorMsg = "ईमेल भेजने में Error: " + (error.message || "Failed to send email");
      if (error.message && error.message.includes('535-5.7.8')) {
        errorMsg = "Login Failed: Gmail के लिए आपको 'App Password' की ज़रूरत है, अपने नॉर्मल Google पासवर्ड से लॉगिन नहीं होगा। 'Manage your Google Account' -> 'Security' -> '2-Step Verification' -> 'App passwords' में जाकर पासवर्ड बनाएं और उसे Settings में SMTP_PASS के अंदर डालें।";
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  // API Routes for Cricket API (Proxy to hide API key)
  app.get('/api/cricket/match_info', async (req, res) => {
    try {
      const apiKey = process.env.CRIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Cricket API Key not configured on the server." });
      }
      const matchId = req.query.id;
      const apiRes = await fetch(`https://api.cricapi.com/v1/match_info?apikey=${apiKey}&id=${matchId}`);
      if (!apiRes.ok) {
        throw new Error(`API returned ${apiRes.status}`);
      }
      const data = await apiRes.json();
      res.json(data);
    } catch (e: any) {
      console.error("Match info proxy error:", e);
      res.status(500).json({ error: e.message || "Failed to fetch match info" });
    }
  });

  app.get('/api/cricket/currentMatches', async (req, res) => {
    try {
      const apiKey = process.env.CRIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Cricket API Key not configured on the server." });
      }
      const offset = req.query.offset || 0;
      const apiRes = await fetch(`https://api.cricapi.com/v1/currentMatches?apikey=${apiKey}&offset=${offset}`);
      if (!apiRes.ok) {
        throw new Error(`API returned ${apiRes.status}`);
      }
      const data = await apiRes.json();
      res.json(data);
    } catch (e: any) {
      console.error("Current matches proxy error:", e);
      res.status(500).json({ error: e.message || "Failed to fetch current matches" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Important: Use * for Express 4 routing fallback to index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

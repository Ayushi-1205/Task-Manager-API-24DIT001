const express = require("express");
const { OpenAI } = require("openai");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/ai/generate-description
 * Generates an AI task description from a task title.
 * Protected by JWT authMiddleware.
 */
router.post("/generate-description", authMiddleware, async (req, res) => {
  try {
    const { title } = req.body || {};

    // 1. Validate that the title exists, is a string, and is non-empty
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Title is required and must be a non-empty string",
      });
    }

    // 2. Validate reasonable title length (max 200 characters)
    if (title.trim().length > 200) {
      return res.status(400).json({
        message: "Title exceeds maximum length limit of 200 characters",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // 3. Gracefully handle unconfigured or placeholder API keys without crashing
    if (!apiKey || !apiKey.trim() || apiKey === "your_api_key_here") {
      console.warn("[AI] OPENAI_API_KEY is not configured or placeholder detected. Returning fallback.");
      return res.status(200).json({
        description: "AI description is temporarily unavailable. Please enter the description manually.",
        fallback: true,
      });
    }

    // 4. Initialize OpenAI client with a 10s request timeout
    const openai = new OpenAI({
      apiKey: apiKey.trim(),
      timeout: 10000,
    });

    // 5. Generate concise task description using chat completions
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant for a task management application. Given a task title, generate a clear, concise, and actionable description (1-2 sentences). Do not include quotes, markdown headers, or bullet points.",
        },
        {
          role: "user",
          content: `Task Title: ${title.trim()}`,
        },
      ],
      max_tokens: 120,
      temperature: 0.7,
    });

    const description = completion.choices?.[0]?.message?.content?.trim();

    if (!description) {
      return res.status(200).json({
        description: "AI description is temporarily unavailable. Please enter the description manually.",
        fallback: true,
      });
    }

    return res.status(200).json({
      description,
      fallback: false,
    });
  } catch (error) {
    // Log error internally without exposing raw stack traces or credentials to the client
    console.error("[AI Service Error]:", error.message || error);

    return res.status(200).json({
      description: "AI description is temporarily unavailable. Please enter the description manually.",
      fallback: true,
    });
  }
});

module.exports = router;

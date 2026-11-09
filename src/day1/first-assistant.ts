
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MAX_ATTEMPTS = 3;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${MAX_ATTEMPTS}...`);

      const response = await ai.interactions.create({
        model: "gemini-3.6-flash",
        input: `
          You are a helpful QA engineering assistant.

          Explain three common causes of
          Playwright test flakiness.

          Keep the explanation simple.
        `,
      });

      console.log("\nAI Response:");
      console.log(response.output_text);

      return; // Success! Exit the function.

    } catch (error: any) {
      const status = error.status ?? error.statusCode;

      // Only retry temporary server overload errors.
      if (status !== 503) {
        throw error;
      }

      console.log("Gemini is temporarily unavailable.");

      if (attempt === MAX_ATTEMPTS) {
        console.error(
          "Gemini remains unavailable. Please try again later."
        );
        return;
      }

      const retryAfter = Number(
        error.headers?.get?.("retry-after")
      );

      const delay = Number.isFinite(retryAfter) &&
        retryAfter > 0
        ? retryAfter * 1000
        : 30000 * 2 ** (attempt - 1);

      console.log(`Retrying in ${delay / 1000} seconds...`);

      await sleep(delay);
    }
  }
}

main().catch(console.error);

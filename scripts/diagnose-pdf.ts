import { readFileSync } from "fs";
import { getAllPdfImages } from "../lib/utils/pdf-to-image";
import axios from "axios";

const PDF_PATH = process.argv[2];
if (!PDF_PATH) {
  console.error("Usage: npx tsx scripts/diagnose-pdf.ts <pdf-path>");
  process.exit(1);
}

async function diagnose() {
  console.log(`\n=== PDF Diagnostic Tool ===\n`);
  console.log(`PDF: ${PDF_PATH}`);

  const pdfBuffer = readFileSync(PDF_PATH);
  console.log(`PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB\n`);

  console.log("--- Converting PDF to images (local pdfjs) ---\n");
  const arrayBuffer = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  );

  const images = await getAllPdfImages(arrayBuffer);
  if (!images || images.length === 0) {
    console.error("ERROR: Failed to convert PDF to images");
    process.exit(1);
  }

  console.log(`Total pages: ${images.length}\n`);

  let totalPayloadSize = 0;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const base64 = img.toString("base64");
    const dataUri = `data:image/png;base64,${base64}`;

    const messages = [
      {
        role: "system",
        content: "Convert the following document page to markdown.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Convert this document page to markdown.",
          },
          {
            type: "image_url",
            image_url: { url: dataUri },
          },
        ],
      },
    ];

    const requestBody = {
      model: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
      messages,
      max_tokens: 4000,
      temperature: 0,
    };

    const jsonPayload = JSON.stringify(requestBody);
    const payloadSizeMB = jsonPayload.length / (1024 * 1024);
    totalPayloadSize += jsonPayload.length;

    console.log(
      `Page ${i + 1}: ` +
        `image=${(img.length / 1024).toFixed(0)}KB, ` +
        `base64=${(base64.length / 1024).toFixed(0)}KB, ` +
        `payload=${payloadSizeMB.toFixed(2)}MB`
    );
  }

  console.log(
    `\nTotal payload across all pages: ${(totalPayloadSize / (1024 * 1024)).toFixed(2)}MB`
  );

  // Now test the API call with just the first page
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    console.log(
      "\n--- Skipping API test (no TOGETHER_API_KEY set) ---"
    );
    console.log(
      "Set TOGETHER_API_KEY to test the actual API call.\n"
    );
    return;
  }

  console.log("\n--- Testing API call with page 1 ---\n");

  const testImage = images[0];
  const testBase64 = testImage.toString("base64");
  const testDataUri = `data:image/png;base64,${testBase64}`;

  try {
    const response = await axios.post(
      "https://api.together.xyz/v1/chat/completions",
      {
        model: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
        messages: [
          {
            role: "system",
            content: "Convert the following document page to markdown.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Convert this document page to markdown.",
              },
              {
                type: "image_url",
                image_url: { url: testDataUri },
              },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    console.log("SUCCESS!");
    console.log(
      `Response content length: ${response.data.choices[0].message.content.length}`
    );
    console.log(
      `Tokens: ${response.data.usage?.prompt_tokens} in, ${response.data.usage?.completion_tokens} out`
    );
  } catch (error: any) {
    console.log("FAILED!");
    if (error.response) {
      console.log(`Status: ${error.response.status} ${error.response.statusText}`);
      console.log(`Response data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log(`Network error: ${error.message}`);
    } else {
      console.log(`Error: ${error.message}`);
    }
  }
}

diagnose().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

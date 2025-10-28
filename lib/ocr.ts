import { zerox } from "zerox";
import axios from "axios";

const togetherVisionModel = async ({
  buffers,
  maintainFormat,
  priorPage,
  prompt,
}: any) => {
  const messages = [
    {
      role: "system",
      content:
        // stolen from zerox: https://github.com/getomni-ai/zerox/blob/91bbb20c50de86067670aa13833afa1b8a73c22e/node-zerox/src/constants.ts#L12
        prompt ||
        `Convert the following document to markdown.
Return only the markdown with no explanation text. Do not include delimiters like \`\`\`markdown or \`\`\`html.

RULES:
  - You must include all information on the page. Do not exclude headers, footers, or subtext.
  - Return tables in an HTML format.
  - Charts & infographics must be interpreted to a markdown format. Prefer table format when applicable.
  - Logos should be wrapped in brackets. Ex: <logo>Coca-Cola<logo>
  - Watermarks should be wrapped in brackets. Ex: <watermark>OFFICIAL COPY<watermark>
  - Page numbers should be wrapped in brackets. Ex: <page_number>14<page_number> or <page_number>9/22<page_number>
  - Prefer using ☐ and ☑ for check boxes.`,
    },
  ];

  if (maintainFormat && priorPage?.length) {
    messages.push({
      role: "system",
      content: `Maintain consistent formatting with previous page:\n\n"""${priorPage}"""`,
    });
  }

  messages.push({
    role: "user",
    content: buffers.map((buffer: Buffer) => ({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${buffer.toString("base64")}`,
      },
    })),
  });

  try {
    const response = await axios.post(
      "https://api.together.xyz/v1/chat/completions",
      {
        model: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
        messages,
        max_tokens: 4000,
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      content: response.data.choices[0].message.content,
      inputTokens: response.data.usage?.prompt_tokens || 0,
      outputTokens: response.data.usage?.completion_tokens || 0,
    };
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error?.message ||
        error.message ||
        "OCR processing failed"
    );
  }
};

export async function ocr(
  filePath: string,
  options?: {
    outputDir?: string;
    maintainFormat?: boolean;
    concurrency?: number;
    cleanup?: boolean;
    trimEdges?: boolean;
    correctOrientation?: boolean;
    maxRetries?: number;
    [key: string]: any;
  }
) {
  return await zerox({
    filePath,
    customModelFunction: togetherVisionModel,

    maintainFormat: false,
    concurrency: 5,
    cleanup: true,
    trimEdges: true,
    correctOrientation: true,
    maxRetries: 2,
    outputDir: "./output",
    credentials: { apiKey: "not-used-but-required" },

    ...options,
  });
}

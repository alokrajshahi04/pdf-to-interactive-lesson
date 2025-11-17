#!/usr/bin/env tsx

/**
 * Test script to verify that flow-diagram lessons can be fixed/retried
 */

import { fixLesson } from "../lib/fix-lesson";
import { QuestionType } from "../lib/types";

const API_KEY = process.env.TOGETHER_API_KEY;

if (!API_KEY) {
  console.error("❌ TOGETHER_API_KEY environment variable not set");
  process.exit(1);
}

// Simulate a failed flow-diagram lesson (from the user's example)
const failedFlowLesson = {
  lesson: {
    title: "Transformer Architecture Flow",
    content: "The Transformer processes input tokens by first converting them to embeddings and adding positional information. These encoded representations then pass through multiple encoder layers containing self-attention and feed-forward networks, ultimately generating output probabilities through the decoder stack.",
    info: "The Transformer's self-attention mechanism allows it to process all sequence positions simultaneously, unlike recurrent networks that process sequentially.",
    question: "Put the following steps in the correct order",
    questionType: QuestionType.FlowDiagram,
    flowConfig: {
      nodes: [
        { id: "input", label: "Input Tokens", type: "start" as const },
        { id: "embeddings", label: "Token Embeddings", type: "process" as const },
        { id: "positional", label: "Add Positional Encoding", type: "process" as const },
        { id: "encoder", label: "Encoder Stack (N Layers)", type: "process" as const },
        { id: "self-attention", label: "Multi-Head Self-Attention", type: "process" as const },
        { id: "feed-forward", label: "Position-wise FFN", type: "process" as const },
        { id: "decoder", label: "Decoder Stack (N Layers)", type: "process" as const },
        { id: "output", label: "Output Probabilities", type: "output" as const }
      ],
      edges: [
        ["input", "embeddings"],
        ["embeddings", "positional"],
        ["positional", "encoder"],
        ["encoder", "self-attention"],
        ["self-attention", "feed-forward"],
        ["feed-forward", "decoder"],
        ["decoder", "output"]
      ] as [string, string][]
    },
    choices: ["Token Embeddings", "Add Positional Encoding", "Multi-Head Self-Attention"],
    slots: ["First", "Second", "Third"],
    answer: [0, 1, 2]
  },
  validationType: "content" as const,
  reason: "Flow lesson validation failed",
  details: [
    "The lesson content contains a significant factual error regarding the Transformer's processing method. The question and answer are incomplete and cannot be validated without the actual choices."
  ]
};

async function testFixFlowLesson() {
  console.log("🧪 Testing flow-diagram lesson fix...\n");

  const moduleTitle = "Understanding the Transformer Architecture";
  const content = `
The Transformer architecture, introduced in "Attention is All You Need" (Vaswani et al., 2017), 
revolutionized natural language processing by eliminating the need for recurrence. The model consists 
of an encoder-decoder structure where both components are composed of stacked layers of self-attention 
and feed-forward networks.

Input Processing:
1. Input tokens are first converted to embeddings (word vectors)
2. Positional encodings are added to give the model information about token positions
3. These representations feed into the encoder

Encoder:
- Consists of N identical layers (typically 6)
- Each layer has two sub-layers:
  * Multi-head self-attention mechanism
  * Position-wise fully connected feed-forward network
- Residual connections and layer normalization are applied

Decoder:
- Also consists of N identical layers
- Has an additional sub-layer for encoder-decoder attention
- Generates output token probabilities autoregressively

The self-attention mechanism allows the model to weigh the importance of different positions 
when encoding each position, enabling parallel processing unlike RNNs.
`;

  const result = await fixLesson({
    failure: failedFlowLesson,
    moduleTitle,
    content,
    apiKey: API_KEY,
    maxRetries: 2
  });

  console.log("\n📊 Result:");
  console.log(`Success: ${result.success}`);
  console.log(`Attempts: ${result.attempts}`);

  if (result.success && result.lesson) {
    console.log("\n✅ Fixed Lesson:");
    console.log(`Title: ${result.lesson.title}`);
    console.log(`Question Type: ${result.lesson.questionType}`);
    console.log(`Content: ${result.lesson.content}`);
    console.log(`Question: ${result.lesson.question}`);
    console.log(`Choices: ${JSON.stringify(result.lesson.choices)}`);
    console.log(`Slots: ${JSON.stringify(result.lesson.slots)}`);
    console.log(`Answer: ${JSON.stringify(result.lesson.answer)}`);
    console.log(`FlowConfig nodes: ${result.lesson.flowConfig?.nodes.length || 0}`);
    console.log(`FlowConfig edges: ${result.lesson.flowConfig?.edges.length || 0}`);
  } else if (result.failure) {
    console.log("\n❌ Failed to fix lesson:");
    console.log(`Reason: ${result.failure.reason}`);
    if (result.failure.details) {
      console.log("Details:");
      result.failure.details.forEach(detail => console.log(`  - ${detail}`));
    }
  }
}

testFixFlowLesson().catch(console.error);


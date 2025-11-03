// Test script to verify node-canvas is working
import { createCanvas } from "canvas";
import fs from "node:fs";

// Create a simple test image
const canvas = createCanvas(200, 200);
const ctx = canvas.getContext("2d");

// Draw a red rectangle
ctx.fillStyle = "red";
ctx.fillRect(50, 50, 100, 100);

// Draw some text
ctx.fillStyle = "blue";
ctx.font = "30px Arial";
ctx.fillText("Test", 60, 110);

// Save it
const buffer = canvas.toBuffer("image/png");
fs.writeFileSync("output/canvas-test.png", buffer);

console.log(`✅ Test image saved: ${buffer.length} bytes`);
console.log(`   If this works, node-canvas is functioning correctly`);

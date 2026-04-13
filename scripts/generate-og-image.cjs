/**
 * Generate OG Image for CA GPTAgent
 * Creates a 1200x630 PNG for social media sharing
 */

const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// Image dimensions (OG standard)
const WIDTH = 1200;
const HEIGHT = 630;

// Create canvas
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Background gradient (dark purple to indigo - matching CA GPTAgent brand)
const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
gradient.addColorStop(0, '#1e1b4b');    // Dark indigo
gradient.addColorStop(0.5, '#312e81');  // Indigo
gradient.addColorStop(1, '#4338ca');    // Lighter indigo

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Add subtle grid pattern
ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
ctx.lineWidth = 1;
for (let x = 0; x < WIDTH; x += 40) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, HEIGHT);
  ctx.stroke();
}
for (let y = 0; y < HEIGHT; y += 40) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(WIDTH, y);
  ctx.stroke();
}

// Decorative circles (AI/tech aesthetic)
ctx.globalAlpha = 0.1;
ctx.fillStyle = '#818cf8';
ctx.beginPath();
ctx.arc(WIDTH - 150, 100, 200, 0, Math.PI * 2);
ctx.fill();

ctx.beginPath();
ctx.arc(100, HEIGHT - 80, 150, 0, Math.PI * 2);
ctx.fill();

ctx.globalAlpha = 1;

// Main title - "CA GPTAgent"
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 84px Arial, sans-serif';
ctx.textAlign = 'center';
ctx.fillText('CA GPTAgent', WIDTH / 2, 240);

// Accent line under title
const lineGradient = ctx.createLinearGradient(WIDTH / 2 - 150, 0, WIDTH / 2 + 150, 0);
lineGradient.addColorStop(0, '#818cf8');
lineGradient.addColorStop(0.5, '#a78bfa');
lineGradient.addColorStop(1, '#818cf8');
ctx.fillStyle = lineGradient;
ctx.fillRect(WIDTH / 2 - 150, 270, 300, 4);

// Tagline
ctx.fillStyle = '#c7d2fe';
ctx.font = '36px Arial, sans-serif';
ctx.fillText('AI-Powered Financial Advisory', WIDTH / 2, 340);

// Feature badges
const features = ['Tax Intelligence', 'Audit Support', '50+ Jurisdictions'];
const badgeY = 430;
const badgeSpacing = 300;
const startX = WIDTH / 2 - badgeSpacing;

features.forEach((feature, i) => {
  const x = startX + i * badgeSpacing;
  
  // Badge background
  ctx.fillStyle = 'rgba(129, 140, 248, 0.2)';
  const badgeWidth = 240;
  const badgeHeight = 44;
  const radius = 22;
  
  // Rounded rectangle
  ctx.beginPath();
  ctx.moveTo(x - badgeWidth/2 + radius, badgeY - badgeHeight/2);
  ctx.lineTo(x + badgeWidth/2 - radius, badgeY - badgeHeight/2);
  ctx.quadraticCurveTo(x + badgeWidth/2, badgeY - badgeHeight/2, x + badgeWidth/2, badgeY - badgeHeight/2 + radius);
  ctx.lineTo(x + badgeWidth/2, badgeY + badgeHeight/2 - radius);
  ctx.quadraticCurveTo(x + badgeWidth/2, badgeY + badgeHeight/2, x + badgeWidth/2 - radius, badgeY + badgeHeight/2);
  ctx.lineTo(x - badgeWidth/2 + radius, badgeY + badgeHeight/2);
  ctx.quadraticCurveTo(x - badgeWidth/2, badgeY + badgeHeight/2, x - badgeWidth/2, badgeY + badgeHeight/2 - radius);
  ctx.lineTo(x - badgeWidth/2, badgeY - badgeHeight/2 + radius);
  ctx.quadraticCurveTo(x - badgeWidth/2, badgeY - badgeHeight/2, x - badgeWidth/2 + radius, badgeY - badgeHeight/2);
  ctx.closePath();
  ctx.fill();
  
  // Badge border
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Badge text
  ctx.fillStyle = '#e0e7ff';
  ctx.font = '20px Arial, sans-serif';
  ctx.fillText(feature, x, badgeY + 7);
});

// Website URL at bottom
ctx.fillStyle = 'rgba(199, 210, 254, 0.7)';
ctx.font = '24px Arial, sans-serif';
ctx.fillText('cagpt.icai.org', WIDTH / 2, HEIGHT - 50);

// Save the image
const outputPath = path.join(__dirname, '../client/public/og-image.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);

console.log(`✅ OG Image created: ${outputPath}`);
console.log(`   Dimensions: ${WIDTH}x${HEIGHT}px`);

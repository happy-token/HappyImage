import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import sharp from 'sharp';

// Define paths
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const projectRoot = path.resolve(__dirname, '..');

const logoDestinations = [
  path.join(projectRoot, 'packages/web-ui/public/logo.svg'),
  path.join(projectRoot, 'resources/icon.svg'),
  path.join(projectRoot, '../document/icons/HappyImage/icon.svg')
];

const trayDestinations = [
  path.join(projectRoot, 'resources/tray-icon.svg'),
  path.join(projectRoot, '../document/icons/HappyImage/tray-icon.svg')
];

const desktopBuildDir = path.join(projectRoot, 'packages/desktop/build');
const iconsetDir = path.join(desktopBuildDir, 'icon.iconset');
const desktopIconSvg = path.join(projectRoot, 'resources/icon.svg');
const desktopTraySvg = path.join(projectRoot, 'resources/tray-icon.svg');

const macIconSizes = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
];

// 1. Premium Master Logo SVG (icon.svg / logo.svg)
// Highly optimized proportions, glassmorphic gloss overlay, center glow, and inset border
const masterIconSVG = `<svg width="1024" height="1024" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Premium Gradient: Indigo to Violet to Rose -->
    <linearGradient id="bg" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4F46E5" />
      <stop offset="50%" stop-color="#8B5CF6" />
      <stop offset="100%" stop-color="#F43F5E" />
    </linearGradient>

    <!-- Glass gloss shine gradient -->
    <linearGradient id="shine" x1="0" y1="4" x2="0" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="0.25" />
      <stop offset="100%" stop-color="white" stop-opacity="0" />
    </linearGradient>

    <!-- Center radial glow behind the face -->
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="white" stop-opacity="0.18" />
      <stop offset="100%" stop-color="white" stop-opacity="0" />
    </radialGradient>

    <clipPath id="squircle">
      <rect x="4" y="4" width="32" height="32" rx="7" ry="7" />
    </clipPath>
  </defs>

  <!-- Squircle background: 10% padding matches macOS icon spec -->
  <rect x="4" y="4" width="32" height="32" rx="7" ry="7" fill="url(#bg)" />

  <!-- Glass shine overlay clipped to squircle -->
  <rect x="4" y="4" width="32" height="16" fill="url(#shine)" clip-path="url(#squircle)" />

  <!-- Center radial glow -->
  <circle cx="20" cy="20" r="16" fill="url(#glow)" clip-path="url(#squircle)" />

  <!-- Inset Border for a crisp, high-end feel -->
  <rect x="4.5" y="4.5" width="31" height="31" rx="6.5" ry="6.5" stroke="white" stroke-width="1" stroke-opacity="0.18" fill="none" />

  <!-- Elements: Face & Camera Corners -->
  <g clip-path="url(#squircle)">
    <!-- Left Eye (normal circle) -->
    <circle cx="14.5" cy="16" r="2.2" fill="white" />

    <!-- Right Eye (Magic Sparkle star representing AI generation, scaled to 6.4px) -->
    <path d="M25.5,12.8 Q25.5,16 28.7,16 Q25.5,16 25.5,19.2 Q25.5,16 22.3,16 Q25.5,16 25.5,12.8 Z" fill="white" />

    <!-- Smile arc (elegant and friendly curve) -->
    <path d="M13,22 Q20,29.5 27,22"
          stroke="white" stroke-width="2.2" stroke-linecap="round" fill="none" />

    <!-- Focus corners representing camera framing/cropping (refined thickness & spacing) -->
    <path d="M13,9 H9 V13" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <path d="M27,9 H31 V13" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <path d="M9,27 V31 H13" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <path d="M31,27 V31 H27" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  </g>
</svg>
`;

// 2. Monochrome Line-Art System Tray Icon (tray-icon.svg)
// Line-art style with solid filled eyes to guarantee legibility at menu bar scale
const trayIconSVG = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Focus corners representing camera framing -->
  <path d="M12 6H6V12" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 6H30V12" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M6 24V30H12" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M30 24V30H24" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Left Eye: Solid circle for crisp rendering at small scale -->
  <circle cx="13.5" cy="14" r="2" fill="black"/>

  <!-- Right Eye (Magic Sparkle star representing AI generation) -->
  <path d="M22.5 11 Q22.5 14 25.5 14 Q22.5 14 22.5 17 Q22.5 14 19.5 14 Q22.5 14 22.5 11 Z" fill="black"/>

  <!-- Smile arc -->
  <path d="M11.5 19.5 Q18 25.5 24.5 19.5" stroke="black" stroke-width="2.5" stroke-linecap="round" fill="none"/>
</svg>
`;

// Helper to write file and ensure directory exists
function writeSVG(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content.trim() + '\n', 'utf8');
  console.log(`Successfully generated: ${filePath}`);
}

async function generateDesktopIcons() {
  fs.mkdirSync(desktopBuildDir, { recursive: true });
  fs.rmSync(iconsetDir, { recursive: true, force: true });
  fs.mkdirSync(iconsetDir, { recursive: true });

  for (const [size, name] of macIconSizes) {
    await sharp(desktopIconSvg).resize(size, size).png().toFile(path.join(iconsetDir, name));
  }

  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(desktopBuildDir, 'icon.icns')], { stdio: 'inherit' });
  fs.rmSync(iconsetDir, { recursive: true, force: true });

  await sharp(desktopIconSvg).resize(512, 512).png().toFile(path.join(desktopBuildDir, 'icon.png'));
  await sharp(desktopTraySvg).resize(18, 18).png().toFile(path.join(desktopBuildDir, 'iconTemplate.png'));
  await sharp(desktopTraySvg).resize(36, 36).png().toFile(path.join(desktopBuildDir, 'iconTemplate@2x.png'));

  console.log(`Generated Electron desktop icons in ${desktopBuildDir}`);
}

// Generate Logos
console.log('Generating HappyImage Brand SVGs...');
logoDestinations.forEach(dest => writeSVG(dest, masterIconSVG));

// Generate Tray Icons
console.log('Generating HappyImage Tray Icon SVGs...');
trayDestinations.forEach(dest => writeSVG(dest, trayIconSVG));

await generateDesktopIcons();

console.log('Icon generation completed successfully!');

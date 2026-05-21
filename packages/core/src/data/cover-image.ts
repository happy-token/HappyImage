import type { SkillDefinition } from '../types/skills'

const types = [
  { id: 'hero', name: 'Hero', description: 'Bold hero image with strong focal point', tags: ['bold', 'hero', 'focal', 'dramatic'], contentHints: 'Product launches, feature announcements, keynote visuals' },
  { id: 'conceptual', name: 'Conceptual', description: 'Abstract representation of an idea', tags: ['abstract', 'idea', 'concept', 'symbolic'], contentHints: 'Thought leadership, concept explainers, abstract ideas' },
  { id: 'typography', name: 'Typography', description: 'Type-driven composition, text as the visual', tags: ['type', 'text', 'quote', 'bold'], contentHints: 'Quotes, manifestos, title-forward articles' },
  { id: 'metaphor', name: 'Metaphor', description: 'Visual metaphor or analogy illustration', tags: ['metaphor', 'analogy', 'symbolic', 'clever'], contentHints: 'Complex concepts, analogies, metaphorical explanations' },
  { id: 'scene', name: 'Scene', description: 'Atmospheric scene-setting illustration', tags: ['atmosphere', 'scene', 'mood', 'narrative'], contentHints: 'Personal stories, narrative pieces, atmospheric content' },
  { id: 'minimal', name: 'Minimal', description: 'Ultra-minimal, single-element focus', tags: ['minimal', 'clean', 'simple', 'elegant'], contentHints: 'Minimalist content, philosophy, elegant branding' },
]

const paletteItems = [
  { id: 'warm', name: 'Warm', description: 'Warm earth tones, cozy and inviting', tags: ['warm', 'earthy', 'cozy', 'sunset'] },
  { id: 'elegant', name: 'Elegant', description: 'Refined, sophisticated tones', tags: ['elegant', 'refined', 'luxury', 'dark'] },
  { id: 'cool', name: 'Cool', description: 'Cool blues and teals, calm', tags: ['cool', 'blue', 'calm', 'tech'] },
  { id: 'dark', name: 'Dark', description: 'Dark and moody, atmospheric', tags: ['dark', 'moody', 'noir', 'atmospheric'] },
  { id: 'earth', name: 'Earth', description: 'Natural earth tones, grounded', tags: ['earth', 'natural', 'green', 'organic'] },
  { id: 'vivid', name: 'Vivid', description: 'Bright, saturated, energetic', tags: ['vivid', 'bright', 'energetic', 'bold'] },
  { id: 'pastel', name: 'Pastel', description: 'Soft pastels, gentle and airy', tags: ['pastel', 'soft', 'gentle', 'airy'] },
  { id: 'mono', name: 'Mono', description: 'Monochromatic, single-hue focus', tags: ['mono', 'single-color', 'minimal', 'focused'] },
  { id: 'retro', name: 'Retro', description: 'Vintage color schemes, nostalgic', tags: ['retro', 'vintage', 'nostalgic', '70s'] },
  { id: 'duotone', name: 'Duotone', description: 'Two-color contrast, striking', tags: ['duotone', 'contrast', 'striking', 'graphic'] },
  { id: 'macaron', name: 'Macaron', description: 'Soft dessert-inspired pastels on cream', tags: ['macaron', 'soft', 'dessert', 'gentle'] },
]

const renderings = [
  { id: 'flat-vector', name: 'Flat Vector', description: 'Clean flat vector illustration', tags: ['flat', 'vector', 'clean', 'modern'] },
  { id: 'hand-drawn', name: 'Hand-Drawn', description: 'Hand-drawn sketch aesthetic', tags: ['hand-drawn', 'sketch', 'organic', 'warm'] },
  { id: 'painterly', name: 'Painterly', description: 'Artistic painted look with visible brushstrokes', tags: ['painterly', 'artistic', 'brush', 'textured'] },
  { id: 'digital', name: 'Digital', description: 'Polished digital rendering with gradients and lighting', tags: ['digital', 'polished', '3D', 'smooth'] },
  { id: 'pixel', name: 'Pixel', description: 'Retro pixel art style, 8-bit aesthetic', tags: ['pixel', '8-bit', 'retro', 'gaming'] },
  { id: 'chalk', name: 'Chalk', description: 'Chalk-on-board texture, educational feel', tags: ['chalk', 'board', 'education', 'textured'] },
  { id: 'screen-print', name: 'Screen Print', description: 'Bold screen-print poster with halftone texture', tags: ['screen-print', 'poster', 'halftone', 'bold'] },
]

const textLevels = [
  { id: 'none', name: 'No Text', description: 'Pure visual, no typography', tags: ['visual-only', 'pure', 'imagery'] },
  { id: 'title-only', name: 'Title Only', description: 'Article title only', tags: ['title', 'minimal', 'clean'] },
  { id: 'title-subtitle', name: 'Title + Subtitle', description: 'Title with supporting subtitle', tags: ['title', 'subtitle', 'standard'] },
  { id: 'text-rich', name: 'Text Rich', description: 'Title, subtitle, and label text', tags: ['rich', 'detailed', 'informative'] },
]

const moods = [
  { id: 'subtle', name: 'Subtle', description: 'Low contrast, understated', tags: ['subtle', 'low-contrast', 'quiet', 'refined'] },
  { id: 'balanced', name: 'Balanced', description: 'Standard contrast, natural feel', tags: ['balanced', 'standard', 'natural'] },
  { id: 'bold', name: 'Bold', description: 'High contrast, dramatic impact', tags: ['bold', 'dramatic', 'high-contrast', 'striking'] },
]

const coverImage: SkillDefinition = {
  id: 'cover-image',
  name: 'Cover Image',
  nameZh: '封面图',
  description: 'Article cover images with a 5-dimensional design system: Type × Palette × Rendering × Text × Mood. 77+ unique combinations.',
  longDescription: 'Create stunning article covers with a sophisticated 5D design system. Combine image type, color palette, rendering style, text treatment, and mood for a precisely tailored cover. With 6 types, 11 palettes, 7 renderings, 4 text levels, and 3 moods — that is thousands of possible combinations.',
  category: 'cover',
  styleType: 'multidimensional',
  dimensions: {
    type: {
      name: 'type',
      label: 'Image Type',
      items: types,
      isRequired: true,
      defaultItem: null,
    },
    palette: {
      name: 'palette',
      label: 'Color Palette',
      items: paletteItems,
      isRequired: true,
      defaultItem: null,
    },
    rendering: {
      name: 'rendering',
      label: 'Rendering Style',
      items: renderings,
      isRequired: true,
      defaultItem: null,
    },
    text: {
      name: 'text',
      label: 'Text Treatment',
      items: textLevels,
      isRequired: true,
      defaultItem: 'title-only',
    },
    mood: {
      name: 'mood',
      label: 'Mood',
      items: moods,
      isRequired: true,
      defaultItem: 'balanced',
    },
  },
  presets: [],
  recommendations: [
    { content: 'Technical, architecture, system design', dimensionMap: { type: 'conceptual', rendering: 'flat-vector', palette: 'cool', mood: 'bold' } },
    { content: 'Personal story, narrative, lifestyle', dimensionMap: { type: 'scene', rendering: 'painterly', palette: 'warm', mood: 'subtle' } },
    { content: 'Business, thought leadership, strategy', dimensionMap: { type: 'conceptual', rendering: 'digital', palette: 'elegant', mood: 'balanced' } },
    { content: 'Product launch, marketing, hype', dimensionMap: { type: 'hero', rendering: 'digital', palette: 'vivid', mood: 'bold' } },
    { content: 'Philosophy, minimalism, zen', dimensionMap: { type: 'minimal', rendering: 'flat-vector', palette: 'mono', mood: 'subtle' } },
    { content: 'Education, tutorial, learning', dimensionMap: { type: 'conceptual', rendering: 'chalk', palette: 'pastel', mood: 'balanced' } },
  ],
  parameters: [
    { name: 'title', label: 'Title', type: 'text', defaultValue: '', placeholder: 'Article title for the cover...' },
    { name: 'subtitle', label: 'Subtitle', type: 'text', defaultValue: '', placeholder: 'Optional subtitle...' },
    { name: 'language', label: 'Language', type: 'select', options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }], defaultValue: 'zh' },
    { name: 'aspectRatio', label: 'Aspect Ratio', type: 'select', options: [{ value: '16:9', label: 'Wide (16:9)' }, { value: '2.35:1', label: 'Cinematic (2.35:1)' }, { value: '4:3', label: 'Standard (4:3)' }, { value: '1:1', label: 'Square (1:1)' }, { value: '3:4', label: 'Portrait (3:4)' }], defaultValue: '16:9' },
  ],
  bestFor: ['Article covers', 'Blog headers', 'Social media banners', 'Newsletter headers', 'Podcast artwork'],
  hasCLI: false,
  outputType: 'images',
  defaultAspectRatio: '16:9',
  screenshotDirs: [
    { dimension: 'style', path: 'cover-image-styles' },
    { dimension: 'type', path: 'cover-image-types' },
    { dimension: 'palette', path: 'cover-image-palettes' },
    { dimension: 'rendering', path: 'cover-image-renderings' },
  ],
}

export default coverImage

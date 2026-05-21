import type { SkillDefinition } from '../types/skills'

const stylePresets = [
  { id: 'blueprint', name: 'Blueprint', description: 'Grid + Cool + Technical + Balanced', tags: ['architecture', 'system', 'technical', 'blueprint'], contentHints: 'Architecture, system design, infrastructure' },
  { id: 'chalkboard', name: 'Chalkboard', description: 'Organic + Warm + Handwritten + Balanced', tags: ['education', 'chalk', 'handwritten', 'warm'], contentHints: 'Education, tutorials, classroom content' },
  { id: 'corporate', name: 'Corporate', description: 'Clean + Professional + Geometric + Balanced', tags: ['corporate', 'business', 'professional', 'clean'], contentHints: 'Investor decks, business proposals, corporate presentations' },
  { id: 'minimal', name: 'Minimal', description: 'Clean + Neutral + Geometric + Minimal', tags: ['minimal', 'clean', 'executive', 'simple'], contentHints: 'Executive briefings, minimalist presentations' },
  { id: 'sketch-notes', name: 'Sketch Notes', description: 'Organic + Warm + Handwritten + Balanced', tags: ['sketch', 'hand-drawn', 'educational', 'warm'], contentHints: 'Educational content, tutorials, sketchnotes' },
  { id: 'hand-drawn-edu', name: 'Hand-Drawn Education', description: 'Organic + Macaron + Handwritten + Balanced', tags: ['hand-drawn', 'education', 'macaron', 'doodle'], contentHints: 'Educational diagrams, process explanations, onboarding' },
  { id: 'watercolor', name: 'Watercolor', description: 'Organic + Warm + Humanist + Minimal', tags: ['watercolor', 'artistic', 'lifestyle', 'soft'], contentHints: 'Lifestyle, wellness, travel, artistic content' },
  { id: 'dark-atmospheric', name: 'Dark Atmospheric', description: 'Clean + Dark + Editorial + Balanced', tags: ['dark', 'atmospheric', 'entertainment', 'gaming'], contentHints: 'Entertainment, gaming, atmospheric presentations' },
  { id: 'notion', name: 'Notion', description: 'Clean + Neutral + Geometric + Dense', tags: ['notion', 'product', 'SaaS', 'dense'], contentHints: 'Product demos, SaaS presentations, documentation' },
  { id: 'bold-editorial', name: 'Bold Editorial', description: 'Clean + Vibrant + Editorial + Balanced', tags: ['bold', 'editorial', 'launch', 'marketing'], contentHints: 'Product launches, keynotes, marketing decks' },
  { id: 'editorial-infographic', name: 'Editorial Infographic', description: 'Clean + Cool + Editorial + Dense', tags: ['editorial', 'infographic', 'tech', 'research'], contentHints: 'Tech explainers, research presentations, journalism' },
  { id: 'fantasy-animation', name: 'Fantasy Animation', description: 'Organic + Vibrant + Handwritten + Minimal', tags: ['fantasy', 'animation', 'magical', 'storytelling'], contentHints: 'Educational storytelling, fantasy content, animation' },
  { id: 'intuition-machine', name: 'Intuition Machine', description: 'Clean + Cool + Technical + Dense', tags: ['technical', 'academic', 'dense', 'documentation'], contentHints: 'Technical docs, academic papers, bilingual content' },
  { id: 'pixel-art', name: 'Pixel Art', description: 'Pixel + Vibrant + Technical + Balanced', tags: ['pixel', 'gaming', 'retro', 'developer'], contentHints: 'Gaming presentations, developer talks, retro content' },
  { id: 'scientific', name: 'Scientific', description: 'Clean + Cool + Technical + Dense', tags: ['scientific', 'biology', 'chemistry', 'medical'], contentHints: 'Biology, chemistry, medical, scientific presentations' },
  { id: 'vector-illustration', name: 'Vector Illustration', description: 'Clean + Vibrant + Humanist + Balanced', tags: ['vector', 'creative', 'children', 'colorful'], contentHints: 'Creative content, children\'s material, colorful decks' },
  { id: 'vintage', name: 'Vintage', description: 'Paper + Warm + Editorial + Balanced', tags: ['vintage', 'historical', 'paper', 'heritage'], contentHints: 'History, heritage, vintage, expedition content' },
]

const textures = [
  { id: 'clean', name: 'Clean', description: 'Smooth, no texture', tags: ['smooth', 'modern'] },
  { id: 'grid', name: 'Grid', description: 'Blueprint grid pattern', tags: ['grid', 'technical'] },
  { id: 'organic', name: 'Organic', description: 'Natural, hand-drawn feel', tags: ['natural', 'hand'] },
  { id: 'pixel', name: 'Pixel', description: 'Retro pixel texture', tags: ['pixel', 'retro'] },
  { id: 'paper', name: 'Paper', description: 'Aged paper texture', tags: ['paper', 'aged'] },
]

const moodItems = [
  { id: 'professional', name: 'Professional', description: 'Polished, business-appropriate', tags: ['business'] },
  { id: 'warm', name: 'Warm', description: 'Inviting, friendly', tags: ['friendly'] },
  { id: 'cool', name: 'Cool', description: 'Calm, technical, blue-toned', tags: ['tech'] },
  { id: 'vibrant', name: 'Vibrant', description: 'Energetic, colorful', tags: ['energy'] },
  { id: 'dark', name: 'Dark', description: 'Moody, atmospheric', tags: ['moody'] },
  { id: 'neutral', name: 'Neutral', description: 'Balanced, unopinionated', tags: ['balanced'] },
  { id: 'macaron', name: 'Macaron', description: 'Soft pastel warmth', tags: ['soft', 'pastel'] },
]

const typographies = [
  { id: 'geometric', name: 'Geometric', description: 'Clean geometric sans-serif', tags: ['sans', 'modern'] },
  { id: 'humanist', name: 'Humanist', description: 'Warm, readable humanist type', tags: ['warm', 'readable'] },
  { id: 'handwritten', name: 'Handwritten', description: 'Hand-drawn lettering', tags: ['hand', 'casual'] },
  { id: 'editorial', name: 'Editorial', description: 'Bold editorial typography', tags: ['bold', 'magazine'] },
  { id: 'technical', name: 'Technical', description: 'Monospace, precise', tags: ['mono', 'code'] },
]

const densities = [
  { id: 'minimal', name: 'Minimal', description: '1–2 elements per slide', tags: ['sparse'] },
  { id: 'balanced', name: 'Balanced', description: '3–5 elements, standard', tags: ['standard'] },
  { id: 'dense', name: 'Dense', description: '6+ elements, information-rich', tags: ['rich'] },
]

const slideDeck: SkillDefinition = {
  id: 'slide-deck',
  name: 'Slide Deck',
  nameZh: '幻灯片',
  description: 'Professional slide decks with 17 style presets built from a 4D system: Texture × Mood × Typography × Density.',
  longDescription: 'Create complete slide presentations from your content. Choose from 17 pre-configured style presets — each a carefully balanced combination of texture, mood, typography, and density — or customize each dimension individually. Slides auto-merge into .pptx and .pdf after generation.',
  category: 'presentation',
  styleType: 'presets',
  dimensions: {
    style: {
      name: 'style',
      label: 'Style Preset',
      items: stylePresets,
      isRequired: true,
      defaultItem: 'blueprint',
    },
    texture: {
      name: 'texture',
      label: 'Texture',
      items: textures,
      isRequired: false,
      defaultItem: null,
    },
    mood: {
      name: 'mood',
      label: 'Mood',
      items: moodItems,
      isRequired: false,
      defaultItem: null,
    },
    typography: {
      name: 'typography',
      label: 'Typography',
      items: typographies,
      isRequired: false,
      defaultItem: null,
    },
    density: {
      name: 'density',
      label: 'Density',
      items: densities,
      isRequired: false,
      defaultItem: null,
    },
  },
  presets: stylePresets.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    dimensionMap: { style: p.id },
    bestFor: p.contentHints || '',
  })),
  recommendations: [
    { content: 'Tutorial, learn, education, guide, beginner', dimensionMap: { style: 'sketch-notes' } },
    { content: 'Hand-drawn, infographic, diagram, process', dimensionMap: { style: 'hand-drawn-edu' } },
    { content: 'Architecture, system, data, analysis, technical', dimensionMap: { style: 'blueprint' } },
    { content: 'Executive, minimal, clean, simple', dimensionMap: { style: 'minimal' } },
    { content: 'SaaS, product, dashboard, metrics', dimensionMap: { style: 'notion' } },
    { content: 'Investor, quarterly, business, corporate', dimensionMap: { style: 'corporate' } },
    { content: 'Launch, marketing, keynote, magazine', dimensionMap: { style: 'bold-editorial' } },
    { content: 'Entertainment, music, gaming, atmospheric', dimensionMap: { style: 'dark-atmospheric' } },
    { content: 'Biology, chemistry, medical, scientific', dimensionMap: { style: 'scientific' } },
    { content: 'History, heritage, vintage, expedition', dimensionMap: { style: 'vintage' } },
    { content: 'Lifestyle, wellness, travel, artistic', dimensionMap: { style: 'watercolor' } },
  ],
  parameters: [
    { name: 'content', label: 'Content', type: 'textarea', defaultValue: '', placeholder: 'Paste your presentation outline or article...' },
    { name: 'slides', label: 'Target Slide Count', type: 'number', defaultValue: 10 },
    { name: 'audience', label: 'Audience', type: 'select', options: [
      { value: 'general', label: 'General' },
      { value: 'beginners', label: 'Beginners' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'experts', label: 'Experts' },
      { value: 'executives', label: 'Executives' },
    ], defaultValue: 'general' },
    { name: 'language', label: 'Language', type: 'select', options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' }], defaultValue: 'zh' },
  ],
  bestFor: ['Presentations', 'Pitch decks', 'Tutorials', 'Webinar slides', 'Investor updates', 'Conference talks'],
  hasCLI: false,
  outputType: 'pptx',
  defaultAspectRatio: '16:9',
  screenshotDirs: [
    { dimension: 'style', path: 'slide-deck-styles' },
  ],
}

export default slideDeck

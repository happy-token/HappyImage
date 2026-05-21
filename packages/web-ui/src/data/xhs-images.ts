import type { SkillDefinition } from '../types/skills'

const styles = [
  { id: 'cute', name: 'Cute', description: 'Sweet, adorable, girly aesthetic', tags: ['kawaii', 'pink', 'fashion', 'beauty'], contentHints: 'Beauty, fashion, cute products, girl culture, lifestyle sharing' },
  { id: 'fresh', name: 'Fresh', description: 'Clean, crisp, natural', tags: ['nature', 'organic', 'health', 'clean'], contentHints: 'Health tips, nature topics, organic products, fresh lifestyle' },
  { id: 'warm', name: 'Warm', description: 'Cozy, friendly, approachable', tags: ['life', 'story', 'emotion', 'comfort'], contentHints: 'Personal stories, emotional sharing, lifestyle, cozy content' },
  { id: 'bold', name: 'Bold', description: 'High-impact, attention-grabbing', tags: ['warning', 'important', 'critical', 'strong'], contentHints: 'Warnings, important alerts, must-read content, critical info' },
  { id: 'minimal', name: 'Minimal', description: 'Ultra-clean, sophisticated', tags: ['professional', 'business', 'elegant', 'zen'], contentHints: 'Business insights, professional summaries, elegant branding' },
  { id: 'retro', name: 'Retro', description: 'Vintage, nostalgic, trendy throwback', tags: ['classic', 'vintage', 'traditional', 'nostalgia'], contentHints: 'Classic reviews, nostalgia content, traditional culture, retro rankings' },
  { id: 'pop', name: 'Pop', description: 'Vibrant, energetic, eye-catching', tags: ['fun', 'exciting', 'wow', 'amazing'], contentHints: 'Fun facts, exciting reveals, amazing discoveries, pop culture' },
  { id: 'notion', name: 'Notion', description: 'Minimalist hand-drawn line art, intellectual', tags: ['knowledge', 'concept', 'productivity', 'SaaS'], contentHints: 'Knowledge cards, concept explainers, productivity tips, SaaS content' },
  { id: 'chalkboard', name: 'Chalkboard', description: 'Colorful chalk on green/black board, educational', tags: ['education', 'tutorial', 'learning', 'classroom'], contentHints: 'Tutorials, educational content, classroom material, how-to guides' },
  { id: 'study-notes', name: 'Study Notes', description: 'Realistic handwritten photo style, blue pen + red annotations + yellow highlighter', tags: ['notes', 'handwritten', 'study-guide', 'realistic'], contentHints: 'Study guides, exam prep, handwritten notes, academic content' },
  { id: 'screen-print', name: 'Screen Print', description: 'Bold poster art, halftone texture, limited colors, symbolic storytelling', tags: ['movie', 'poster', 'opinion', 'editorial', 'cinematic'], contentHints: 'Movie reviews, opinion pieces, editorials, cinematic content' },
  { id: 'sketch-notes', name: 'Sketch Notes', description: 'Hand-drawn educational infographics, macaron pastels on warm cream, wobbly lines', tags: ['hand-drawn', 'infographic', 'workflow', 'diagram'], contentHints: 'Hand-drawn tutorials, workflow diagrams, illustrated guides' },
]

const layouts = [
  { id: 'sparse', name: 'Sparse', description: '1–2 points, maximum impact', tags: ['cover', 'quote', 'hero'], contentHints: 'Covers, quotes, hero images, key takeaways' },
  { id: 'balanced', name: 'Balanced', description: '3–4 points, standard density', tags: ['standard', 'general', 'story'], contentHints: 'Regular content, stories, general sharing' },
  { id: 'dense', name: 'Dense', description: '5–8 points, knowledge card style', tags: ['knowledge', 'cheat-sheet', 'detailed'], contentHints: 'Knowledge cards, cheat sheets, detailed guides' },
  { id: 'list', name: 'List', description: '4–7 items, checklist or ranking', tags: ['checklist', 'ranking', 'top-list'], contentHints: 'Checklists, rankings, top-N lists, recommendations' },
  { id: 'comparison', name: 'Comparison', description: 'Side-by-side contrast', tags: ['versus', 'before-after', 'pros-cons'], contentHints: 'Product comparisons, before/after, pros vs cons' },
  { id: 'flow', name: 'Flow', description: '3–6 steps, process or timeline', tags: ['process', 'timeline', 'steps'], contentHints: 'Process guides, timelines, step-by-step tutorials' },
  { id: 'mindmap', name: 'Mind Map', description: 'Central hub radiating 4–8 branches', tags: ['concept', 'brainstorm', 'overview'], contentHints: 'Concept maps, knowledge structures, brainstorming' },
  { id: 'quadrant', name: 'Quadrant', description: 'Four-quadrant or circular partition', tags: ['swot', 'matrix', 'framework'], contentHints: 'SWOT analysis, 2×2 matrices, framework diagrams' },
]

const palettes = [
  { id: 'macaron', name: 'Macaron', description: 'Soft pastel blocks on warm cream', tags: ['soft', 'educational', 'gentle'] },
  { id: 'warm', name: 'Warm', description: 'Warm earth tones on soft peach', tags: ['earthy', 'cozy', 'natural'] },
  { id: 'neon', name: 'Neon', description: 'Vibrant neon on dark purple', tags: ['gaming', 'retro', 'futuristic', 'bold'] },
]

const presets = [
  { id: 'knowledge-card', name: 'Knowledge Card', description: 'Dense knowledge cards, concept explainers', dimensionMap: { style: 'notion', layout: 'dense' }, bestFor: 'Educational content, concept explainers, dry-goods sharing' },
  { id: 'checklist', name: 'Checklist', description: 'Ranked lists, checklists', dimensionMap: { style: 'notion', layout: 'list' }, bestFor: 'Checklists, rankings, recommendations' },
  { id: 'tutorial', name: 'Tutorial', description: 'Step-by-step tutorial flow', dimensionMap: { style: 'chalkboard', layout: 'flow' }, bestFor: 'Tutorials, how-to guides, process walkthroughs' },
  { id: 'cute-share', name: 'Cute Share', description: 'Sweet girly sharing, daily种草', dimensionMap: { style: 'cute', layout: 'balanced' }, bestFor: 'Lifestyle sharing, product种草, daily posts' },
  { id: 'cozy-story', name: 'Cozy Story', description: 'Warm life stories, emotional sharing', dimensionMap: { style: 'warm', layout: 'balanced' }, bestFor: 'Personal stories, emotional sharing, lifestyle' },
  { id: 'product-review', name: 'Product Review', description: 'Fresh product comparison, review', dimensionMap: { style: 'fresh', layout: 'comparison' }, bestFor: 'Product comparisons, reviews,测评' },
  { id: 'warning', name: 'Warning List', description: 'Bold避坑 guide, important提醒', dimensionMap: { style: 'bold', layout: 'list' }, bestFor: '避坑 guides, important warnings, critical info' },
  { id: 'clean-quote', name: 'Clean Quote', description: 'Minimal quote, elegant cover', dimensionMap: { style: 'minimal', layout: 'sparse' }, bestFor: 'Quotes, elegant covers, minimal sharing' },
  { id: 'retro-ranking', name: 'Retro Ranking', description: 'Retro ranked list, classic盘点', dimensionMap: { style: 'retro', layout: 'list' }, bestFor: 'Retro rankings, classic盘点, nostalgia lists' },
  { id: 'pop-facts', name: 'Pop Facts', description: 'Pop fun facts list', dimensionMap: { style: 'pop', layout: 'list' }, bestFor: 'Fun facts, interesting trivia,冷知识' },
  { id: 'poster', name: 'Poster Cover', description: 'Screen-print poster cover, film/book review', dimensionMap: { style: 'screen-print', layout: 'sparse' }, bestFor: 'Poster covers, film reviews, book reviews' },
  { id: 'editorial', name: 'Editorial', description: 'Screen-print editorial, cultural commentary', dimensionMap: { style: 'screen-print', layout: 'balanced' }, bestFor: 'Opinion pieces, cultural commentary, editorials' },
]

const xhsImages: SkillDefinition = {
  id: 'xhs-images',
  name: 'XHS Images',
  nameZh: '小红书图片',
  description: 'Xiaohongshu (RedNote) image card series with 12 visual styles and 8 layouts. Optimized for Chinese social media engagement.',
  longDescription: 'Create beautiful multi-card image series optimized for Xiaohongshu (小红书), WeChat (微信贴图), and other Chinese social platforms. Choose from 12 visual styles, 8 layout densities, and 3 color palettes — or use curated presets.',
  category: 'image-cards',
  styleType: 'styles_and_layouts',
  dimensions: {
    style: { name: 'style', label: 'Visual Style', items: styles, isRequired: true, defaultItem: 'cute' },
    layout: { name: 'layout', label: 'Layout Density', items: layouts, isRequired: true, defaultItem: 'sparse' },
    palette: { name: 'palette', label: 'Color Palette', items: palettes, isRequired: false, defaultItem: null },
  },
  presets,
  recommendations: [
    { content: 'Educational, knowledge, concept, tutorial', dimensionMap: { style: 'notion', layout: 'dense' } },
    { content: 'Lifestyle, beauty, fashion, cute', dimensionMap: { style: 'cute', layout: 'balanced' } },
    { content: 'Warning, important, critical', dimensionMap: { style: 'bold', layout: 'list' } },
    { content: 'Professional, business, elegant', dimensionMap: { style: 'minimal', layout: 'balanced' } },
    { content: 'Classic, vintage, traditional', dimensionMap: { style: 'retro', layout: 'list' } },
    { content: 'Fun, exciting, pop culture', dimensionMap: { style: 'pop', layout: 'sparse' } },
    { content: 'Health, nature, fresh, organic', dimensionMap: { style: 'fresh', layout: 'flow' } },
  ],
  parameters: [
    { name: 'content', label: 'Content', type: 'textarea', defaultValue: '', placeholder: 'Paste your article, outline, or topic idea...' },
    { name: 'language', label: 'Language', type: 'select', options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }], defaultValue: 'zh' },
    { name: 'aspectRatio', label: 'Aspect Ratio', type: 'select', options: [{ value: '3:4', label: 'Portrait (3:4)' }, { value: '1:1', label: 'Square (1:1)' }], defaultValue: '3:4' },
    { name: 'imageCount', label: 'Image Count', type: 'number', defaultValue: 4 },
  ],
  bestFor: ['小红书种草', 'WeChat图文', 'Social media cards', 'Knowledge sharing', 'Product reviews', 'Personal stories'],
  hasCLI: false,
  outputType: 'images',
  defaultAspectRatio: '3:4',
  screenshotDirs: [
    { dimension: 'style', path: 'xhs-images-styles' },
    { dimension: 'layout', path: 'xhs-images-layouts' },
  ],
}

export default xhsImages

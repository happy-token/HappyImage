const artStyles = [
    { id: 'ligne-claire', name: 'Ligne Claire', description: 'Uniform lines, flat colors, European comic tradition (Tintin, Logicomix)', tags: ['european', 'clean', 'classic', 'flat-color'] },
    { id: 'manga', name: 'Manga', description: 'Large eyes, manga conventions, expressive emotions', tags: ['japanese', 'expressive', '大眼睛', 'emotion'] },
    { id: 'realistic', name: 'Realistic', description: 'Digital painting, realistic proportions, sophisticated', tags: ['digital', 'realistic', 'sophisticated', 'painterly'] },
    { id: 'ink-brush', name: 'Ink Brush', description: 'Chinese brush strokes, ink wash effects', tags: ['chinese', '水墨', 'brush', 'ink'] },
    { id: 'chalk', name: 'Chalk', description: 'Chalkboard aesthetic, hand-drawn warmth', tags: ['chalk', 'hand-drawn', 'warm', 'educational'] },
    { id: 'minimalist', name: 'Minimalist', description: 'Simple, clean lines, minimal detail', tags: ['minimal', 'simple', 'clean', 'stick-figure'] },
];
const tones = [
    { id: 'neutral', name: 'Neutral', description: 'Balanced, rational, educational', tags: ['balanced', 'educational', 'rational'] },
    { id: 'warm', name: 'Warm', description: 'Nostalgic, personal, comforting', tags: ['nostalgic', 'personal', 'comforting'] },
    { id: 'dramatic', name: 'Dramatic', description: 'High contrast, intense, powerful', tags: ['intense', 'contrast', 'powerful'] },
    { id: 'romantic', name: 'Romantic', description: 'Soft, beautiful, decorative elements', tags: ['soft', 'beautiful', 'decorative'] },
    { id: 'energetic', name: 'Energetic', description: 'Bright, dynamic, exciting', tags: ['bright', 'dynamic', 'exciting'] },
    { id: 'vintage', name: 'Vintage', description: 'Historical, aged, period authenticity', tags: ['historical', 'aged', 'period'] },
    { id: 'action', name: 'Action', description: 'Speed lines, impact effects, combat', tags: ['speed', 'impact', 'combat', 'dynamic'] },
];
const layoutItems = [
    { id: 'standard', name: 'Standard', description: '4–6 panels per page, balanced dialogue and action', tags: ['balanced', 'dialogue', 'narrative'] },
    { id: 'cinematic', name: 'Cinematic', description: '2–4 wide panels, dramatic establishing shots', tags: ['wide', 'dramatic', 'establishing'] },
    { id: 'dense', name: 'Dense', description: '6–9 panels, technical explanations, timelines', tags: ['dense', 'technical', 'information'] },
    { id: 'splash', name: 'Splash', description: '1–2 large panels, key moments and revelations', tags: ['large', 'impact', 'revelation'] },
    { id: 'mixed', name: 'Mixed', description: '3–7 variable-size panels, complex narratives', tags: ['variable', 'complex', 'emotional'] },
    { id: 'webtoon', name: 'Webtoon', description: '3–5 vertical panels, mobile-optimized scrolling', tags: ['vertical', 'mobile', 'scroll'] },
    { id: 'four-panel', name: 'Four Panel', description: 'Classic 4-panel strip (起承转合)', tags: ['yonkoma', 'strip', 'structured'] },
];
const comic = {
    id: 'comic',
    name: 'Comic',
    nameZh: '知识漫画',
    description: 'Educational knowledge comics with flexible art style × tone × layout combinations. Create original comic series from any topic.',
    longDescription: 'Turn any topic into an engaging educational comic. Choose from 6 art styles (from European ligne claire to Chinese ink brush), 7 emotional tones, 7 panel layouts, and 5 curated presets like the Ohmsha tutorial style or Wuxia action style.',
    category: 'comic',
    styleType: 'styles_and_layouts',
    dimensions: {
        art: {
            name: 'art',
            label: 'Art Style',
            items: artStyles,
            isRequired: true,
            defaultItem: 'ligne-claire',
        },
        tone: {
            name: 'tone',
            label: 'Tone / Mood',
            items: tones,
            isRequired: true,
            defaultItem: 'neutral',
        },
        layout: {
            name: 'layout',
            label: 'Panel Layout',
            items: layoutItems,
            isRequired: true,
            defaultItem: 'standard',
        },
    },
    presets: [
        { id: 'ohmsha', name: 'Ohmsha Tutorial', description: 'Manga + Neutral. Visual metaphors, NO talking heads, gadget reveals.', dimensionMap: { art: 'manga', tone: 'neutral' }, bestFor: 'Technical tutorials, knowledge explainers, textbook-style comics' },
        { id: 'wuxia', name: 'Wuxia', description: 'Ink Brush + Action. Qi effects, combat visuals, atmospheric elements.', dimensionMap: { art: 'ink-brush', tone: 'action' }, bestFor: 'Action stories, martial arts, dramatic narratives' },
        { id: 'shoujo', name: 'Shoujo', description: 'Manga + Romantic. Decorative elements, eye details, romantic beats.', dimensionMap: { art: 'manga', tone: 'romantic' }, bestFor: 'Romance stories, emotional narratives, character-driven content' },
        { id: 'concept-story', name: 'Concept Story', description: 'Manga + Warm. Visual symbol system, growth arc, dialog + action balance.', dimensionMap: { art: 'manga', tone: 'warm' }, bestFor: 'Concept explainers, growth stories, abstract ideas' },
        { id: 'four-panel', name: 'Four-Panel Strip', description: 'Minimalist + Neutral + Four Panel. 起承转合 structure, B&W + accent color, stick figures.', dimensionMap: { art: 'minimalist', tone: 'neutral', layout: 'four-panel' }, bestFor: 'Quick jokes, daily comics, serialized strips' },
    ],
    recommendations: [
        { content: 'Technical, tutorial, knowledge, educational', dimensionMap: { art: 'manga', tone: 'neutral' } },
        { content: 'Action, martial arts, dramatic, epic', dimensionMap: { art: 'ink-brush', tone: 'action' } },
        { content: 'Romance, emotion, character, relationship', dimensionMap: { art: 'manga', tone: 'romantic' } },
        { content: 'History, period piece, heritage', dimensionMap: { art: 'realistic', tone: 'vintage' } },
        { content: 'Fun, exciting, adventure, energetic', dimensionMap: { art: 'manga', tone: 'energetic' } },
        { content: 'Quick joke, daily, serialized', dimensionMap: { art: 'minimalist', tone: 'neutral', layout: 'four-panel' } },
    ],
    parameters: [
        { name: 'content', label: 'Story / Topic', type: 'textarea', defaultValue: '', placeholder: 'Describe the story, topic, or concept for your comic...' },
        { name: 'language', label: 'Language', type: 'select', options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' }], defaultValue: 'zh' },
        { name: 'aspectRatio', label: 'Aspect Ratio', type: 'select', options: [{ value: '3:4', label: 'Portrait (3:4)' }, { value: '4:3', label: 'Landscape (4:3)' }, { value: '16:9', label: 'Widescreen (16:9)' }], defaultValue: '3:4' },
        { name: 'pageCount', label: 'Page Count', type: 'number', defaultValue: 4 },
    ],
    bestFor: ['Educational comics', 'Knowledge explainers', 'Technical tutorials', 'Story-driven content', 'Concept visualization'],
    hasCLI: false,
    outputType: 'images',
    defaultAspectRatio: '3:4',
    screenshotDirs: [
        { dimension: 'art', path: 'comic-styles' },
        { dimension: 'layout', path: 'comic-layouts' },
    ],
};
export default comic;

const types = [
    { id: 'infographic', name: 'Infographic', description: 'Data visualization, charts, metrics', tags: ['data', 'charts', 'metrics', 'technical'], contentHints: 'Technical articles, data analysis, statistics' },
    { id: 'scene', name: 'Scene', description: 'Atmospheric illustration, mood rendering', tags: ['atmosphere', 'mood', 'narrative', 'emotional'], contentHints: 'Narrative pieces, personal stories, emotional content' },
    { id: 'flowchart', name: 'Flowchart', description: 'Process diagrams, step visualization', tags: ['process', 'steps', 'workflow', 'tutorial'], contentHints: 'Tutorials, workflows, how-to guides' },
    { id: 'comparison', name: 'Comparison', description: 'Side-by-side, before/after contrast', tags: ['versus', 'contrast', 'compare', 'options'], contentHints: 'Product comparisons, before/after, options analysis' },
    { id: 'framework', name: 'Framework', description: 'Concept maps, relationship diagrams', tags: ['concept', 'model', 'methodology', 'structure'], contentHints: 'Methodologies, architectures, mental models' },
    { id: 'timeline', name: 'Timeline', description: 'Chronological progression', tags: ['history', 'timeline', 'progress', 'evolution'], contentHints: 'History, project progress, evolution stories' },
];
const styleItems = [
    { id: 'notion', name: 'Notion', description: 'Minimalist hand-drawn line art, intellectual', tags: ['minimal', 'hand-drawn', 'knowledge', 'SaaS'], contentHints: 'Knowledge sharing, SaaS, productivity' },
    { id: 'elegant', name: 'Elegant', description: 'Refined, sophisticated, polished', tags: ['refined', 'business', 'luxury', 'thought-leadership'], contentHints: 'Business, thought leadership, premium content' },
    { id: 'warm', name: 'Warm', description: 'Friendly, approachable, inviting', tags: ['friendly', 'personal', 'lifestyle', 'growth'], contentHints: 'Personal growth, lifestyle, warm content' },
    { id: 'minimal', name: 'Minimal', description: 'Ultra-clean, zen-like, restrained', tags: ['clean', 'zen', 'philosophy', 'simple'], contentHints: 'Philosophy, minimalism, refined content' },
    { id: 'blueprint', name: 'Blueprint', description: 'Technical schematics, engineering style', tags: ['technical', 'architecture', 'system', 'design'], contentHints: 'Architecture, system design, engineering' },
    { id: 'watercolor', name: 'Watercolor', description: 'Soft artistic with natural warmth', tags: ['soft', 'artistic', 'travel', 'creative'], contentHints: 'Lifestyle, travel, creative content' },
    { id: 'editorial', name: 'Editorial', description: 'Magazine-style infographic, polished', tags: ['magazine', 'journalism', 'explainer', 'polished'], contentHints: 'Tech explainers, journalism, polished articles' },
    { id: 'scientific', name: 'Scientific', description: 'Academic precise diagrams, detailed', tags: ['academic', 'precise', 'biology', 'chemistry'], contentHints: 'Biology, chemistry, technical, academic' },
];
const palettes = [
    { id: 'default', name: 'Style Default', description: 'Use the style\'s native color palette', tags: ['native'] },
    { id: 'macaron', name: 'Macaron', description: 'Soft pastel blocks (blue, mint, lavender, peach) on warm cream', tags: ['soft', 'pastel', 'educational'] },
    { id: 'warm', name: 'Warm', description: 'Warm earth tones on soft peach, no cool colors', tags: ['earthy', 'warm', 'cozy'] },
    { id: 'neon', name: 'Neon', description: 'Vibrant neon on dark purple, high-energy', tags: ['neon', 'vibrant', 'gaming'] },
];
const articleIllustrator = {
    id: 'article-illustrator',
    name: 'Article Illustrator',
    nameZh: '文章插图',
    description: 'Smart article illustration with Type × Style × Palette three-dimension approach. Analyzes article structure and generates context-aware illustrations.',
    longDescription: 'Enrich your articles with AI-generated illustrations that understand context. The skill analyzes your article\'s structure, identifies positions that need visual aids, and generates illustrations matching the content type — from data-driven infographics to atmospheric scene illustrations.',
    category: 'illustration',
    styleType: 'styles_and_layouts',
    dimensions: {
        type: {
            name: 'type',
            label: 'Illustration Type',
            items: types,
            isRequired: true,
            defaultItem: null,
        },
        style: {
            name: 'style',
            label: 'Visual Style',
            items: styleItems,
            isRequired: true,
            defaultItem: 'notion',
        },
        palette: {
            name: 'palette',
            label: 'Color Palette',
            items: palettes,
            isRequired: false,
            defaultItem: 'default',
        },
    },
    presets: [],
    recommendations: [
        { content: 'Technical, data, analysis, statistics', dimensionMap: { type: 'infographic', style: 'notion' } },
        { content: 'Personal story, narrative, emotional', dimensionMap: { type: 'scene', style: 'warm' } },
        { content: 'Tutorial, workflow, how-to, process', dimensionMap: { type: 'flowchart', style: 'notion' } },
        { content: 'Product comparison, before/after, options', dimensionMap: { type: 'comparison', style: 'editorial' } },
        { content: 'Methodology, architecture, mental model', dimensionMap: { type: 'framework', style: 'blueprint' } },
        { content: 'History, timeline, evolution, progress', dimensionMap: { type: 'timeline', style: 'editorial' } },
        { content: 'Business, thought leadership', dimensionMap: { type: 'framework', style: 'elegant' } },
        { content: 'Science, biology, chemistry', dimensionMap: { type: 'infographic', style: 'scientific' } },
    ],
    parameters: [
        { name: 'content', label: 'Article Content', type: 'textarea', defaultValue: '', placeholder: 'Paste your article or section content...' },
        { name: 'language', label: 'Language', type: 'select', options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }], defaultValue: 'zh' },
        { name: 'density', label: 'Illustration Density', type: 'select', options: [
                { value: 'minimal', label: 'Minimal (1–2 per article)' },
                { value: 'balanced', label: 'Balanced (3–5 per article)' },
                { value: 'per-section', label: 'Per Section (recommended)' },
                { value: 'rich', label: 'Rich (6+ per article)' },
            ], defaultValue: 'per-section' },
    ],
    bestFor: ['Blog posts', 'Technical articles', 'Tutorials', 'Product reviews', 'Case studies', 'Research papers'],
    hasCLI: false,
    outputType: 'images',
    defaultAspectRatio: '16:9',
    screenshotDirs: [
        { dimension: 'type', path: 'article-illustrator-types' },
        { dimension: 'style', path: 'article-illustrator-styles' },
    ],
};
export default articleIllustrator;

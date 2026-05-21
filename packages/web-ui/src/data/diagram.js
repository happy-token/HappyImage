const diagramTypes = [
    { id: 'architecture', name: 'Architecture', description: 'System components and their relationships', tags: ['system', 'components', 'topology', 'structure'], contentHints: 'System architecture, infrastructure, microservices' },
    { id: 'flowchart', name: 'Flowchart', description: 'Decision logic, process steps', tags: ['decision', 'process', 'logic', 'branching'], contentHints: 'Decision trees, algorithms, process flows' },
    { id: 'sequence', name: 'Sequence', description: 'Time-ordered interactions between participants', tags: ['protocol', 'handshake', 'auth', 'request-response'], contentHints: 'Protocol flows, auth sequences, API interactions' },
    { id: 'structural', name: 'Structural', description: 'Class diagrams, ER diagrams, org charts', tags: ['class', 'entity', 'organization', 'schema'], contentHints: 'Data models, class hierarchies, org structures' },
    { id: 'mindmap', name: 'Mind Map', description: 'Brainstorming, topic exploration', tags: ['brainstorm', 'explore', 'topics', 'radiant'], contentHints: 'Brainstorming, topic exploration, idea mapping' },
    { id: 'timeline', name: 'Timeline', description: 'Chronological events', tags: ['history', 'events', 'chronology', 'progression'], contentHints: 'Project timelines, history, roadmaps' },
    { id: 'illustrative', name: 'Illustrative', description: 'Conceptual explanation, visual intuition', tags: ['concept', 'intuition', 'explanation', 'visual'], contentHints: 'Concept explainers, how-it-works, mechanism visualization' },
    { id: 'state-machine', name: 'State Machine', description: 'State transitions, lifecycles', tags: ['state', 'transition', 'lifecycle', 'status'], contentHints: 'Lifecycles, state management, status flows' },
    { id: 'dataflow', name: 'Data Flow', description: 'Data transformation pipelines', tags: ['data', 'pipeline', 'transform', 'stream'], contentHints: 'Data pipelines, ETL, stream processing' },
];
const diagram = {
    id: 'diagram',
    name: 'Diagram',
    nameZh: '技术图表',
    description: 'Publication-ready SVG diagrams — flowcharts, sequence diagrams, architecture diagrams, and more. No AI image model needed.',
    longDescription: 'Generate publication-quality SVG diagrams directly from your descriptions. Claude writes real SVG code with embedded styles and auto dark-mode support. Perfect for technical documentation, architecture diagrams, and concept explainers. Outputs self-contained .svg files.',
    category: 'diagram',
    styleType: 'styles_and_layouts',
    dimensions: {
        type: {
            name: 'type',
            label: 'Diagram Type',
            items: diagramTypes,
            isRequired: true,
            defaultItem: null,
        },
    },
    presets: [],
    recommendations: [
        { content: 'Architecture, system, components, infrastructure', dimensionMap: { type: 'architecture' } },
        { content: 'Process, workflow, lifecycle, steps', dimensionMap: { type: 'flowchart' } },
        { content: 'Protocol, auth, handshake, API, request/response', dimensionMap: { type: 'sequence' } },
        { content: 'Class diagram, UML, schema, entity, inheritance', dimensionMap: { type: 'structural' } },
        { content: 'Brainstorm, explore, ideas, topics', dimensionMap: { type: 'mindmap' } },
        { content: 'History, chronology, roadmap, milestones', dimensionMap: { type: 'timeline' } },
        { content: 'How does X work, explain, intuition, mechanism', dimensionMap: { type: 'illustrative' } },
        { content: 'State, transition, lifecycle, status', dimensionMap: { type: 'state-machine' } },
        { content: 'Data pipeline, ETL, stream, transform', dimensionMap: { type: 'dataflow' } },
    ],
    parameters: [
        { name: 'content', label: 'Diagram Description', type: 'textarea', defaultValue: '', placeholder: 'Describe what you want to visualize (e.g., "How JWT authentication works" or "Kubernetes pod scheduling")' },
        { name: 'language', label: 'Language', type: 'select', options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }], defaultValue: 'zh' },
        { name: 'scale', label: 'Export Scale', type: 'select', options: [{ value: '1', label: '1x' }, { value: '2', label: '2x (recommended)' }, { value: '3', label: '3x' }], defaultValue: '2' },
    ],
    bestFor: ['Technical documentation', 'Architecture diagrams', 'API flowcharts', 'System design', 'Concept explainers', 'Data models'],
    hasCLI: false,
    outputType: 'svg',
    defaultAspectRatio: '16:9',
    screenshotDirs: [
        { dimension: 'type', path: 'diagram-types' },
    ],
};
export default diagram;

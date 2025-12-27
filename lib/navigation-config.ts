export const NAV_ITEMS = {
    features: [
        { name: 'Functional Testing', href: '/features#functional' }, // Updated to anchor
        { name: 'Visual Regression', href: '/features#visual' },      // Updated to anchor
        { name: 'Performance', href: '/features#performance' },       // Updated to anchor (or just /features if no section exists yet)
        { name: 'Behavior Analysis', href: '/docs/behavior-analysis', isNew: true },
    ],
    resources: [
        { name: 'Documentation', href: '/docs' },
        { name: 'Blog', href: '#' },
        { name: 'Community', href: '#' },
        { name: 'Contact', href: '/contact' }, // Added in previous step
    ]
} as const;

'use client'

import { useState } from 'react'

const Logos = {
    Chrome: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="32" height="32"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><line x1="21.17" y1="8" x2="12" y2="8" /><line x1="3.95" y1="6.06" x2="8.54" y2="14" /><line x1="10.88" y1="21.94" x2="15.46" y2="14" /></svg>,
    Safari: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="32" height="32"><circle cx="12" cy="12" r="10" /><path d="m15.5 8.5-6 6" /><path d="m9.5 15.5 6-6" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M2 12h2" /><path d="M20 12h2" /></svg>,
    Firefox: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="32" height="32"><path d="M15.6 11.6a5.5 5.5 0 1 1-6-4.5" /><path d="M12 2a10 10 0 1 0 10 10" /></svg>
}

const BROWSERS = [
    { id: 'chrome', name: 'Chrome 129', color: '#64748b', icon: Logos.Chrome, bg: '#fff' },
    { id: 'firefox', name: 'Firefox 130', color: '#ea580c', icon: Logos.Firefox, bg: '#fff7ed' },
    { id: 'safari', name: 'Safari 18', color: '#0ea5e9', icon: Logos.Safari, bg: '#f0f9ff' }
]

export function InteractiveBrowserStack() {
    // The browser at index 0 is at the FRONT
    const [stack, setStack] = useState(BROWSERS)

    const moveToFront = (index: number) => {
        if (index === 0) return // Already at front

        // Take the clicked item and move it to the start, preserving relative order of others
        const newStack = [
            stack[index],
            ...stack.slice(0, index),
            ...stack.slice(index + 1)
        ]
        setStack(newStack)
    }

    return (
        <div style={{ position: 'relative', height: '320px', perspective: '1000px', transformStyle: 'preserve-3d' }}>
            {stack.map((browser, index) => {
                // Calculate visual state based on stack position
                // Use translateZ for depth instead of just scale/zIndex for standard CSS stacking
                const isFront = index === 0
                const yOffset = index * 40
                const zOffset = -index * 50 // Move back in 3D space
                const scale = 1 - (index * 0.05)
                const opacity = 1 - (index * 0.1)

                // We keep zIndex for fallback/helper but rely on transform for animation
                const zIndex = 30 - (index * 10)

                return (
                    <div
                        key={browser.id}
                        onClick={() => moveToFront(index)}
                        style={{
                            position: 'absolute',
                            top: 0, // Reset top, use translate3d for all movement
                            left: '50%',
                            transform: `translate3d(-50%, ${yOffset}px, ${zOffset}px) scale(${scale})`,
                            width: '80%',
                            height: '240px',
                            background: browser.bg,
                            borderRadius: '12px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
                            border: '1px solid rgba(0,0,0,0.1)',
                            zIndex: zIndex,
                            transition: 'transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.6s',
                            cursor: isFront ? 'default' : 'pointer',
                            opacity: opacity,
                            // Add a hover lift for non-active cards
                        }}
                        className="browser-card"
                    >
                        {/* Browser Toolbar */}
                        <div style={{
                            height: '40px',
                            background: 'rgba(255,255,255,0.5)',
                            borderBottom: '1px solid rgba(0,0,0,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 1rem',
                            gap: '0.75rem',
                            backdropFilter: 'blur(10px)'
                        }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <div style={{ width: '10px', height: '10px', background: '#ff5f56', borderRadius: '50%' }} />
                                <div style={{ width: '10px', height: '10px', background: '#ffbd2e', borderRadius: '50%' }} />
                                <div style={{ width: '10px', height: '10px', background: '#27c93f', borderRadius: '50%' }} />
                            </div>
                            <div style={{
                                flex: 1,
                                height: '28px',
                                background: 'rgba(0,0,0,0.05)',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 0.5rem',
                                color: browser.color,
                                fontSize: '0.85rem',
                                fontWeight: 500
                            }}>
                                {browser.icon}
                                <span style={{ marginLeft: '0.5rem' }}>{browser.name}</span>
                            </div>
                        </div>

                        {/* Browser Content Hint */}
                        <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100% - 40px)', color: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ textAlign: 'center' }}>
                                {browser.icon}
                                <div style={{ marginTop: '1rem', fontWeight: 600 }}>{isFront ? 'Active Session' : 'Click to Focus'}</div>
                            </div>
                        </div>

                        {/* Hover Overlay for background cards */}
                        {!isFront && (
                            <div
                                className="hover-panel"
                                style={{
                                    position: 'absolute',
                                    bottom: '-40px',
                                    left: '0',
                                    width: '100%',
                                    textAlign: 'center',
                                    padding: '0.5rem',
                                    background: 'rgba(0,0,0,0.8)',
                                    color: 'white',
                                    borderRadius: '0 0 12px 12px',
                                    fontSize: '0.8rem',
                                    opacity: 0,
                                    transition: 'opacity 0.3s'
                                }}
                            >
                                Switch to {browser.name}
                            </div>
                        )}
                        <style jsx>{`
                            .browser-card:hover {
                                transform: translateX(-50%) scale(${scale + 0.02}) !important;
                                box-shadow: 0 30px 60px rgba(0,0,0,0.2);
                            }
                            .browser-card:hover .hover-panel {
                                opacity: 1 !important;
                                bottom: 0 !important;
                            }
                        `}</style>
                    </div>
                )
            })}
        </div>
    )
}

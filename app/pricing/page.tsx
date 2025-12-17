'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { LandingHeader } from '@/components/LandingHeader'

// Design System Constants
const COLORS = {
    primary: '#b91c1c', // maroon-700
    success: '#10b981', // emerald-500
    bg: '#0f172a',      // slate-900
    bgCard: 'rgba(30, 41, 59, 0.7)', // slate-800 + opacity
    text: '#f8fafc',    // slate-50
    textMuted: '#94a3b8' // slate-400
}

const PRICING = {
    monthly: {
        starter: '0',
        pro: '49',
        enterprise: 'Custom'
    },
    yearly: {
        starter: '0',
        pro: '39',
        enterprise: 'Custom'
    }
}

export default function PricingPage() {
    const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')

    return (
        <main style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text, fontFamily: 'var(--font-inter)' }}>
            <LandingHeader />

            {/* Header */}
            <section style={{ paddingTop: '160px', paddingBottom: '80px', textAlign: 'center' }}>
                <div className="container">
                    <div style={{ color: COLORS.primary, fontWeight: 'bold', letterSpacing: '2px', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '1rem' }}>
                        Flexible Pricing
                    </div>
                    <h1 style={{ fontSize: '3.5rem', fontWeight: '800', marginBottom: '1.5rem', lineHeight: 1.1 }}>
                        Ship with <span className="text-gradient">Confidence</span>
                    </h1>
                    <p style={{ maxWidth: '600px', margin: '0 auto', fontSize: '1.2rem', color: COLORS.textMuted, lineHeight: 1.6 }}>
                        Transparent pricing for teams of all sizes. No hidden fees for parallelization or artifacts.
                    </p>

                    {/* Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '3rem' }}>
                        <span style={{ color: billing === 'monthly' ? '#fff' : COLORS.textMuted, fontWeight: 500 }}>Monthly</span>
                        <button
                            onClick={() => setBilling(billing === 'monthly' ? 'yearly' : 'monthly')}
                            style={{
                                width: '60px', height: '32px', background: '#334155', borderRadius: '20px',
                                position: 'relative', border: 'none', cursor: 'pointer', transition: 'background 0.3s'
                            }}
                        >
                            <div style={{
                                position: 'absolute', top: '4px', left: billing === 'monthly' ? '4px' : '32px',
                                width: '24px', height: '24px', background: COLORS.primary, borderRadius: '50%',
                                transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
                            }} />
                        </button>
                        <span style={{ color: billing === 'yearly' ? '#fff' : COLORS.textMuted, fontWeight: 500 }}>
                            Yearly <span style={{ fontSize: '0.75rem', color: COLORS.success, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', marginLeft: '0.5rem' }}>Save 20%</span>
                        </span>
                    </div>
                </div>
            </section>

            {/* Pricing Cards */}
            <section style={{ paddingBottom: '6rem' }}>
                <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>

                    {/* STARTER */}
                    <div className="glass-card" style={{ padding: '2.5rem', background: COLORS.bgCard, border: '1px solid #334155', borderRadius: '16px' }}>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Starter</h3>
                        <div style={{ fontSize: '0.9rem', color: COLORS.textMuted, marginBottom: '2rem' }}>For solo developers and side projects.</div>
                        <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>
                            ${PRICING[billing].starter}<span style={{ fontSize: '1rem', color: COLORS.textMuted, fontWeight: 'normal' }}>/mo</span>
                        </div>
                        <Link href="/signup" style={{ display: 'block', width: '100%', padding: '1rem', textAlign: 'center', background: '#334155', color: '#fff', borderRadius: '8px', fontWeight: 600, transition: '0.2s' }}>
                            Start for Free
                        </Link>
                        <ul style={{ marginTop: '2.5rem', listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <PricingFeature text="500 Test Runs / mo" />
                            <PricingFeature text="1 Concurrent Job" />
                            <PricingFeature text="Data Retention: 7 Days" />
                            <PricingFeature text="Community Support" />
                        </ul>
                    </div>

                    {/* PRO */}
                    <div className="glass-card" style={{
                        padding: '2.5rem', background: 'linear-gradient(145deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.9) 100%)',
                        border: `1px solid ${COLORS.primary}`, borderRadius: '16px', position: 'relative',
                        transform: 'scale(1.05)', boxShadow: '0 25px 50px -12px rgba(185, 28, 28, 0.25)'
                    }}>
                        <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: COLORS.primary, color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', padding: '4px 12px', borderRadius: '20px', letterSpacing: '1px' }}>
                            MOST POPULAR
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Pro</h3>
                        <div style={{ fontSize: '0.9rem', color: COLORS.textMuted, marginBottom: '2rem' }}>For growing teams shipping daily.</div>
                        <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>
                            ${PRICING[billing].pro}<span style={{ fontSize: '1rem', color: COLORS.textMuted, fontWeight: 'normal' }}>/mo</span>
                        </div>
                        <Link href="/signup" style={{ display: 'block', width: '100%', padding: '1rem', textAlign: 'center', background: COLORS.primary, color: '#fff', borderRadius: '8px', fontWeight: 600, boxShadow: '0 4px 14px 0 rgba(185, 28, 28, 0.39)' }}>
                            Get Started
                        </Link>
                        <ul style={{ marginTop: '2.5rem', listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <PricingFeature text="10,000 Test Runs / mo" checked />
                            <PricingFeature text="10 Concurrent Jobs" checked />
                            <PricingFeature text="Data Retention: 90 Days" checked />
                            <PricingFeature text="Priority Email Support" checked />
                            <PricingFeature text="God Mode (Live Debug)" checked />
                        </ul>
                    </div>

                    {/* ENTERPRISE */}
                    <div className="glass-card" style={{ padding: '2.5rem', background: COLORS.bgCard, border: '1px solid #334155', borderRadius: '16px' }}>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Enterprise</h3>
                        <div style={{ fontSize: '0.9rem', color: COLORS.textMuted, marginBottom: '2rem' }}>Custom solutions for large organizations.</div>
                        <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>
                            Custom
                        </div>
                        <Link href="/contact" style={{ display: 'block', width: '100%', padding: '1rem', textAlign: 'center', background: 'transparent', border: '1px solid #475569', color: '#fff', borderRadius: '8px', fontWeight: 600, transition: '0.2s' }}>
                            Contact Sales
                        </Link>
                        <ul style={{ marginTop: '2.5rem', listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <PricingFeature text="Unlimited Test Runs" />
                            <PricingFeature text="Dedicated Infine Infrastructure" />
                            <PricingFeature text="SSO & SAML" />
                            <PricingFeature text="SLA & Dedicated Success Manager" />
                            <PricingFeature text="VPC Peering" />
                        </ul>
                    </div>

                </div>
            </section>

            {/* Comparison Table */}
            <section style={{ padding: '4rem 0 8rem', background: '#0b1120' }}>
                <div className="container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '4rem' }}>Detailed Comparison</h2>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: COLORS.textMuted, fontSize: '0.95rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #334155' }}>
                                    <th style={{ textAlign: 'left', padding: '1.5rem 1rem', color: '#fff', width: '40%' }}>Feature</th>
                                    <th style={{ textAlign: 'center', padding: '1.5rem 1rem', width: '20%' }}>Starter</th>
                                    <th style={{ textAlign: 'center', padding: '1.5rem 1rem', width: '20%', color: COLORS.primary }}>Pro</th>
                                    <th style={{ textAlign: 'center', padding: '1.5rem 1rem', width: '20%' }}>Enterprise</th>
                                </tr>
                            </thead>
                            <tbody>
                                <GroupRow label="Execution" />
                                <FeatureRow label="Parallel Jobs" starter="1" pro="10" ent="Unlimited" />
                                <FeatureRow label="Browser Coverage" starter="Latest Only" pro="All Versions" ent="All Versions" />
                                <FeatureRow label="Mobile Emulation" starter="Basic" pro="High-Fidelity" ent="Real Device Farm" />

                                <GroupRow label="Intelligence" />
                                <FeatureRow label="Self-Healing Selectors" starter="✓" pro="✓" ent="✓" />
                                <FeatureRow label="Visual Regression" starter="-" pro="✓" ent="✓" />
                                <FeatureRow label="God Mode (Live)" starter="-" pro="✓" ent="✓" />

                                <GroupRow label="Security & Support" />
                                <FeatureRow label="Single Sign-On (SSO)" starter="-" pro="-" ent="✓" />
                                <FeatureRow label="Data Residency" starter="US East" pro="US / EU" ent="Custom" />
                                <FeatureRow label="Support Channel" starter="Community" pro="Email (24h)" ent="Slack (1h)" />
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

        </main>
    )
}

// Helpers
function PricingFeature({ text, checked = false }: { text: string, checked?: boolean }) {
    return (
        <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: checked ? '#f8fafc' : '#94a3b8' }}>
            <span style={{ color: COLORS.success, fontSize: '1.1rem' }}>✓</span>
            {text}
        </li>
    )
}

function GroupRow({ label }: { label: string }) {
    return (
        <tr>
            <td colSpan={4} style={{ padding: '2rem 1rem 1rem', color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
                {label}
            </td>
        </tr>
    )
}

function FeatureRow({ label, starter, pro, ent }: { label: string, starter: string, pro: string, ent: string }) {
    return (
        <tr style={{ borderBottom: '1px solid #1e293b' }}>
            <td style={{ padding: '1rem', color: '#e2e8f0' }}>{label}</td>
            <td style={{ padding: '1rem', textAlign: 'center' }}>{starter}</td>
            <td style={{ padding: '1rem', textAlign: 'center', color: pro === '✓' ? COLORS.success : pro === '-' ? '#475569' : '#fff', fontWeight: 500 }}>{pro}</td>
            <td style={{ padding: '1rem', textAlign: 'center', color: ent === '✓' ? COLORS.success : '#fff', fontWeight: 500 }}>{ent}</td>
        </tr>
    )
}

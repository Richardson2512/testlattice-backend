'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GuestTestModal } from './GuestTestModal'

export function GuestTestModalWrapper() {
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-primary btn-large"
                >
                    Test Now →
                </button>
                <Link href="#demo" className="btn btn-secondary btn-large">
                    Watch Demo
                </Link>
            </div>

            <GuestTestModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    )
}

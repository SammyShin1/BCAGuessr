'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function Home() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111', color: 'white' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '16px' }}>BCAGuessr</h1>
            <p style={{ color: '#9ca3af', marginBottom: '32px' }}>geoguessr but bca</p>
            <Link href="/game" style={{ textDecoration: 'none' }}>
                <button style={{ padding: '12px 32px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '999px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    Play
                </button>
            </Link>
        </div>
    )
}
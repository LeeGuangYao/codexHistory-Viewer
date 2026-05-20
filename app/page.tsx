'use client'
import { useEffect, useState } from 'react'
export default function Page(){const [data,setData]=useState<any>(null);useEffect(()=>{fetch('/api/threads').then(r=>r.json()).then(setData)},[]);return <main style={{padding:20}}><h1>Codex Chat History</h1><pre>{JSON.stringify(data,null,2)}</pre></main>}

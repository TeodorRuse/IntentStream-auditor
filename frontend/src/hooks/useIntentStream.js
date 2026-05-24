import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { Intents } from '../lib/api'

const PAGE_SIZE = 50

export function useIntentStream() {
  const { addIntents, setStreaming, setIps } = useStore()
  const esRef     = useRef(null)
  const bucketRef = useRef([])
  const lastIdRef = useRef(null)

  useEffect(() => {
    const ipsTimer = setInterval(() => {
      setIps(bucketRef.current.length)
      bucketRef.current = []
    }, 1000)

    function connect() {
      const startId = lastIdRef.current ?? 0
      const es = new EventSource(Intents.streamUrl(startId))
      esRef.current = es

      es.onopen = () => setStreaming(true)
      es.onmessage = (e) => {
        try {
          const intent = JSON.parse(e.data)
          addIntents([intent])
          bucketRef.current.push(intent)
          lastIdRef.current = Math.max(lastIdRef.current ?? 0, intent.id)
        } catch { /* skip malformed */ }
      }
      es.onerror = () => {
        setStreaming(false)
        es.close()
        setTimeout(connect, 3000)
      }
    }

    async function init() {
      try {
        const data = await Intents.list(0, PAGE_SIZE)
        const items = (data.items || []).slice().reverse() // newest-first → oldest-first
        if (items.length) {
          addIntents(items)
          lastIdRef.current = items[items.length - 1].id
        } else {
          lastIdRef.current = 0
        }
      } catch (e) {
        console.warn('Failed to fetch initial intents:', e)
        lastIdRef.current = 0
      }
      connect()
    }

    init()

    return () => {
      clearInterval(ipsTimer)
      esRef.current?.close()
      setStreaming(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

import { useEffect, useRef, useState } from 'react'

// Web Speech API — vendor-prefixed on Chrome/Safari, absent on some browsers.
type SpeechRecognitionCtor = new () => any

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

/** Voice-as-text-input: dictation appends to whatever text field the caller owns.
 *  Unsupported browsers get { supported: false } — callers hide the mic and keep typing. */
export function useSpeechInput(onTranscript: (text: string) => void) {
  const supported = getRecognitionCtor() !== null
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const callbackRef = useRef(onTranscript)
  callbackRef.current = onTranscript

  useEffect(() => {
    return () => recognitionRef.current?.abort()
  }, [])

  const start = () => {
    const Ctor = getRecognitionCtor()
    if (!Ctor || listening) return
    const rec = new Ctor()
    rec.lang = 'en-IN'
    rec.interimResults = false
    rec.continuous = true
    rec.onresult = (event: any) => {
      const finals: string[] = []
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finals.push(event.results[i][0].transcript)
      }
      if (finals.length) callbackRef.current(finals.join(' ').trim())
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  const stop = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  return { supported, listening, start, stop }
}

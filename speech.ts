// Browser speech features (no server): read-aloud via speechSynthesis, voice input via SpeechRecognition.
export function speak(text: string, lang = 'en') {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.98;
  window.speechSynthesis.speak(u);
  return true;
}
export function stopSpeaking() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }

type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void; onerror: (e: { error: string }) => void; onend: () => void };
export function recognitionSupported() {
  return !!((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
}
export function listen(lang: string, onText: (t: string, final: boolean) => void, onEnd: (err?: string) => void) {
  const C = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
  if (!C) { onEnd('Voice input isn’t supported in this browser. Try Chrome or Edge, or type instead.'); return () => {}; }
  const r = new C();
  r.lang = lang;
  r.interimResults = true;
  r.continuous = false;
  r.onresult = (e) => {
    let txt = '';
    let final = false;
    for (let i = 0; i < e.results.length; i++) { txt += e.results[i][0].transcript; final = e.results[i].isFinal; }
    onText(txt, final);
  };
  r.onerror = (e) => onEnd(e.error === 'not-allowed' ? 'Microphone permission was denied. Allow it in your browser settings.' : `Voice input stopped (${e.error}).`);
  r.onend = () => onEnd();
  r.start();
  return () => r.stop();
}

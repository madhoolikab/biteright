import { Camera, Pencil } from 'lucide-react'

export default function LogDuoCard({ onSnap, onManual }: { onSnap: () => void; onManual: () => void }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3">
      <button
        onClick={onSnap}
        className="relative overflow-hidden rounded-3xl p-5 text-left text-primary-foreground gradient-berry shadow-[0_14px_30px_-18px_rgba(124,92,255,0.7)] active:scale-[0.98] transition-transform"
      >
        <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
        <div className="relative h-11 w-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
          <Camera className="h-5 w-5" />
        </div>
        <p className="relative mt-3 font-display text-lg leading-tight">Snap a plate</p>
        <p className="relative text-[11px] opacity-85">Photo → auto macros</p>
      </button>
      <button
        onClick={onManual}
        className="relative overflow-hidden rounded-3xl p-5 text-left bg-card border border-border shadow-[0_8px_24px_-18px_rgba(26,20,48,0.25)] active:scale-[0.98] transition-transform"
      >
        <div className="pointer-events-none absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-accent-soft blur-2xl" />
        <div className="relative h-11 w-11 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
          <Pencil className="h-5 w-5" />
        </div>
        <p className="relative mt-3 font-display text-lg leading-tight text-foreground">Add manually</p>
        <p className="relative text-[11px] text-muted-foreground">Search or favourites</p>
      </button>
    </div>
  )
}

/** Ilustração decorativa de uma vila de Natal, usada quando não há foto de fundo configurada. */
export function VillageSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 160" preserveAspectRatio="none" className={className} aria-hidden="true">
      <g fill="rgb(255 255 255 / 0.12)">
        <circle cx="330" cy="30" r="2" />
        <circle cx="60" cy="20" r="1.5" />
        <circle cx="180" cy="15" r="1.5" />
        <circle cx="250" cy="45" r="1.5" />
        <circle cx="30" cy="55" r="1.5" />
      </g>
      <path
        d="M0,160 L0,120 L30,120 L30,100 L55,100 L55,120 L90,120 L90,80 L120,60 L150,80 L150,120 L190,120 L190,95 L215,95 L215,120 L250,120 L250,70 L280,50 L310,70 L310,120 L340,120 L340,105 L365,105 L365,120 L400,120 L400,160 Z"
        fill="rgb(255 255 255 / 0.14)"
      />
      <path d="M120,40 L128,60 L112,60 Z" fill="rgb(255 255 255 / 0.22)" />
      <path d="M120,50 L131,68 L109,68 Z" fill="rgb(255 255 255 / 0.22)" />
      <path d="M280,28 L288,50 L272,50 Z" fill="rgb(255 255 255 / 0.2)" />
      <path d="M280,40 L291,60 L269,60 Z" fill="rgb(255 255 255 / 0.2)" />
    </svg>
  )
}

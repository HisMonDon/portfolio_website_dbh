import './AvatarSlot.css'

// Placeholder gap for the prerecorded avatar — swap this out for the
// real video/model element.
export default function AvatarSlot() {
  return (
    <div className="avatar-slot" aria-hidden="true">
      <span className="avatar-slot-label">avatar goes here</span>
    </div>
  )
}

import { useCallback, useMemo } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import hoverSoundUrl from '../assets/hover_audio.mp3'
import selectSoundUrl from '../assets/select_audio.mp3'

const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"]'
const SOUND_TOGGLE_SELECTOR = '[data-interface-sound-toggle="true"]'

function getInteractiveTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return null

    const interactiveTarget = target.closest(INTERACTIVE_SELECTOR)

    if (
        interactiveTarget instanceof HTMLButtonElement
        || interactiveTarget instanceof HTMLInputElement
        || interactiveTarget instanceof HTMLSelectElement
        || interactiveTarget instanceof HTMLTextAreaElement
    ) {
        return interactiveTarget.disabled ? null : interactiveTarget
    }

    if (interactiveTarget?.getAttribute('aria-disabled') === 'true') return null

    return interactiveTarget
}

function playSound(audio: HTMLAudioElement) {
    audio.currentTime = 0
    audio.play().catch(() => {
        //hover audio can be blocked until the visitors first user gesture.
    })
}

export function useInterfaceSounds(isMuted = false) {
    const sounds = useMemo(() => {
        const hover = new Audio(hoverSoundUrl)
        const select = new Audio(selectSoundUrl)

        hover.volume = 0.35
        select.volume = 0.45

        return { hover, select }
    }, [])

    const handleInterfaceHover = useCallback((event: PointerEvent<HTMLElement>) => {
        if (isMuted) return

        const interactiveTarget = getInteractiveTarget(event.target)

        if (!interactiveTarget) return

        const relatedTarget = event.relatedTarget

        if (relatedTarget instanceof Node && interactiveTarget.contains(relatedTarget)) return

        playSound(sounds.hover)
    }, [isMuted, sounds.hover])

    const handleInterfaceSelect = useCallback((event: MouseEvent<HTMLElement>) => {
        if (isMuted) return

        const interactiveTarget = getInteractiveTarget(event.target)

        if (!interactiveTarget || interactiveTarget.closest(SOUND_TOGGLE_SELECTOR)) return

        playSound(sounds.select)
    }, [isMuted, sounds.select])

    return { handleInterfaceHover, handleInterfaceSelect }
}

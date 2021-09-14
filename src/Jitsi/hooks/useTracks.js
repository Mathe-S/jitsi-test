import { useCallback, useMemo, useState } from "react"
import throttle from "lodash.throttle"

const useTracks = () => {
    const [tracks, setTracks] = useState([])
    const [activeSpeakers, setActiveSpeakers] = useState({})
    const [lastSpeaker, setLastSpeaker] = useState('')

    const audioLevelChanged = useCallback((id, level) => {
        if (level >= 0.012) {
            id && setActiveSpeakers(prev => ({
                ...prev,
                [id]: level
            }))

            if (id !== lastSpeaker) {
                setLastSpeaker(id);
            }
        } else {
            setActiveSpeakers(prev => Object.fromEntries(Object.entries(prev).filter(([key, value]) => key !== id)))
        }
    }, [setActiveSpeakers])

    const addTrack = useCallback((track) => {
        track.addEventListener("track.trackMuteChanged", (e) => updateTrack(e))
        track.addEventListener("track.audioLevelsChanged", throttle((level) => { audioLevelChanged(track.getParticipantId(), level) }, 400))
        setTracks((tracks) => {
            const hasTrack = tracks.find(_track => track.getId() === _track.getId())

            if (hasTrack) {
                return updateTrack(track)
            }

            return [...tracks, track]
        })
    }, [setTracks, tracks])

    const updateTrack = useCallback((track) => {
        setTracks((tracks) => {
            let oldTrack = tracks.find(_track => track.getId() === _track.getId())

            if (oldTrack) {
                Object.assign(oldTrack, track)
            }
            return [...tracks]
        })
    }, [setTracks, tracks])

    const removeTrack = useCallback((track) => {
        setTracks((tracks) => tracks.filter(_track => track.getId() !== _track.getId()))
    }, [setTracks])

    const getTracks = useCallback((type, local) => {
        return tracks.filter((_track) => {
            let filterValue = true
            if (typeof local !== "undefined") {
                filterValue = _track.isLocal() === local
            }
            if (typeof type !== "undefined") {
                filterValue = filterValue &&
                    (_track.getType() === type || (_track.getType() === "video" && _track.videoType === type))
            }
            return filterValue
        })
    }, [tracks])

    const videoTracks = useMemo(() => getTracks("video"), [tracks])
    const audioTracks = useMemo(() => getTracks("audio"), [tracks])

    return {
        tracks,
        addTrack,
        updateTrack,
        removeTrack,
        getTracks,
        audioTracks,
        videoTracks,
        setTracks,
        activeSpeakers,
        lastSpeaker
    }
}

export default useTracks

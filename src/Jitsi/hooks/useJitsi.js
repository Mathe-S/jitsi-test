/* global JitsiMeetJS config*/
import { useCallback, useEffect, useMemo, useState } from "react"
import Jitsi from "../Jitsi"
import useTracks from "./useTracks"
import { allSettled } from "../utils"

const useJitsi = (currentUser, isPublicRoom) => {
    const defaultParams = useMemo(Jitsi.getDefaultParams, [])
    const [mainState, setMainState] = useState("initial")
    const [domain] = useState(defaultParams.domain)
    const [room, setRoom] = useState("mathe-test")
    const [connection, setConnection] = useState(null)
    const [conference, setConference] = useState(null)
    const { tracks, addTrack, removeTrack, videoTracks, audioTracks, getTracks, setTracks, activeSpeakers, lastSpeaker } = useTracks()
    const { tracks: desktopTracks, addTrack: addDesktopTrack, removeTrack: removeDesktopTrack } = useTracks()
    const [participants, setParticipants] = useState([])
    const [isDesktopSharingAvailable, setIsDesktopSharingAvailable] = useState(false)
    const [upcomingBooking, setUpcomingBooking] = useState(null)
    const [publicRoomId, setPublicRoomId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isDesktopSharingEnabled, setIsDesktopSharingEnabled] = useState(false)
    const [localParticipantId, setLocalParticipantId] = useState('')
    const [mutedParticipants, setMutedParticipants] = useState([])
    const [userLocationState, setUserLocationState] = useState('')
    const [dominnatSpeaker, setDominantSpeaker] = useState('')
    const [noAudioInput, setNoAudioInput] = useState({
        muted: false,
        noPermission: false,
        noAudioINput: false,
    })

    const isCameraMuted = useMemo(() => !videoTracks.some((_track) => _track.isLocal() && _track.videoType === "camera" && !_track.isMuted()), [videoTracks])
    const isAudioMuted = useMemo(() => !audioTracks.some((_track) => _track.isLocal() && !_track.isMuted()), [audioTracks])

    const load = useCallback(async (e) => {
        e && e.preventDefault()
        setMainState("loading")
        try {
            await Jitsi.load()
            setMainState("loaded")
        } catch (error) {
            setMainState("initial")
            return Promise.reject(error)
        }
    }, [addTrack])

    const checkAudio = useCallback((localAudioTracks) => {
        if (localAudioTracks) {

            localAudioTracks[0].type !== 'audio' && setNoAudioInput(prev => (
                {
                    ...prev,
                    noPermission: true,
                }
            ))

            localAudioTracks[0].type === 'audio' && localAudioTracks[0].track.muted && setNoAudioInput(prev => (
                {
                    ...prev,
                    muted: true,
                }
            ))

        } else {
            setNoAudioInput(prev => (
                {
                    ...prev,
                    noAudioINput: true,
                }
            ))
        }
    }, [setNoAudioInput])

    const obtainMediaDevices = useCallback(() => {
        console.log("aq")
        setUserLocationState("obtainMediaDevices")
        return new Promise(async (resolve, reject) => {
            const [localAudioTracks, localVideoTracks] = mainState && (await allSettled([
                JitsiMeetJS.createLocalTracks({
                    devices: ["audio"],
                    facingMode: "user",
                }, true),
                JitsiMeetJS.createLocalTracks({
                    devices: ["video"],
                    facingMode: "user",
                }, true),
            ])).filter(p => p.status === "fulfilled").map(p => p.value)

            const localTracks = [...localAudioTracks || [], ...localVideoTracks || []]

            localTracks.forEach((localTrack) => {
                addTrack(localTrack)
            })

            resolve(localTracks)
        })
    }, [addTrack, mainState])

    const disposeLocalTracks = useCallback(async () => {
        const localTracks = getTracks(undefined, true);
        localTracks.forEach(async (track) => {
            await track.dispose()
            removeTrack(track)
        })
    }, [getTracks, removeTrack])

    const handleTracksAddition = useCallback(async (localTracks, conference) => {
        let tracks = localTracks || getTracks(undefined, true)

        if (tracks.length === 0) tracks = await obtainMediaDevices()

        let conferenceTracks = []

        tracks.forEach((localTrack) => {
            conferenceTracks.push(conference.addTrack(localTrack))
        })

        return Promise.all(conferenceTracks)
    }, [getTracks, obtainMediaDevices, mainState])

    const handleTracksdispose = useCallback(async (track, type, state, propConference) => {

        if (track) {
            await track.dispose()
            removeTrack(track)
        }

        const [newLocalTrack] = await JitsiMeetJS.createLocalTracks({
            devices: [type],
            facingMode: "user",
        }, true)

        if (newLocalTrack) {
            state === 'mute' ? newLocalTrack.mute() : newLocalTrack.unmute()
            try {
                if (conference) await conference.addTrack(newLocalTrack)
                else if (propConference) await propConference.addTrack(newLocalTrack)
            } catch (error) {
                console.log("error: ", error)
            }
        }

    }, [getTracks, videoTracks, audioTracks, conference, addTrack])

    const onP2PChange = useCallback(async (event, conference) => {
        if (!event.p2p) {
            const alreadyAddedTracks = conference._getActiveMediaSession().peerconnection.getLocalTracks();

            if (alreadyAddedTracks.length === 0) await handleTracksAddition(null, conference)

            const tracks = getTracks(undefined, true)

            for (let i = 0; i < tracks.length; i++) {
                handleTracksdispose(tracks[i], tracks[i].type, 'unmute', conference)
            }
        }
    }, [handleTracksAddition, getTracks, mainState])

    const connect = useCallback(async (e, localTracks) => {
        setUserLocationState("connect")
        e && e.preventDefault()
        setMainState("conference_loading")
        let connection = await Jitsi.connect({ domain, room, config })
        setConnection(connection)


        let conference = await Jitsi.join({ connection, room, currentUser, isPublicRoom })
        setConference(conference)

        conference.setSenderVideoConstraint(720)
        conference.setReceiverVideoConstraint(720)

        window.conference = conference

        setParticipants(prevState => [
            ...prevState,
            ...conference.getParticipants().map(participant => participant.getId())
        ]);

        conference.on(JitsiMeetJS.events.conference.TRACK_MUTE_CHANGED, track => { })
        conference.on(JitsiMeetJS.events.conference.USER_JOINED, participantId => {
            setParticipants(prevState => [...prevState, participantId]);
        })
        conference.on(JitsiMeetJS.events.conference.USER_LEFT, participantId => {
            setParticipants(prevState => prevState.filter(el => el !== participantId));
        })
        conference.on(JitsiMeetJS.events.conference.DOMINANT_SPEAKER_CHANGED, participantId => {
            setDominantSpeaker(participantId);
        })

        await handleTracksAddition(localTracks, conference)
        conference.on(JitsiMeetJS.events.conference.TRACK_ADDED, addTrack)
        conference.on(JitsiMeetJS.events.conference.TRACK_REMOVED, removeTrack)
        conference.on(JitsiMeetJS.events.conference.P2P_STATUS, event => onP2PChange(event, conference));

        conference.on(JitsiMeetJS.events.connectionQuality.REMOTE_STATS_UPDATED, (id) => console.log("🚀 ~ file: useJitsi.js ~ line 202 ~ connect ~ data", id))
        conference.on(JitsiMeetJS.events.connectionQuality.LOCAL_STATS_UPDATED, (id) => console.log("🚀 ~ file: useJitsi.js ~ line 201 ~ connect ~ data", id))

        setMainState("started")
    }, [domain, room, tracks, desktopTracks, setIsDesktopSharingAvailable, currentUser, isPublicRoom])

    const leave = useCallback(async (e) => {
        e && e.preventDefault()
        getTracks(undefined, true).forEach((localTrack) => localTrack.dispose())
        setTracks([])
        Jitsi.leave(conference).catch((e) => { console.log(e) }).finally(() => {
            Jitsi.disconnect(connection).catch((e) => { console.log(e) })
            setMainState("")
        })

        setUserLocationState("left")
    }, [conference, connection, tracks, getTracks, setTracks, obtainMediaDevices])

    useEffect(() => {
        conference && window.top.postMessage({ callStatus: 'active', callType: isPublicRoom ? 'public' : 'chat' }, '*');
    }, [conference])

    useEffect(() => {
        window.addEventListener("beforeunload", leave)

        return () => {
            leave().catch()
            window.removeEventListener("beforeunload", leave)
        }
    }, [])

    useEffect(() => {
        setLoading(prev => {
            if (prev) {
                load().then(() => {
                    return false
                })
            } else return prev
        })
    }, [load, setLoading])

    useEffect(() => {
        if (upcomingBooking) {
            setRoom(upcomingBooking.id.toLowerCase())
        }
    }, [upcomingBooking, setRoom])

    useEffect(() => {
        publicRoomId && setRoom(publicRoomId)
    }, [publicRoomId])

    useEffect(() => {
        audioTracks.map(track => {
            const id = track.getParticipantId()
            track.isMuted()
                ? setMutedParticipants(prev => prev.includes(id) ? prev : [...prev, id])
                : setMutedParticipants(prev => prev.filter(p => p !== id))
            track.isLocal() && setLocalParticipantId(id)
        })
    }, [audioTracks])

    const toggleTrack = useCallback(async (type) => {
        const isVideo = type === 'camera'
        const isMuted = isVideo ? isCameraMuted : isAudioMuted
        const typeForDispose = isVideo ? 'video' : 'audio'
        const mutedStorageName = isVideo ? 'isCameraMuted' : 'isAudioMuted'

        const track = getTracks(type, true)

        if (track.length === 0) handleTracksdispose(null, typeForDispose, 'unmute')
        else track.forEach(async (_track) => {

            if (isMuted) {
                try {
                    await _track.unmute()
                } catch (error) {
                    console.log('error: ', error);
                    handleTracksdispose(_track, typeForDispose, 'unmute')
                }
            } else {
                try {
                    await _track.mute()
                } catch (error) {
                    console.log('error: ', error);
                    handleTracksdispose(_track, typeForDispose, 'mute')
                }
            }
        })
    }, [isAudioMuted, audioTracks, isCameraMuted, videoTracks, conference])

    const updateConstraits = () => {
        const constraints = {
            video: {
                height: {
                    ideal: 720,
                    max: 720,
                    min: 240
                },
                width: {
                    ideal: 1280,
                    max: 1280,
                    min: 320
                }
            }
        }

        const ids = conference.getParticipants().map(participant => participant.getId());
        constraints.onStageEndpoints = ids
        constraints.selectedEndpoints = ids
        conference.setReceiverConstraints(constraints)
        conference.setSenderVideoConstraint(720)
        conference.setReceiverVideoConstraint(720)
        conference.selectParticipants(ids);

    }

    return {
        room,
        setRoom,
        isDesktopSharingEnabled,
        isCameraMuted,
        isAudioMuted,
        isDesktopSharingAvailable,
        connection,
        tracks,
        getTracks,
        audioTracks,
        videoTracks,
        desktopTracks,
        toggleTrack,
        connect,
        mainState,
        loading,
        leave,
        setUpcomingBooking,
        upcomingBooking,
        conference,
        obtainMediaDevices,
        participants,
        setPublicRoomId,
        activeSpeakers,
        lastSpeaker,
        localParticipantId,
        mutedParticipants,
        setMutedParticipants,
        userLocationState,
        dominnatSpeaker,
        noAudioInput,
        disposeLocalTracks,
        updateConstraits
    }
}

export default useJitsi

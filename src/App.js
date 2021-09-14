import './App.css';
import React, { useCallback, useMemo } from 'react'
import Participant from './Participant'
import useJitsi from './Jitsi/hooks/useJitsi';
import $ from "jquery"
window.$ = $


function App() {

  const jitsi = useJitsi(null, true)

  const sortByIsLocal = (tracks) => {
    return tracks.slice().sort((a, b) => {
      if (a.isLocal() === b.isLocal()) {
        return 0
      }
      if (a.isLocal()) {
        return 1
      }
      if (b.isLocal()) {
        return -1
      }
      return 0
    })
  }

  const sortedDesktopTracks = useMemo(() => {
    return sortByIsLocal(jitsi.desktopTracks)
  }, [jitsi.desktopTracks])

  const videoTracks = useMemo(() => {
    return sortedDesktopTracks.slice(1).concat(sortByIsLocal(jitsi.videoTracks))
  }, [jitsi.videoTracks, sortedDesktopTracks])

  const localParticipant = useMemo(() => (
    <Participant
      name={"12"}
      track={videoTracks.find(track => track.isLocal())}
      key={`participant_${Math.random()}`}
    />
  ), [videoTracks])


  const otherParticipant = useMemo(() => (
    jitsi.participants.length ? jitsi.participants.map(participantId => {
      const participant = jitsi.conference.getParticipantById(participantId);
      return participant ? (
        <Participant
          name={participant.getDisplayName()}
          track={videoTracks.find(track => track.getParticipantId() === participantId)}
          key={`participant_${participantId}`}
        />
      ) : null
    }) : null
  ), [jitsi.participants, jitsi.conference, videoTracks])


  const onJoin = useCallback(() => {
    jitsi.obtainMediaDevices().then(
      jitsi.connect()
    )
  }, [jitsi])

  return (
    <div className="App">
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'end',
      }}>
        {localParticipant}
        {otherParticipant}
      </div>

      <button onClick={onJoin}>join</button>
    </div>
  );
}

export default App;

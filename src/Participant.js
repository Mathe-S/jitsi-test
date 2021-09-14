import React from "react"

const Participant = ({ track, name }) => {


    const renderedVideo = React.useMemo(() => track ?
        <video autoPlay
            playsInline
            key={`track_${track.getId()}`}
            ref={(ref) => ref && track.attach(ref)}
            style={{
                width: '100vw',
                height: '500px',
            }}
        /> : null
        , [track && track.isMuted()])

    return (
        <div >
            {renderedVideo}
        </div>
    )
}

export default Participant
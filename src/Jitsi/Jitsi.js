/* global JitsiMeetJS*/
import memoize from "lodash.memoize"
import qs from "qs"

const connect = async ({ room, config }) => {
    const connectionConfig = Object.assign({}, config)
    let serviceUrl = connectionConfig.websocket || connectionConfig.bosh

    serviceUrl += `?room=${room}`

    connectionConfig.serviceUrl = connectionConfig.bosh = serviceUrl

    return new Promise((resolve, reject) => {
        const connection = new JitsiMeetJS.JitsiConnection(null, undefined, connectionConfig)
        connection.addEventListener(
            JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
            () => resolve(connection))
        connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_FAILED, reject)
        connection.connect()
    })
}

const disconnect = (connection) => {
    return new Promise((resolve) => {
        connection.addEventListener(
            JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
            () => resolve(connection))
        connection.disconnect()
    })
}

const join = async ({ connection, currentUser }) => {
    const conference = connection.initJitsiConference("mathesroom", {
        p2p: {
            enabled: false,
        },

        disableSimulcast: false,
        enableLayerSuspension: true,
        // enableRemb: true,
        // enableTcc: true,

        bosh: "//meet.envite.live/http-bind",
        websocket: "wss://meet.envite.live/xmpp-websocket",
        clientNode: "http://meet.envite.live/jitsimeet",
        externalConnectUrl: "//meet.envite.live/http-pre-bind",
        hosts: {
            domain: "meet.jitsi",
            muc: "muc.meet.jitsi",
        },

        resolution: 720,
        maxEnabledResolution: 720,
        disableTileView: true,
        disableAudioLevels: true,

        constraints: {
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
        },

        openBridgeChannel: 'websocket',
        videobridge: {
            websockets: {
                enabled: true,
            },
        },
        maxFullResolutionParticipants: -1,
        channelLastN: 20,
    })
    if (currentUser) {
        conference.setDisplayName(currentUser.name)
        conference.setLocalParticipantProperty("name", currentUser.name)
        conference.setLocalParticipantProperty("id", currentUser.id)
        conference.setLocalParticipantProperty("is_admin", currentUser.id === currentUser.ownerId)
    }
    return new Promise(resolve => {
        conference.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, () => resolve(conference))
        conference.join()
    })
}

const leave = (conference) => {
    return new Promise((resolve, reject) => {
        conference.on(JitsiMeetJS.events.conference.CONFERENCE_LEFT, () => resolve(conference))
        conference.leave().catch(reject)
    })
}

const loadScript = memoize((url) => {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script")
        script.src = url
        document.querySelector("head").appendChild(script)
        script.onload = resolve
        script.onerror = reject
    })
})

const load = () => {
    return new Promise((resolve, reject) => {
        return Promise.all([loadScript("https://meet.jit.si/config.js"), import("@webiz-envite/lib-jitsi-meet")])
            .then(([, jitsiMeet]) => {
                console.log("efaefaew")
                window.JitsiMeetJS = jitsiMeet
                window.config.deploymentInfo = {}
                window.config.bosh = "//meet.envite.live/http-bind"
                window.config.websocket = "wss://meet.envite.live/xmpp-websocket"
                window.config.clientNode = "http://meet.envite.live/jitsimeet"
                window.config.externalConnectUrl = "//meet.envite.live/http-pre-bind"
                window.config.hosts = {
                    domain: "meet.jitsi",
                    muc: "muc.meet.jitsi",
                }
                JitsiMeetJS.init()
                resolve()
            })
            .catch(reject)
    })
}

const getDefaultParams = () => {
    const params = document.location.search.length > 1 ? qs.parse(document.location.search.slice(1)) : {}
    return {
        room: params.room || "daily_standup",
        domain: params.domain || "meet.envite.live",
        autoJoin: params.autojoin || true,
    }
}

const objTOExport = {
    connect,
    disconnect,
    join,
    leave,
    load,
    getDefaultParams,
}

export default objTOExport

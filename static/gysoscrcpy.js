console.log("loaded js")
import {h264ParseConfiguration} from '/static/general/js/h264_parse.js';
import {h265ParseConfiguration} from '/static/general/js/h265_parse.js';
const errorMsgView = $('#error_msg1');
const errorMsgView2 = $('#error_msg2');
let controlInfo = {
    "audio": true,
    "video_codec": "h264",
    "audio_codec": "aac",
    "audio_source": "output",
    "max_size": 1920,
    "video_bit_rate": 800000,
    "audio_bit_rate": 128000,
    "max_fps": 60,
    "tunnel_forward": true,
    "crop": "",
    "control": true,
    "show_touches": false,
    "stay_awake": true,
    "video_codec_options": "profile=1,level=2",
    "audio_codec_options": "",
    "video_encoder": "",
    "audio_encoder": "",
    "power_off_on_close": false,
    "clipboard_autosync": false,
    "power_on": true,
    "scid": "0fff2f7a"
};
const socketHostname = window.location.hostname;
const socketPort = window.location.port;
window.h264ParseConfiguration = h264ParseConfiguration
window.h265ParseConfiguration = h265ParseConfiguration
let current_device_id = "null_device_id"

function load_video_player() {
    window.canvas_resolution = [0, 0];
        window.video_player = new Player({
            useWorker: true,
            webgl: 'auto',
            size: {width: 1920/2, height: 720/2},
            workerFile: "/static/general/js/Decoder.js",
            preserveDrawingBuffer: true
        });
        window.video_player_feed = function (data) {
            if (data[4] === 103) {
                const {
                    profileIndex,
                    constraintSet,
                    levelIndex,
                    croppedWidth,
                    croppedHeight,
                } = window.h264ParseConfiguration(data);
                console.log("video_player_feed dprofileIndex = "+profileIndex, ", constraintSet="+constraintSet, ", levelIndex="+levelIndex);
                window.canvas_resolution = [croppedWidth, croppedHeight];
                update_resolution();
            }
            window.video_player.decode(data);
            // console.log("video_nal data size = "+data_size, ", nal="+data.toString());
        }
        window.video_renderer_canvas = attach_canvas(controlInfo.control, window.video_player.canvas, function (data) {
            //console.log(JSON.stringify(data))
            window.ws.emit('device_event', {device_id: current_device_id, msg:data});
        })
}

function joinDevice() {
    window.ws.emit('join_device', { device_id: current_device_id});
}

function leaveDevice() {
    window.ws.emit('leave_device', { device_id: current_device_id});
}


function load_websocket() {
    window.ws = io.connect(`http://${socketHostname}:${socketPort}`);
    window.ws.binaryType = 'arraybuffer'
    window.ws.on('connect', function () {
            joinDevice()
            console.log('Connected to server');
            errorMsgView2.css('display', 'none');
            window.player_start_date = new Date();
            window.data_size = 0
            window.frame_cnt = 0
            window.previous_data_size = 0
            window.previous_frame_cnt = 0
    });
    window.ws.on('error', ()=>{
        console.log("Failed connect to device, maybe adb offline !!!");
    });

    window.ws.on('audio_nal', function (message){
        let unit8_data = new Uint8Array(message)
        console.log("on audio_nal: ", unit8_data.toString());
    });

    window.ws.on('video_header', function (message){
        let unit8_data = new Uint8Array(message)
        console.log("on video_header: ", unit8_data.toString());
    });

    window.ws.on('audio_header', function (message){
        let unit8_data = new Uint8Array(message)
        console.log("on audio_header: ", unit8_data.toString());
    });

    window.ws.on('other_data', function (message){
        let unit8_data = new Uint8Array(message)
        console.log("on other_data: ", unit8_data.toString());
    });

    window.ws.on('video_nal', function (message){
        let unit8_data = new Uint8Array(message)
        window.data_size += unit8_data.length
        let start_code = unit8_data.slice(0, 5).join('')
        if (start_code.startsWith('0001')) {
            window.frame_cnt += 1
            window.video_player_feed(unit8_data)
        }
    });
    window.ws.onclose = ()=>{
        window.player_start_date = null;
        window.data_size = 0
        window.frame_cnt = 0
        window.previous_data_size = 0
        window.previous_frame_cnt = 0
        console.log('ws: Client disconnected')
    }
}

$(document).ready(function () {
    $.ajax({
        url: "/getAdbDevicesList",
        method: "GET",
        dataType: "json",
        success: function (response) {
            const devices = response.devices
            console.log('Devices:', devices);
            if(devices.length > 0){
                current_device_id = devices[0]
                console.log("current_device_id ["+current_device_id+"]")
                $.ajax({
                        url: "/getCtrlInfo/"+current_device_id,
                        method: "GET",
                        dataType: "json",
                        success: function (ctrlInfo) {
                            controlInfo = ctrlInfo;
                            console.log(controlInfo);
                            load_video_player()
                            load_websocket()
                        },
                        error: function (error) {
                            console.error("Error fetching conversations:", error);
                        },
                    })
            }
        },
        error: function (error) {
            console.error("Error fetching getAdbDevicesList:", error);
        },
    })
})

$(window).on('beforeunload', function() {
    leaveDevice()
})

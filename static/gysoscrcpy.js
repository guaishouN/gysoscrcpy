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
    "max_size": 720,
    "video_bit_rate": 800000,
    "audio_bit_rate": 128000,
    "max_fps": 25,
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
function load_utils() {
    // 1 给Date对象增加时间格式化方法
    Date.prototype.formatCode = function (formatStr = "yyyy-MM-DD HH:mm:ss") {
        const paddingZero = num => num >= 10 ? num : '0' + num;
        let str = formatStr;
        str = str.replace(/yyyy|YYYY/, this.getFullYear());
        str = str.replace(/MM/, paddingZero(this.getMonth() + 1));
        str = str.replace(/dd|DD/, paddingZero(this.getDate()));
        str = str.replace(/hh|HH/, paddingZero(this.getHours()));
        str = str.replace(/mm/, paddingZero(this.getMinutes()));
        str = str.replace(/ss/, paddingZero(this.getSeconds()));
        str = str.replace(/SS/, paddingZero(this.getMilliseconds()));
        return str;
    };

    // 3.control support
    $('#capture_button').on('click', button_handle_capture)
    add_button_mouse_event($('#menu_button'), 82);
    add_button_mouse_event($('#home_button'), 3);
    add_button_mouse_event($('#back_button'), 4);
    add_button_mouse_event($('#v+_button'), 24);
    add_button_mouse_event($('#v-_button'), 25);
    add_button_mouse_event($('#power_button'), 26);
    $('#sw-state').on('click', toggle_sw)
    $('#get_clipboard_button').on('click', button_handle_get_clipboard)
    $('#set_clipboard_button').on('click', button_handle_set_clipboard)
    $('#multi-key_button').on('click', button_handle_multi_key)
}

function load_audio_player() {
    window.audio_player = null
    if (controlInfo.audio !== false) {
        // 2.1 raw audio
        if (controlInfo.audio_codec === 'raw') {
            window.audio_player = new PCMPlayer({
                encoding: '16bitInt',
                channels: 2,
                sampleRate: 48000,
                flushingTime: 70
            });
            window.audio_player_feed = function (data) {
                window.audio_player.feed(data)
            };
        }
        // 2.2 opus audio
        else if (controlInfo.audio_codec === 'opus') {
            try {
                window.audio_decoder = new AudioDecoder({
                    error(error) {
                        console.log("audio decoder error: ", error);
                    },
                    output(output) {
                        // Opus decodes to "f32",
                        // converting to another format may cause audio glitches on Chrome.
                        const options = {format: "f32", planeIndex: 0,};
                        const buffer = new Float32Array(output.allocationSize(options) / Float32Array.BYTES_PER_ELEMENT);
                        output.copyTo(buffer, options);
                        window.audio_player.feed(buffer)
                    },
                });
                window.audio_player = new PCMPlayer({
                    encoding: '32bitFloat',
                    channels: 2,
                    sampleRate: 48000,
                    flushingTime: 30
                });
                window.audio_decoder.configure({codec: 'opus', numberOfChannels: 2, sampleRate: 48000,})
                window.audio_player_feed = function (data) {
                    if (data[0] === 252) {
                        const chunk = new EncodedAudioChunk({type: "key", timestamp: 0, data: data})
                        window.audio_decoder.decode(chunk)
                    }
                }
            } catch (e) {
                errorMsgView.css('display', 'block');
                errorMsgView.innerHTML = "Error: no audio webcodecs support!";
                console.log(e)
            }
        }
        // 2.3 aac audio
        else if (controlInfo.audio_codec === 'aac') {
            try {
                window.audio_decoder = new AudioDecoder({
                    error(error) {
                        console.log("audio decoder error: ", error);
                    },
                    output(output) {
                        // AAC decodes to "f32-planar",
                        // converting to another format may cause audio glitches on Chrome.
                        const options = {format: "f32-planar", planeIndex: 0,};
                        const planar_buffer = new Float32Array(output.allocationSize(options) / Float32Array.BYTES_PER_ELEMENT);
                        output.copyTo(planar_buffer, options);
                        const buffer = new Float32Array(planar_buffer.length * 2)
                        for (i = 0; i < planar_buffer.length; i++) {
                            buffer[2 * i] = buffer[2 * i + 1] = planar_buffer[i]
                        }
                        window.audio_player.feed(buffer)
                    },
                });
                window.audio_player = new PCMPlayer({
                    encoding: '32bitFloat',
                    channels: 2,
                    sampleRate: 48000,
                    flushingTime: 20
                });
                window.audio_player_feed = function (data) {
                    if (data[0] === 17) {
                        window.audio_decoder.configure({
                            codec: 'mp4a.66',
                            numberOfChannels: 2,
                            sampleRate: 48000,
                            description: data
                        })
                    } else {
                        let chunk = new EncodedAudioChunk({type: "key", timestamp: 0, data: data})
                        window.audio_decoder.decode(chunk)
                    }
                }
            } catch (e) {
                console.log(e)
                errorMsgView.css('display', 'block');
                errorMsgView.innerHTML = "Error: no audio webcodecs support!";
            }
        }
    }
}

function load_video_player() {
    window.canvas_resolution = [0, 0];
    if ($('#video_play_select').text()) {
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
                window.canvas_resolution = [croppedWidth, croppedHeight];
                update_resolution();
            }
            window.video_player.decode(data);
            console.log("video_nal data size = "+data_size, ", nal="+data.toString());
        }
        window.video_renderer_canvas = attach_canvas(controlInfo.control, window.video_player.canvas, function (data) {
            window.ws.emit('device_event', {device_id: current_device_id, msg:data});
        })
    }
}

function joinDevice() {
    window.ws.emit('join_device', { device_id: current_device_id});
}

function leaveDevice() {
    window.ws.emit('leave_device', { device_id: current_device_id});
}


function load_websocket() {
    let ws_url = `http://${socketHostname}:${socketPort}`;
    if ($('#video_play_select').value === 'broardway2') {
        let broardway2ParamDict = Object.assign({}, controlInfo);
        delete broardway2ParamDict['video_codec_options'];
        let broardway2_query_param = "config=" + encodeURIComponent(JSON.stringify(broardway2ParamDict));
        console.log(broardway2_query_param);
        ws_url = "ws://" + document.location.host + "/stream/device/{{device_id}}/?" + broardway2_query_param;
        console.log("broardway2 video player use no video_codec_options!!!");
    }
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
        // 1.视频流数据
        if (start_code.startsWith('0001')) {
            window.frame_cnt += 1
            window.video_player_feed(unit8_data)
        }
        //2.其它流数据
        else if (start_code.startsWith('0002')) {
            data = unit8_data.slice(5)
            if (start_code.endsWith('0')) {
                $('#get_clipboard').value = new TextDecoder("utf-8").decode(data)
            } else if (start_code.endsWith('1')) {
                console.log("paste_sequence:", data)
            } else if (start_code.endsWith('2')) {
                let recorder_filename = String.fromCharCode.apply(null, data)
                console.log("recorder_filename-->: ", recorder_filename)
            }
        }
        //3.音频流数据
        else if (start_code.startsWith('0003')) {
            if (window.audio_player) {
                window.audio_player_feed(unit8_data.slice(4))
            }
        }
    });
    window.ws.onclose = ()=>{
        window.player_start_date = null;
        window.data_size = 0
        window.frame_cnt = 0
        window.previous_data_size = 0
        window.previous_frame_cnt = 0
        console.log('ws: Client disconnected')
        errorMsgView2.css('display', 'block');
        errorMsgView2.innerHTML = "Client disconnected";
    }
}

// reload
function reload() {
    window.ws.onclose = ()=>{
        console.log('ws: Client disconnected')
    }
    leaveDevice()
    window.ws.close()
    errorMsgView.css('display', 'none');
    load_audio_player()
    load_video_player()
    load_websocket()
}

// reload audio player
function reload_audio_player() {
    if (window.audio_player != null) {
        window.audio_player.init(window.audio_player.option)
    }
}

//flush_duration
function flush_duration() {
    // 1.duraion
    if (window.player_start_date) {
        let date_now = new Date();
        $('#player_duration').innerHTML = parseInt((date_now - window.player_start_date) / 1000);
    } else {
        $('#player_duration').innerHTML = 0;
    }
    // 2.data
    let fps = "fps: " + (window.frame_cnt - window.previous_frame_cnt).toString() + '; '
    window.previous_frame_cnt = window.frame_cnt
    let rate = "bit_rate: " + ((window.data_size - window.previous_data_size) / 1024).toFixed(1).toString() + 'KB/s; '
    window.previous_data_size = window.data_size
    const size = "data_size: " + (window.data_size / (1024 * 1024)).toFixed(1).toString() + 'Mb'
    console.log("Player_state --> ", fps + rate + size)
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
                            $('#reload_button').click(reload)
                            $('#reload_volume').click(reload_audio_player)
                            load_utils()
                            load_audio_player()
                            load_video_player()
                            load_websocket()
                            setInterval(flush_duration, 1000);
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

console.log("loaded js")
import {h264ParseConfiguration} from '/static/general/js/h264_parse.js';
import {h265ParseConfiguration} from '/static/general/js/h265_parse.js';
const errorMsgView = $('#error_msg1');
const errorMsgView2 = $('#error_msg2');
let msg = null;

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
const socketPort = 5000;
window.h264ParseConfiguration = h264ParseConfiguration
window.h265ParseConfiguration = h265ParseConfiguration

// 0.keycode事件
function inject_keycode(keycode, action) {
    msg = {
        msg_type: 0,
        keycode: keycode,
        action: action
    }
    window.ws.emit("scr_event", JSON.stringify(msg))
}

// 1.text事件
function inject_text(text) {
    msg = {
        msg_type: 1,
        text: text,
    }
    window.ws.emit("scr_event", JSON.stringify(msg))
}

// 2.touch事件
function inject_touch_event(pix_data, action) {
    msg = {
        msg_type: 2,
        action: action,
        resolution: window.canvas_resolution,
        x: pix_data[0],
        y: pix_data[1],
    }
    window.ws.emit("scr_event", JSON.stringify(msg))
}

// 3.scroll事件
function inject_scroll_event(pix_data) {
    msg = {
        msg_type: 3,
        x: pix_data[0],
        y: pix_data[1],
        resolution: window.canvas_resolution,
        distance_x: pix_data[2],
        distance_y: pix_data[3],
    }
    window.ws.emit("scr_event", JSON.stringify(msg))
}

// 8.get_clipboard
function get_clipboard(copy_key = 1) {
    msg = {
        msg_type: 8,
        copy_key: copy_key
    }
    window.ws.emit("scr_event", JSON.stringify(msg))
}

// 9.set_clipboard
function set_clipboard(text, sequence = 1, paste = true) {
    msg = {
        msg_type: 9,
        text: text,
        sequence: sequence,
        paste: paste
    }
    window.ws.emit("scr_event", JSON.stringify(msg))
}

// 10.sw
function toggle_sw() {
    let screen_power_mode = 2
    this.textContent = 'sw-on'
    if (this.textContent === 'sw-on') {
        screen_power_mode = 0
        this.textContent = 'sw-off'
    }
    msg = {
        msg_type: 10,
        screen_power_mode: screen_power_mode,
    }
    window.ws.emit("scr_event", JSON.stringify(msg))
}

// 30.swipe
function swipe(pix_data, delay = 0, unit = 13) {
    delay = parseFloat(delay.toFixed(2))
    if (delay <= 3 && delay >= 0) {
        msg = {
            msg_type: 30,
            x: pix_data[0],
            y: pix_data[1],
            resolution: window.canvas_resolution,
            end_x: pix_data[2],
            end_y: pix_data[3],
            unit: unit,
            delay: delay,
        }
        window.ws.emit("scr_event", JSON.stringify(msg))
    }
}

// 999.update_resolution
function update_resolution() {
    msg = {
        msg_type: 999,
        resolution: window.canvas_resolution,
    }
    window.ws.emit("scr_event", JSON.stringify(msg))
}

// 节流函数
function throttle(fn, during) {
    let t = null
    return function (e) {
        if (!t) {
            t = setTimeout(() => {
                fn.call(this, e)
                t = null
            }, during)
        }
    }
}

// 获取鼠标在元素内的坐标
function get_pointer_position(event, ele) {
    x = event.clientX - ele.offsetLeft + window.scrollX;
    x = parseInt(x);
    x = Math.min(x, ele.width);
    x = Math.max(x, 0);
    y = event.clientY - ele.offsetTop + window.scrollY;
    y = parseInt(y);
    y = Math.min(y, ele.height);
    y = Math.max(y, 0);
    return [x, y]
}

// canvas鼠标移动事件处理函数
function canvas_mouse_move(event) {
    let pix_data = get_pointer_position(event, this)
    inject_touch_event(pix_data, 2)
}

// touch事件
function add_canvas_touch_event(ele) {
    // 在window对象记录touch开始
    window.touch_start = null
    // 节流的mouse_move
    let efficient_canvas_mouse_move = throttle(canvas_mouse_move, 15);
    // 1.mousedown
    $(ele).on('mousedown', function (event) {
        if (event.buttons === 1) {
            window.touch_start = true
            this.removeEventListener("mousemove", efficient_canvas_mouse_move)
            let pix_data = get_pointer_position(event, this)
            inject_touch_event(pix_data, 0)
            this.on('mousemove', efficient_canvas_mouse_move)
        }
    })
    // 2.mouseup
    $(ele).on('mouseup', function (event) {
        if (window.touch_start) {
            window.touch_start = false
            let pix_data = get_pointer_position(event, this)
            inject_touch_event(pix_data, 1)
            this.removeEventListener("mousemove", efficient_canvas_mouse_move)
        }
    })
    // 3.mouseout
    $(ele).on('mouseout', function (event) {
        if (window.touch_start) {
            window.touch_start = false
            let pix_data = get_pointer_position(event, this)
            inject_touch_event(pix_data, 1)
            this.removeEventListener("mousemove", efficient_canvas_mouse_move)
        }
    })
}

// swipe事件
function add_canvas_swipe_event(ele) {
    window.swipe_start = null
    window.swipe_start_pix_data = null
    // 1.mousedown
    $(ele).on('mousedown', function (event) {
        if (event.buttons === 4) {
            window.swipe_start = Date.now()
            window.swipe_start_pix_data = get_pointer_position(event, this)
        }
    })
    // 2.mouseup
    $(ele).on('mouseup', function (event) {
        if (window.swipe_start) {
            let swipe_end = Date.now()
            let delay = (swipe_end - window.swipe_start) / 1000
            window.swipe_start = null
            let swipe_end_pix_data = get_pointer_position(event, this)
            let pix_data = window.swipe_start_pix_data.concat(swipe_end_pix_data)
            window.swipe_start_pix_data = null
            swipe(pix_data, delay)
        }
    })
    // 3.mouseout
    $(ele).on('mouseout', function (event) {
        if (window.swipe_start) {
            let swipe_end = Date.now()
            let delay = (swipe_end - window.swipe_start) / 1000
            window.swipe_start = null
            let swipe_end_pix_data = get_pointer_position(event, this)
            let pix_data = window.swipe_start_pix_data.concat(swipe_end_pix_data)
            window.swipe_start_pix_data = null
            swipe(pix_data, delay)
        }
    })
}

// 处理canvas mouse scroll
function canvas_mouse_scroll(event) {
    let pix_data = get_pointer_position(event, this)
    let distance_x = 5
    if (event.deltaX > 0) {
        distance_x = -5
    }
    pix_data[2] = distance_x
    let distance_y = 5
    if (event.deltaY > 0) {
        distance_y = -5
    }
    pix_data[3] = distance_y
    inject_scroll_event(pix_data)
}

// scroll事件
function add_canvas_scroll_event(ele) {
    let efficient_canvas_mouse_scroll = throttle(canvas_mouse_scroll, 100);
    $(ele).on("wheel", efficient_canvas_mouse_scroll)
}

// 处理设置剪切板
function button_handle_set_clipboard() {
    const ele = $('#set_clipboard');
    if (ele.value) {
        set_clipboard(ele.value)
        ele.value = ''
    }
}

// 处理获取剪切板
function button_handle_get_clipboard() {
    get_clipboard(1)
}

// 处理截图
const xhr = new XMLHttpRequest();

function button_handle_capture() {
    let ele = $('#capture')
    ele.href = window.video_renderer_canvas.toDataURL()
    ele.download = window.device_id + '_' + (new Date().formatCode()) + '.png'
    ele.click()
    xhr.open('POST', '/api/v1/general/picture/upload_base64/', true)
    xhr.setRequestHeader('content-type', 'application/json');
    xhr.withCredentials = true;
    xhr.send(JSON.stringify({'img': ele.href, "device_id": window.device_id}))
}

// 处理同时按2个键
function button_handle_multi_key() {
    let key_list = ['menu', 'home', 'back', 'v+', 'v-', 'power']
    let checked_key_list = []
    for (const key of key_list) {
        let checkbox = document.getElementById(key + '_checkbox')
        if (checkbox.checked) {
            checked_key_list.push(parseInt(checkbox.value))
        }
        if (checked_key_list.length === 2) {
            break
        }
    }
    if (checked_key_list.length >= 2) {
        inject_keycode(checked_key_list[0], 0)
        inject_keycode(checked_key_list[1], 0)
        inject_keycode(checked_key_list[1], 1)
        inject_keycode(checked_key_list[0], 1)
    }
}

// 处理button长按事件
function add_button_mouse_event(ele, keycode) {
    // 1.mousedown
    $(ele).on('mousedown', function (event) {
        if (event.buttons === 1) {
            inject_keycode(keycode, 0)
            window.button_mouse_up_down_keycode = true
        }
    })
    // 2.mouseup
    $(ele).on('mouseup', ()=>{
        if (window.button_mouse_up_down_keycode) {
            inject_keycode(keycode, 1)
            window.button_mouse_up_down_keycode = null
        }
    })
    // 3.mouseout
    $(ele).on('mouseout', ()=> {
        if (window.button_mouse_up_down_keycode) {
            inject_keycode(keycode, 1)
            window.button_mouse_up_down_keycode = null
        }
    })
}

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

function toHex(value) {
    return value.toString(16).padStart(2, "0").toUpperCase();
}

function toUint32Le(data, offset) {
    return (
        data[offset] |
        (data[offset + 1] << 8) |
        (data[offset + 2] << 16) |
        (data[offset + 3] << 24)
    );
}

function handle_config_data(data) {
    if (window.video_config_data !== undefined) {
        let fix_data = new Uint8Array(window.video_config_data.byteLength + data.byteLength)
        fix_data.set(window.video_config_data, 0)
        fix_data.set(data, window.video_config_data.byteLength)
        data = fix_data
        window.video_config_data = undefined
    }
    return data
}

function attach_canvas(canvas) {
    let playerElement = $('#container')
    playerElement.innerHTML = ""
    playerElement.appendChild(canvas)
    window.video_renderer_canvas = canvas
    // canvas control support
    if (controlInfo.control !== false) {
        add_canvas_touch_event(canvas);
        add_canvas_swipe_event(canvas);
        add_canvas_scroll_event(canvas);
    }
}

function load_video_player() {
    window.canvas_resolution = [0, 0];
    if ($('#video_play_select').text().startsWith('broardway')) {
        window.video_player = new Player({
            useWorker: true,
            webgl: 'auto',
            size: {width: 1336, height: 1720},
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
        }
        attach_canvas(window.video_player.canvas)
    } else {
        try {
            window.video_decoder = new VideoDecoder({
                output: function (frame) {
                    window.video_renderer_context.drawImage(frame, 0, 0);
                    frame.close();
                },
                error: function (e) {
                    console.log(e)
                }
            })
        } catch (e) {
            errorMsgView.css('display', 'block');
            errorMsgView.innerHTML = "Error: no video webcodecs support!";
            throw e;
        }
        if (controlInfo.video_codec === 'h264') {
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
                    const codec = `avc1.${[profileIndex, constraintSet, levelIndex].map(toHex).join("")}`
                    window.video_decoder.configure({codec: codec, optimizeForLatency: true})
                    let video_renderer_canvas = document.createElement("canvas")
                    video_renderer_canvas.width = croppedWidth;
                    video_renderer_canvas.height = croppedHeight;
                    attach_canvas(video_renderer_canvas)
                    window.video_config_data = data
                    window.video_renderer_context = video_renderer_canvas.getContext("2d")
                } else {
                    // 第一个key贞必须拼接上配置贞
                    data = handle_config_data(data)
                    const chunk = new EncodedVideoChunk({
                        type: data[4] in [101, 69, 37] ? "key" : "delta",
                        timestamp: 0,
                        data: data
                    })
                    window.video_decoder.decode(chunk)
                }
            }
        } else if (controlInfo.video_codec === 'h265') {
            window.video_player_feed = function (data) {
                let video_renderer_canvas;
                if (data[4] === 64) {
                    const {
                        generalProfileSpace,
                        generalProfileIndex,
                        generalProfileCompatibilitySet,
                        generalTierFlag,
                        generalLevelIndex,
                        generalConstraintSet,
                        croppedWidth,
                        croppedHeight,
                    } = window.h265ParseConfiguration(data);
                    window.canvas_resolution = [croppedWidth, croppedHeight];
                    update_resolution();
                    const codec = ["hev1",
                        ["", "A", "B", "C"][generalProfileSpace] +
                        generalProfileIndex.toString(),
                        toUint32Le(generalProfileCompatibilitySet, 0).toString(16),
                        (generalTierFlag ? "H" : "L") +
                        generalLevelIndex.toString(),
                        toUint32Le(generalConstraintSet, 0)
                            .toString(16)
                            .toUpperCase(),
                        toUint32Le(generalConstraintSet, 4)
                            .toString(16)
                            .toUpperCase(),
                    ].join(".")
                    window.video_decoder.configure({codec: codec, optimizeForLatency: true})
                    video_renderer_canvas = document.createElement("canvas")
                    video_renderer_canvas.width = croppedWidth;
                    video_renderer_canvas.height = croppedHeight;
                    attach_canvas(video_renderer_canvas)
                    window.video_config_data = data
                    window.video_renderer_context = video_renderer_canvas.getContext("2d")
                } else {
                    // 第一个key贞必须拼接上配置贞
                    data = handle_config_data(data)
                    const chunk = new EncodedVideoChunk({
                        type: data[4] in [38] ? "key" : "delta",
                        timestamp: 0,
                        data: data
                    })
                    window.video_decoder.decode(chunk)
                }
            }
        }
    }
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

    window.ws.on('message', function (message){
        console.log("on message: ",message);
    });

    window.ws.on('rtp-stream', function (msg){
        let unit8_data = new Uint8Array(msg.data)
        console.log("on rtp-stream: ", msg);
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
        url: "/getCtrlInfo/hello",
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
            //setInterval(flush_duration, 1000);
        },
        error: function (error) {
            console.error("Error fetching conversations:", error);
        },
    })
})


let send_fun 
function attach_canvas(isControl, canvas, a_send) {
    send_fun = a_send
    let playerElement = $('#container')
    playerElement.append(canvas)
    // canvas control support
    if (isControl !== false) {
        add_canvas_touch_event(canvas);
        add_canvas_swipe_event(canvas);
        add_canvas_scroll_event(canvas);
    }
    return canvas;
}

// 0.keycode事件
function inject_keycode(keycode, action) {
    msg = {
        msg_type: 0,
        keycode: keycode,
        action: action
    }
    send_fun(msg)
}

// 1.text事件
function inject_text(text) {
    msg = {
        msg_type: 1,
        text: text,
    }
    send_fun(msg)
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
    send_fun(msg)
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
    send_fun(msg)
}

// 8.get_clipboard
function get_clipboard(copy_key = 1) {
    msg = {
        msg_type: 8,
        copy_key: copy_key
    }
    send_fun(msg)
}

// 9.set_clipboard
function set_clipboard(text, sequence = 1, paste = true) {
    msg = {
        msg_type: 9,
        text: text,
        sequence: sequence,
        paste: paste
    }
    send_fun(msg)
}

// 10.sw
function toggle_sw() {
    const sw = $('#sw-state');
    let screen_power_mode = 2
    if (sw.text() === 'sw-on') {
        screen_power_mode = 0
        sw.text('sw-off')
    }else{
        sw.text('sw-on')
    }
    msg = {
        msg_type: 10,
        screen_power_mode: screen_power_mode,
    }
    send_fun(msg)
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
        send_fun(msg)
    }
}

// 999.update_resolution
function update_resolution() {
    msg = {
        msg_type: 999,
        resolution: window.canvas_resolution,
    }
    send_fun(msg)
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
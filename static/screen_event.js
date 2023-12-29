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
    let x = event.clientX - ele.offsetLeft + window.scrollX;
    x = parseInt(x);
    x = Math.min(x, ele.width);
    x = Math.max(x, 0);
    let y = event.clientY - ele.offsetTop + window.scrollY;
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
            $(this).on('mousemove', efficient_canvas_mouse_move)
        }
    })
    // 2.mouseup
    $(ele).on('mouseup', function (event) {
        if (window.touch_start) {
            window.touch_start = false
            let pix_data = get_pointer_position(event, this)
            inject_touch_event(pix_data, 1)
            $(this).off("mousemove", efficient_canvas_mouse_move)
        }
    })
    // 3.mouseout
    $(ele).on('mouseout', function (event) {
        if (window.touch_start) {
            window.touch_start = false
            let pix_data = get_pointer_position(event, this)
            inject_touch_event(pix_data, 1)
            $(this).off("mousemove", efficient_canvas_mouse_move)
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
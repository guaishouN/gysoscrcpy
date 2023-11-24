import asyncio
import json
import logging
import threading
from flask import Flask, render_template, request, send_file
from flask_socketio import SocketIO
from flask_cors import CORS, cross_origin
import config
import server_looper

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)
cors = CORS(app)
temp_device_id = "55fa3d4d"
logging.basicConfig(format='%(asctime)s.%(msecs)s:%(name)s:%(thread)d:%(levelname)s:%(process)d:%(message)s',
                    level=logging.INFO)
logging.getLogger("asyncio").setLevel(logging.INFO)
server_looper.init(socketio)


@app.route('/')
def screen_copy():
    return render_template('gysoscrcpy.html')


@app.route('/getDevices')
def get_devices():
    return json.dumps(config.DEFAULT_CONTROL_INFO)


@app.route('/device/control/<device_id>/<command>')
def device_control(device_id, command):
    logging.info(f"device control on [{device_id}]command[{command}]")
    return json.dumps(config.DEFAULT_CONTROL_INFO)


@app.route('/getCtrlInfo/<device_id>')
def get_control_info(device_id):
    print("*************get_control_info" + str(threading.current_thread()))
    return json.dumps(config.DEFAULT_CONTROL_INFO)


@socketio.on('connect')
def handle_connect():
    print('Client connected')


@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')


@socketio.on('device_control')
def handle_device_control(data):
    print('handle_device_control:', data)


@socketio.on('scr_event')
def handle_screen_event(data):
    global temp_device_id
    print(f'handle_screen_event:{data} temp_device_id {temp_device_id} ')
    server_looper.receive(temp_device_id, data)

# async def hh():
#     print("*********************************wertyui8" + str(threading.current_thread()))
#     count = 0
#     while True:
#         count = count + 1
#         print("count=" + str(count) + "    " + str(threading.current_thread()))
#         await asyncio.sleep(5)
#
#
# def sub_main():
#     loop = asyncio.new_event_loop()
#     asyncio.set_event_loop(loop)
#     loop.run_until_complete(hh())
#
#
# print("*********************************8" + str(threading.current_thread()))
# execdfg = ThreadPoolExecutor(max_workers=3)
# loop = asyncio.get_event_loop()
# loop.run_in_executor(execdfg, sub_main)
#
# if __name__ == '__main__':
#     socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)

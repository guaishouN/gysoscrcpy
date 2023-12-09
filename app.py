import json
import logging
from flask import Flask, render_template, request, send_file
from flask_socketio import SocketIO, join_room, leave_room
from flask_cors import CORS, cross_origin
import config
import server_looper

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", logger=False, engineio_logger=False)
cors = CORS(app)
room_device_dict = dict()
logging.basicConfig(format='%(asctime)s.%(msecs)s:%(name)s:%(thread)d:%(levelname)s:%(process)d:%(message)s',
                    level=logging.ERROR)
logging.getLogger("asyncio").setLevel(logging.ERROR)
# Disable Werkzeug logs
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
# Disable Flask logs
app.logger.setLevel(logging.ERROR)
server_looper.init(socketio)


@app.route('/')
def screen_copy():
    return render_template('gysoscrcpy.html')


@app.route('/getAdbDevicesList')
def get_adb_devices_list():
    return json.dumps({"devices": list(server_looper.get_adb_devices_list())})


@app.route('/device/control/<device_id>/<command>')
def device_control(device_id, command):
    return json.dumps(config.DEFAULT_CONTROL_INFO)


@app.route('/getCtrlInfo/<device_id>')
def get_control_info(device_id):
    return json.dumps(config.DEFAULT_CONTROL_INFO)


@socketio.on('connect')
def handle_connect():
    sid = request.sid
    logging.info(f'Client connected {sid}')


@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    logging.info(f'Client disconnected {sid}')
    if sid in room_device_dict:
        leave_room(room_device_dict[sid])


@socketio.on('device_control')
def handle_device_control(data):
    logging.info(f'handle_device_control:{str(data)}')


@socketio.on('join_device')
def handle_join_room(data):
    join_device = data['device_id']
    sid = request.sid
    room_device_dict[sid] = join_device
    logging.info(f"join room ******************************** [{join_device}]{sid}")
    join_room(join_device)
    server_looper.join_device(sid, join_device)

@socketio.on('leave_device')
def handle_leave_room(data):
    leave_device = data['device_id']
    sid = request.sid
    logging.info(f"leave room ******************************** [{leave_device}]{sid}")
    leave_room(leave_device)


@socketio.on('device_event')
def handle_screen_event(data):
    logging.info(f'handle_screen_event:{data["msg"]} device_id {data["device_id"]} ')
    server_looper.receive(data["device_id"], data["msg"])

# if __name__ == '__main__':
#     socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)

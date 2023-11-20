import json

from flask import Flask, render_template, request, send_file
from flask_socketio import SocketIO
from flask_cors import CORS, cross_origin
import config

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
cors = CORS(app)


@app.route('/')
def screen_copy():
    return render_template('gysoscrcpy.html')


@app.route('/getCtrlInfo/<device_id>')
def get_control_info(device_id):
    print(f'get_control_info{device_id}')
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
    print('handle_screen_event:', data)


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)

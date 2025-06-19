# (C) 2025 Bismaya Jyoti Dalei All rights reserved.

from flask import Flask
from flask_socketio import SocketIO, emit
from flask_cors import CORS

app = Flask(__name__)
app.config['SECRET_KEY'] = 'test'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

@socketio.on('connect')
def test_connect():
    print('Client connected!')
    emit('connected', {'status': 'success'})

if __name__ == '__main__':
    socketio.run(app, host='127.0.0.1', port=5000, debug=True)
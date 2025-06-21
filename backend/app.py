# (C) 2025 Bismaya Jyoti Dalei All rights reserved.

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
from flask_cors import CORS
import uuid
import time
from datetime import datetime
from game_logic import GameManager
import json
import os

# Flask app configuration
app = Flask(__name__, static_folder='../frontend', static_url_path='/')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-fallback-secret-key-here')


socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
CORS(app)

game_manager = GameManager()

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/<path:filename>')
def static_files(filename):
    try:
        return app.send_static_file(filename)
    except:
        return app.send_static_file('index.html')

@app.route('/health')
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@socketio.on('connect')
def on_connect():
    print(f'Client connected: {request.sid}')
    emit('connected', {'client_id': request.sid})

@socketio.on('disconnect')
def on_disconnect():
    print(f'Client disconnected: {request.sid}')
    # Handle player leaving mid-game
    room_id = game_manager.player_disconnect(request.sid)
    if room_id:
        # Notify remaining players that the game session has ended
        emit('session_terminated', {
            'message': 'Game session terminated - opponent left the game',
            'reason': 'player_disconnect'
        }, room=room_id)

@socketio.on('create_room')
def handle_create_room(data):
    player_name = data.get('player_name', f'Player_{request.sid[:6]}')
    grid_size = data.get('grid_size', 3)
    room_id = str(uuid.uuid4())[:8].upper()
    
    success = game_manager.create_room(room_id, request.sid, player_name, grid_size)
    if success:
        join_room(room_id)
        game_state = game_manager.get_game_state(room_id)
        emit('room_created', {
            'room_id': room_id,
            'player_id': request.sid,
            'player_name': player_name,
            'symbol': 'X',
            'game_state': game_state
        })
    else:
        emit('error', {'message': 'Failed to create room'})

@socketio.on('join_room')
def handle_join_room(data):
    room_id = data.get('room_id')
    player_name = data.get('player_name', f'Player_{request.sid[:6]}')
    
    if not room_id:
        emit('error', {'message': 'Room ID required'})
        return
    
    print(f"Player {player_name} ({request.sid}) trying to join room {room_id}")
    
    result = game_manager.join_room(room_id, request.sid, player_name)
    if result['success']:
        join_room(room_id)
        
        # Get the current game state after joining
        current_game_state = game_manager.get_game_state(room_id)
        
        print(f"Game state after join: {current_game_state}")
        
        # Notify the joining player with updated game state
        emit('room_joined', {
            'room_id': room_id,
            'player_id': request.sid,
            'player_name': player_name,
            'symbol': result['symbol'],
            'opponent': result['opponent'],
            'game_state': current_game_state
        })
        
        # Notify existing player with updated game state
        emit('player_joined', {
            'player_name': player_name,
            'symbol': result['symbol'],
            'game_ready': True,
            'game_state': current_game_state
        }, room=room_id, include_self=False)
        
        # Start the game with the most current state
        emit('game_start', current_game_state, room=room_id)
        
        print(f"Successfully processed join for {player_name}")
    else:
        emit('error', {'message': result['message']})
        
@socketio.on('room_joined')
def handle_room_joined_update():
    # After a player joins, send updated player info to both players
    pass

@socketio.on('get_player_info')
def handle_get_player_info(data):
    room_id = data.get('room_id')
    
    if not room_id:
        emit('error', {'message': 'Room ID required'})
        return
    
    game = game_manager.games.get(room_id)
    if not game:
        emit('error', {'message': 'Room not found'})
        return
    
    # Send current player info
    players_info = []
    for player_id, player_data in game.players.items():
        players_info.append({
            'id': player_id,
            'name': player_data['name'],
            'symbol': player_data['symbol'],
            'online': True  # For now, assume online, I'll handle it later.
        })
    
    emit('player_info_update', {
        'players': players_info,
        'requesting_player': request.sid
    })

@socketio.on('make_move')
def handle_make_move(data):
    room_id = data.get('room_id')
    position = data.get('position')
    
    if not room_id or position is None:
        emit('error', {'message': 'Invalid move data'})
        return
    
    result = game_manager.make_move(room_id, request.sid, position)
    if result['success']:
        # Get the updated game state after the move
        updated_game_state = game_manager.get_game_state(room_id)
        
        # Broadcast the move to all players in the room
        emit('move_made', {
            'position': position,
            'symbol': result['symbol'],
            'player_name': result['player_name'],
            'board': result['board'],
            'current_turn': result['current_turn'],
            'game_state': updated_game_state
        }, room=room_id)
        
        # Check for game end
        if result.get('game_over'):
            emit('game_over', {
                'winner': result.get('winner'),
                'winner_name': result.get('winner_name'),
                'winning_line': result.get('winning_line'),
                'is_draw': result.get('is_draw', False),
                'final_board': result['board']
            }, room=room_id)
    else:
        emit('error', {'message': result['message']})

@socketio.on('restart_game')
def handle_restart_game(data):
    room_id = data.get('room_id')
    
    if not room_id:
        emit('error', {'message': 'Room ID required'})
        return
    
    result = game_manager.restart_game(room_id, request.sid)
    if result['success']:
        # Send the game_restarted event with symbol changes
        emit('game_restarted', {
            'game_state': result['game_state'],
            'symbol_changes': result.get('symbol_changes', {})
        }, room=room_id)
    else:
        emit('error', {'message': result['message']})

@socketio.on('chat_message')
def handle_chat_message(data):
    room_id = data.get('room_id')
    message = data.get('message', '').strip()
    reply_to = data.get('reply_to')
    
    if not room_id or not message:
        emit('error', {'message': 'Invalid chat message'})
        return
    
    # Get player info from game state
    game = game_manager.games.get(room_id)
    if not game or request.sid not in game.players:
        emit('error', {'message': 'Not in this room'})
        return
    
    player = game.players[request.sid]
    
    # Create message data
    message_data = {
        'message_id': str(uuid.uuid4()),
        'player_id': request.sid,
        'player_name': player['name'],
        'message': message,
        'timestamp': time.time(),
        'type': data.get('type', 'text')
    }
    
    # Add reply data if present
    if reply_to:
        message_data['reply_to'] = reply_to
    
    # Broadcast the message to all players in the room
    emit('chat_message', message_data, room=room_id)

@socketio.on('typing')
def handle_typing(data):
    room_id = data.get('room_id')
    
    if not room_id:
        return
    
    # Get player info from game state
    game = game_manager.games.get(room_id)
    if not game or request.sid not in game.players:
        return
    
    player = game.players[request.sid]
    
    # Notify other players that this player is typing
    emit('player_typing', {
        'player_id': request.sid,
        'player_name': player['name']
    }, room=room_id, include_self=False)

@socketio.on('stop_typing')
def handle_stop_typing(data):
    room_id = data.get('room_id')
    
    if not room_id:
        return
    
    # Notify other players that this player stopped typing
    emit('player_stopped_typing', {
        'player_id': request.sid
    }, room=room_id, include_self=False)

@socketio.on('get_rooms')
def handle_get_rooms():
    rooms_list = game_manager.get_available_rooms()
    emit('rooms_list', {'rooms': rooms_list})

@socketio.on('leave_room')
def handle_leave_room(data):
    room_id = data.get('room_id')
    if room_id:
        leave_room(room_id)
        
        # Terminate the game session
        terminated_room = game_manager.player_disconnect(request.sid)
        if terminated_room:
            # Notify any remaining players that the session is terminated
            emit('session_terminated', {
                'message': 'Game session terminated - opponent left the game',
                'reason': 'player_leave'
            }, room=room_id)
        
        # Confirm to the leaving player that they've left successfully
        emit('left_room', {'room_id': room_id})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True)
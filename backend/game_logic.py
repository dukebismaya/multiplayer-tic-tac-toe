# (C) 2025 Bismaya Jyoti Dalei All rights reserved.

import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import math

class Game:
    def __init__(self, grid_size: int = 3):
        self.grid_size = grid_size
        self.board = ['' for _ in range(grid_size * grid_size)]
        self.current_turn = 'X'
        self.players = {}  # {player_id: {'name': str, 'symbol': str}}
        self.game_over = False
        self.winner = None
        self.winning_line = None
        self.is_draw = False
        self.created_at = time.time()
        self.last_move_at = time.time()
        self.host_id = None
        self.match_count = 0  # Track number of matches played
        self.original_player_order = []  # Store original player order
        
        # Scoring system
        self.session_scores = {}  # {player_id: {'wins': 0, 'losses': 0, 'draws': 0}}
        self.match_history = []  # List of match results
        
        self.room_settings = {
            'grid_size': grid_size,
            'win_condition': min(grid_size, 5) if grid_size > 3 else 3
        }
        
    def add_player(self, player_id: str, name: str, symbol: str):
        self.players[player_id] = {'name': name, 'symbol': symbol}
        
        # Initialize scoring for this player
        self.session_scores[player_id] = {
            'wins': 0,
            'losses': 0,
            'draws': 0,
            'total_matches': 0
        }
        
        if self.host_id is None:
            self.host_id = player_id
        
        # Store original player order for symbol swapping
        if len(self.original_player_order) < 2:
            self.original_player_order.append(player_id)
        
    def is_valid_move(self, position: int, player_id: str) -> bool:
        if self.game_over:
            return False
        if position < 0 or position >= len(self.board):
            return False
        if self.board[position] != '':
            return False
        if player_id not in self.players:
            return False
        if self.players[player_id]['symbol'] != self.current_turn:
            return False
        return True
    
    def make_move(self, position: int, player_id: str) -> bool:
        if not self.is_valid_move(position, player_id):
            return False
            
        symbol = self.players[player_id]['symbol']
        self.board[position] = symbol
        self.last_move_at = time.time()
        
        # Check for winner
        winner_result = self.check_winner()
        if winner_result:
            self.game_over = True
            self.winner = winner_result['symbol']
            self.winning_line = winner_result['line']
            self.update_scores(winner_symbol=self.winner)
        elif self.is_board_full():
            self.game_over = True
            self.is_draw = True
            self.update_scores(is_draw=True)
        else:
            # Switch turns
            self.current_turn = 'O' if self.current_turn == 'X' else 'X'
            
        return True
    
    def check_winner(self) -> Optional[Dict]:
        win_length = self.room_settings['win_condition']
        
        # Check all possible winning lines
        for start_pos in range(len(self.board)):
            # Skip empty positions
            if self.board[start_pos] == '':
                continue
                
            symbol = self.board[start_pos]
            row = start_pos // self.grid_size
            col = start_pos % self.grid_size
            
            # Check horizontal
            if col <= self.grid_size - win_length:
                line = []
                for i in range(win_length):
                    pos = row * self.grid_size + col + i
                    line.append(pos)
                    if self.board[pos] != symbol:
                        break
                else:
                    return {'symbol': symbol, 'line': line}
            
            # Check vertical
            if row <= self.grid_size - win_length:
                line = []
                for i in range(win_length):
                    pos = (row + i) * self.grid_size + col
                    line.append(pos)
                    if self.board[pos] != symbol:
                        break
                else:
                    return {'symbol': symbol, 'line': line}
            
            # Check diagonal (top-left to bottom-right)
            if row <= self.grid_size - win_length and col <= self.grid_size - win_length:
                line = []
                for i in range(win_length):
                    pos = (row + i) * self.grid_size + col + i
                    line.append(pos)
                    if self.board[pos] != symbol:
                        break
                else:
                    return {'symbol': symbol, 'line': line}
            
            # Check diagonal (top-right to bottom-left)
            if row <= self.grid_size - win_length and col >= win_length - 1:
                line = []
                for i in range(win_length):
                    pos = (row + i) * self.grid_size + col - i
                    line.append(pos)
                    if self.board[pos] != symbol:
                        break
                else:
                    return {'symbol': symbol, 'line': line}
        
        return None
    
    def is_board_full(self) -> bool:
        return '' not in self.board
    
    def reset(self):
        """Reset the game board and handle symbol swapping"""
        self.board = ['' for _ in range(self.grid_size * self.grid_size)]
        self.game_over = False
        self.winner = None
        self.winning_line = None
        self.is_draw = False
        self.last_move_at = time.time()
        self.match_count += 1
        
        # Swap symbols every match (after the first match)
        if self.match_count > 0 and len(self.original_player_order) == 2:
            self.swap_player_symbols()
        
        # X always starts first
        self.current_turn = 'X'
        
    def swap_player_symbols(self):
        """Swap X and O symbols between players"""
        player1_id = self.original_player_order[0]
        player2_id = self.original_player_order[1]
        
        # Get current symbols
        player1_symbol = self.players[player1_id]['symbol']
        player2_symbol = self.players[player2_id]['symbol']
        
        # Swap symbols
        self.players[player1_id]['symbol'] = player2_symbol
        self.players[player2_id]['symbol'] = player1_symbol
        
    def update_scores(self, winner_symbol: str = None, is_draw: bool = False):
        """Update session scores after a match"""
        for player_id, player_data in self.players.items():
            self.session_scores[player_id]['total_matches'] += 1
            
            if is_draw:
                self.session_scores[player_id]['draws'] += 1
            elif player_data['symbol'] == winner_symbol:
                self.session_scores[player_id]['wins'] += 1
            else:
                self.session_scores[player_id]['losses'] += 1
        
        # Add to match history
        match_result = {
            'match_number': self.match_count + 1,
            'winner_symbol': winner_symbol,
            'winner_name': None,
            'is_draw': is_draw,
            'timestamp': time.time()
        }
        
        if winner_symbol and not is_draw:
            winner_player = next((pid for pid, data in self.players.items() 
                                if data['symbol'] == winner_symbol), None)
            if winner_player:
                match_result['winner_name'] = self.players[winner_player]['name']
        
        self.match_history.append(match_result)
        
        # Keep only last 10 matches in history
        if len(self.match_history) > 10:
            self.match_history = self.match_history[-10:]
    
    def get_session_leader(self):
        """Get the player with the most wins"""
        if not self.session_scores:
            return None
            
        leader_id = max(self.session_scores.keys(), 
                       key=lambda pid: self.session_scores[pid]['wins'])
        
        leader_wins = self.session_scores[leader_id]['wins']
        
        # Check if there's a tie
        tied_players = [pid for pid in self.session_scores.keys() 
                       if self.session_scores[pid]['wins'] == leader_wins]
        
        if len(tied_players) > 1:
            return None  # It's a tie
        
        return {
            'player_id': leader_id,
            'player_name': self.players[leader_id]['name'],
            'wins': leader_wins
        }
    
    def get_state(self) -> Dict:
        players_with_ids = {}
        for player_id, player_data in self.players.items():
            players_with_ids[player_id] = {
                'id': player_id,
                'name': player_data['name'],
                'symbol': player_data['symbol']
            }
        
        return {
            'board': self.board,
            'current_turn': self.current_turn,
            'players': players_with_ids,
            'game_over': self.game_over,
            'winner': self.winner,
            'winning_line': self.winning_line,
            'is_draw': self.is_draw,
            'grid_size': self.grid_size,
            'match_count': self.match_count,
            'room_settings': self.room_settings,
            'session_scores': self.session_scores,
            'match_history': self.match_history,
            'session_leader': self.get_session_leader()
        }

class GameManager:
    def __init__(self):
        self.games: Dict[str, Game] = {}
        self.player_rooms: Dict[str, str] = {}  # {player_id: room_id}
        
    def create_room(self, room_id: str, player_id: str, player_name: str, grid_size: int = 3) -> bool:
        if room_id in self.games:
            return False
        
        # Validate grid size
        if grid_size < 3 or grid_size > 10:
            grid_size = 3
            
        game = Game(grid_size)
        game.add_player(player_id, player_name, 'X')
        self.games[room_id] = game
        self.player_rooms[player_id] = room_id
        return True
    
    def join_room(self, room_id: str, player_id: str, player_name: str) -> Dict:
        if room_id not in self.games:
            return {'success': False, 'message': 'Room not found'}
            
        game = self.games[room_id]
        if len(game.players) >= 2:
            return {'success': False, 'message': 'Room is full'}
            
        # Second player gets 'O'
        game.add_player(player_id, player_name, 'O')
        self.player_rooms[player_id] = room_id
        
        # Get opponent info
        opponent_id = [pid for pid in game.players.keys() if pid != player_id][0]
        opponent = game.players[opponent_id]
        
        return {
            'success': True,
            'symbol': 'O',
            'opponent': opponent,
            'game_state': game.get_state()
        }
    
    def make_move(self, room_id: str, player_id: str, position: int) -> Dict:
        if room_id not in self.games:
            return {'success': False, 'message': 'Room not found'}
            
        game = self.games[room_id]
        if not game.make_move(position, player_id):
            return {'success': False, 'message': 'Invalid move'}
        
        result = {
            'success': True,
            'symbol': game.players[player_id]['symbol'],
            'player_name': game.players[player_id]['name'],
            'board': game.board,
            'current_turn': game.current_turn,
            'game_over': game.game_over
        }
        
        if game.game_over:
            if game.winner:
                winner_id = [pid for pid, player in game.players.items() 
                           if player['symbol'] == game.winner][0]
                result.update({
                    'winner': game.winner,
                    'winner_name': game.players[winner_id]['name'],
                    'winning_line': game.winning_line
                })
            else:
                result['is_draw'] = True
                
        return result
    
    def restart_game(self, room_id: str, player_id: str) -> Dict:
        if room_id not in self.games:
            return {'success': False, 'message': 'Room not found'}
        
        game = self.games[room_id]
        
        # Only allow host or players in the game to restart
        if player_id not in game.players:
            return {'success': False, 'message': 'You are not in this game'}
        
        # Store symbol swap info before reset
        old_symbols = {pid: pdata['symbol'] for pid, pdata in game.players.items()}
        
        game.reset()
        
        # Get new symbols after reset (which includes swapping)
        new_symbols = {pid: pdata['symbol'] for pid, pdata in game.players.items()}
        
        return {
            'success': True, 
            'game_state': game.get_state(),
            'symbol_changes': {
                pid: {'old': old_symbols[pid], 'new': new_symbols[pid]} 
                for pid in game.players.keys()
            }
        }
    
    def get_game_state(self, room_id: str) -> Optional[Dict]:
        if room_id not in self.games:
            return None
        return self.games[room_id].get_state()
    
    def get_player_room(self, player_id: str) -> Optional[str]:
        return self.player_rooms.get(player_id)
    
    def player_disconnect(self, player_id: str) -> Optional[str]:
        room_id = self.player_rooms.get(player_id)
        if not room_id:
            return None
            
        if player_id in self.player_rooms:
            del self.player_rooms[player_id]
        
        if room_id in self.games:
            game = self.games[room_id]
            if player_id in game.players:
                del game.players[player_id]
                
            # clean up room when a player disconnects
            del self.games[room_id]
            
            # Remove remaining player from room mapping
            remaining_players = [pid for pid in self.player_rooms.keys() 
                               if self.player_rooms[pid] == room_id]
            for pid in remaining_players:
                del self.player_rooms[pid]
                
        return room_id
    
    def get_available_rooms(self) -> List[Dict]:
        available_rooms = []
        for room_id, game in self.games.items():
            if len(game.players) == 1:  # Room has space for one more player
                player = list(game.players.values())[0]
                available_rooms.append({
                    'room_id': room_id,
                    'host_name': player['name'],
                    'grid_size': game.grid_size,
                    'created_at': game.created_at
                })
        return available_rooms
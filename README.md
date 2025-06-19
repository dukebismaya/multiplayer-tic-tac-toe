### Full-Stack Multiplayer Tic Tac Toe Game ✘ Ｏ

## 📁 Project Structure

```
multiplayer-tic-tac-toe
├── backend
│   ├── app.py               # Main entry point for the Flask application
│   ├── game_logic.py        # Contains game logic for Tic Tac Toe
│   ├── requirements.txt     # Python dependencies for the backend
│   └── runtime.txt          # Specifies Python version for hosting
├── frontend
│   ├── index.html           # Main HTML file for the frontend
│   ├── style.css            # CSS styles for the frontend
│   ├── script.js            # JavaScript code for game interaction
│   └── assets
│       ├──icon
│       └──sfx
├── package.json             # Configuration file for npm
└── README.md                # Documentation for the project
```

## 🚀 Getting Started

### Prerequisites
- Python 3.x
- Node.js and npm

### Backend Setup
1. Navigate to the `backend` directory.
2. Install the required Python packages:
   ```
   pip install -r requirements.txt
   ```
3. Run the Flask application:
   ```
   python app.py
   ```

### Frontend Setup
1. Navigate to the `frontend` directory.
2. Open `index.html` in a web browser to start playing the game or use `npm start`

## 🎮 Game Rules
- The game is played on a custom square(3 X 3, 4 X 4, 5 X 5, etc) grid.
- Players take turns placing their marks (X or O) in empty squares.
- For 3 x 3 grid the first player to align three marks horizontally, vertically, or diagonally wins.
- If all squares are filled without a winner, the game ends in a draw.

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## 📄 License
This project is licensed under the MIT (License) [LICENSE]. See the LICENSE file for details.
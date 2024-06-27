import { Player } from "./game.js";

export class BoardView {
  constructor(board, cells, player, message, size) {
    this.board = board;
    this.cells = cells;
    this.player = player;
    this.msg = message;
    this.size = size;
  }

  reset(callback) {
    this.board.replaceChildren();
    this.msg.innerHTML = "&nbsp;";
    this.player[0].textContent = 0;
    this.player[1].textContent = 0;
    this.draw(callback);
  }

  draw(callback) {
    [...Array(this.size)].forEach((_, idx) => {
      let cell = document.createElement("div");
      cell.classList.add("cell");
      if (idx == Math.floor(this.size / 2)) {
        cell.classList.add("neutral");
      }
      cell.addEventListener("click", () => callback(idx));
      this.board.appendChild(cell);
    });
  }

  placeStone(player, idx) {
    var player_class = player == Player.Player1 ? "player1" : "player2";
    const CELL = this.cells.item(idx);
    CELL.classList.add(player_class);
    CELL.classList.add("place");
  }

  markEye(player, idxs) {
    var player_class = player == Player.Player1 ? "player1" : "player2";
    idxs.map((cell_idx) => {
      const CELL = this.cells.item(cell_idx);
      CELL.classList.add(player_class);
      CELL.classList.add("house");
    });
  }

  markDead(player, idxs) {
    var player_class = player == Player.Player1 ? "player1" : "player2";
    idxs.map((cell_idx) => {
      this.cells.item(cell_idx).textContent = "X";
    });
  }

  updateTurn(player) {
    this.player[player].turn.style.border = "4px solid black";
    this.player[Player.next(player)].turn.style.border = "4px solid white";
  }

  updateScore(scores) {
    scores.map((score, player) => (this.player[player].score.textContent = score));
  }

  updateReady(ready_state) {
    ready_state.map((ready, player) => {
      this.player[player].turn.style.border = "4px solid black";
      this.player[player].turn.style.backgroundColor = ready ? "black" : "white";
    });
  }

  updateLastPoint(past, present) {
    if (past != null) this.cells.item(past.getIndex()).textContent = "";
    this.cells.item(present.getIndex()).textContent = "O";
  }

  setPlayerColor(colors) {
    colors.map((color, player) => (this.player[player].turn.style.backgroundColor = color));
  }

  printMessage(msg) {
    this.msg.textContent = msg;
  }
}

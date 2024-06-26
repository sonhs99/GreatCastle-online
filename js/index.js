import { Player, GameResult, Point, Board } from "./game.js";
import { createRoom, joinRoom, send, register, leave, isCaller, isConnected } from "./p2p.js";

export const Event = {
  READY: 0,
  TOSS: 1,
  PLACE: 2,
  PASS: 3,
  END: 4,
  MESSAGE: 5,
  DEBUG: 6,
  ERROR: 7,
};

Object.freeze(Event);

const BOARD_SIZE = 9;
let player = Player.Player1;
let start_player = null;
let board = new Board(BOARD_SIZE);
board.end = true;
let ready_count = [false, false];
let rtc_queue = [];

let boardCells = document.getElementsByClassName("cell");

export function hash(data) {
  return data.reduce((s, x, i) => s * 180 + x * i);
}

function get() {
  const until = (resolve) => {
    if (rtc_queue.length == 0) setTimeout((_) => until(resolve), 100);
    else resolve(rtc_queue.shift());
  };
  return new Promise(until);
}

function resetBoard() {
  player = start_player;
  board = new Board(BOARD_SIZE);
  document.getElementById("board").replaceChildren();
  document.getElementById("message").innerHTML = "&nbsp;";
  document.getElementById("player1-score").textContent = 0;
  document.getElementById("player2-score").textContent = 0;
  drawBoard();
}

function drawBoard() {
  const BOARD = document.getElementById("board");
  [...Array(board.numOfCell)].forEach((_, idx) => {
    let cell = document.createElement("div");
    cell.classList.add("cell");
    if (idx == Math.floor(board.numOfCell / 2)) {
      cell.classList.add("neutral");
    }
    cell.addEventListener("click", () => clickCell(Math.floor(idx / board.size), idx % board.size));
    BOARD.appendChild(cell);
  });
}

function placeStone(point) {
  var PLAYER_CLASS = "";
  if (player == Player.Player1) {
    PLAYER_CLASS = "player1";
  } else if (player == Player.Player2) {
    PLAYER_CLASS = "player2";
  }
  boardCells.item(point.getIndex()).classList.add(PLAYER_CLASS);
  boardCells.item(point.getIndex()).classList.add("place");

  const RESULT = board.placeStone(point, player);

  if (RESULT.result == GameResult.KILLED) {
    RESULT.remove.map((idx) => (boardCells.item(idx).textContent = "X"));
    RESULT.eyes.map((idx) => {
      boardCells.item(idx).classList.add(PLAYER_CLASS);
      boardCells.item(idx).classList.add("house");
    });
    document.getElementById(PLAYER_CLASS + "-score").textContent = board.score[player];
    console.log("[EVENT] Dead Stone", RESULT.remove);
    showResult(RESULT.winner, RESULT.score, RESULT.eyes);
  } else if (RESULT.result == GameResult.PLACED) {
    console.log("[EVENT] Eyes", RESULT.eyes);
    RESULT.eyes.map((idx) => {
      boardCells.item(idx).classList.add(PLAYER_CLASS);
      boardCells.item(idx).classList.add("house");
    });
    document.getElementById(PLAYER_CLASS + "-score").textContent = board.score[player];

    player = Player.next(player);
    updateTurn();
  }
}

function clickCell(x, y) {
  const POINT = new Point(x, y, board.size);
  console.log("[EVENT] Click", [x, y, POINT.getIndex()]);
  if (board.isEnd() || player != Player.Player1 || ready_count[0] + ready_count[1] != 2) return;
  if (board.isPlaceable(POINT)) {
    send({ event: Event.PLACE, x: x, y: y });
    placeStone(POINT);
  }
}

function passTurn() {
  if (board.isEnd() || player != Player.Player1) return;
  send({ event: Event.PASS });
  player = Player.next(player);
  const RESULT = board.pass();
  if (RESULT.result == GameResult.CALCED) {
    console.log(RESULT.score);
    showResult(RESULT.winner, 0, RESULT.score);
  } else {
    updateTurn();
  }
}

function updateTurn() {
  if (player == Player.Player1) {
    document.getElementById("player1-turn").style.border = "2px solid black";
    document.getElementById("player2-turn").style.border = "none";
  } else {
    document.getElementById("player1-turn").style.border = "none";
    document.getElementById("player2-turn").style.border = "2px solid black";
  }
}

function showResult(player, kill, lead) {
  var msg = document.getElementById("message");
  if (kill != 0) msg.textContent = "[Player " + (1 + player) + "]이(가) 성 " + kill + "개를 부쉈습니다!";
  else msg.textContent = "[Player " + (1 + player) + "]이(가) 성 " + lead + "개 차이로 이겼습니다!";
  ready_count = [false, false];
}

async function create_room() {
  if (isConnected()) return;
  const ROOM_ID = await createRoom();
  document.getElementById("room-name").value = ROOM_ID;
}

async function join_room() {
  if (isConnected()) return;
  const ROOM_ID = document.getElementById("join-name").value;
  await joinRoom(ROOM_ID);
}

function leaveRoom() {
  leave();
}

async function toss() {
  console.log("[TOSS] Coin-Toss Protocol start");
  if (isCaller()) {
    const number = Math.floor(Math.random() * 255);
    const hashed = hash([number, number, number, number, number, number, number, number, number, number]);
    const truth = number % 2 != 0;
    console.log("[TOSS] x:", number);
    console.log("[TOSS] hash x:", hashed);
    send({ event: Event.TOSS, value: hashed });
    const guess = await get();
    send({ event: Event.TOSS, value: number });
    const result = await get();
    if (!result) console.log("[TOSS] Protocol has failed!");
    else {
      console.log("[TOSS] Result:", truth != guess);
      if (truth != guess) {
        start_player = Player.Player1;
      } else {
        start_player = Player.Player2;
      }
    }
  } else {
    const hashed = await get();
    console.log("[TOSS] hash x:", hashed);
    const guess = Math.floor(Math.random() * 255) % 2 != 0;
    send({ event: Event.TOSS, value: guess });
    const number = await get();
    console.log("[TOSS] x:", number);
    const result = hash([number, number, number, number, number, number, number, number, number, number]) == hashed;
    send({ event: Event.TOSS, value: result });
    if (!result) console.log("[TOSS] Protocol has failed");
    else {
      const truth = number % 2 != 0;
      console.log("[TOSS] Result:", truth == guess);
      if (truth == guess) {
        start_player = Player.Player1;
      } else {
        start_player = Player.Player2;
      }
    }
  }
  resetBoard();
  board.setStartPlayer(start_player);
  document.getElementById("player1-score").textContent = board.score[Player.Player1];
  document.getElementById("player2-score").textContent = board.score[Player.Player2];
  document.getElementById("player1-turn").style.backgroundColor = "blue";
  document.getElementById("player2-turn").style.backgroundColor = "red";
  updateTurn();
}

function ready() {
  if (!isConnected() || !board.isEnd() || ready_count[0]) return;
  console.log(ready_count);
  ready_count[0] = true;
  document.getElementById("player1-turn").style.border = "2px solid black";
  document.getElementById("player1-turn").style.backgroundColor = "black";
  if (!ready_count[1]) {
    document.getElementById("player2-turn").style.border = "2px solid black";
    document.getElementById("player2-turn").style.backgroundColor = "white";
  }
  send({ event: Event.READY });
  if (ready_count[0] + ready_count[1] == 2) {
    toss();
  }
}

drawBoard();
register((event) => {
  const data = JSON.parse(event.data);
  switch (data.event) {
    case Event.READY:
      if (!board.isEnd() || ready_count[1]) break;
      ready_count[1] = true;
      document.getElementById("player2-turn").style.border = "2px solid black";
      document.getElementById("player2-turn").style.backgroundColor = "black";
      if (!ready_count[0]) {
        document.getElementById("player1-turn").style.border = "2px solid black";
        document.getElementById("player1-turn").style.backgroundColor = "white";
      }
      if (ready_count[0] + ready_count[1] == 2) {
        toss();
      }
      break;

    case Event.PLACE:
      console.log("[RTC] PLACE:", [data.x, data.y]);
      const POINT = new Point(data.x, data.y, board.size);
      placeStone(POINT);
      break;

    case Event.PASS:
      player = Player.next(player);
      const RESULT = board.pass();
      if (RESULT.result == GameResult.CALCED) {
        console.log(RESULT.score);
        showResult(RESULT.winner, 0, RESULT.score);
      } else {
        updateTurn();
      }
      break;

    case Event.DEBUG:
      console.log("[RTC] DEBUG:", data.msg);
      break;

    case Event.ERROR:
      console.log("[RTC] ERROR:", data.msg);
      break;

    case Event.TOSS:
      console.log("[RTC] GET:", data.value);
      rtc_queue.push(data.value);
  }
});

document.getElementById("leave").addEventListener("click", leaveRoom);
document.getElementById("ready").addEventListener("click", ready);
document.getElementById("pass").addEventListener("click", passTurn);
document.getElementById("room").addEventListener("click", create_room);
document.getElementById("join").addEventListener("click", join_room);

import { Player, GameResult, Point, Board } from "./game.js";
import { createRoom, joinRoom, send, register, leave, isCaller, isConnected } from "./p2p.js";
import { BoardView } from "./view.js";

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
let ready_count = [false, false];
let rtc_queue = [];
let last_point = null;

let board = new Board(BOARD_SIZE);
board.end = true;
let board_view = new BoardView(
  document.getElementById("board"),
  document.getElementsByClassName("cell"),
  [
    {
      turn: document.getElementById("player1-turn"),
      score: document.getElementById("player1-score"),
    },
    {
      turn: document.getElementById("player2-turn"),
      score: document.getElementById("player2-score"),
    },
  ],
  document.getElementById("message"),
  board.numOfCell
);

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
  last_point = null;
  board = new Board(BOARD_SIZE);
  board_view.reset(clickCell);
}

function placeStone(point) {
  board_view.placeStone(player, point.getIndex());
  board_view.updateLastPoint(last_point, point);
  const RESULT = board.placeStone(point, player);

  board_view.markEye(player, RESULT.eyes);
  board_view.updateScore(board.score);
  console.log("[EVENT] Eyes", RESULT.eyes);

  if (RESULT.result == GameResult.KILLED) {
    board_view.markDead(player, RESULT.remove);
    console.log("[EVENT] Dead Stone", RESULT.remove);
    showResult(RESULT.winner, RESULT.score, RESULT.eyes);
  } else if (RESULT.result == GameResult.PLACED) {
    player = Player.next(player);
    board_view.updateTurn(player);
    last_point = point;
  }
}

function clickCell(idx) {
  const POINT = Point.fromIndex(idx, board.size);
  console.log("[EVENT] Click", [POINT.x, POINT.y, idx]);
  if (board.isEnd() || player != Player.Player1 || ready_count[0] + ready_count[1] != 2) return;
  if (board.isPlaceable(POINT)) {
    send({ event: Event.PLACE, x: POINT.x, y: POINT.y });
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
    board_view.updateTurn(player);
  }
}

function showResult(player, kill, lead) {
  if (kill != 0) board_view.printMessage("[Player " + (1 + player) + "]이(가) 성 " + kill + "개를 부쉈습니다!");
  else board_view.printMessage("[Player " + (1 + player) + "]이(가) 성 " + lead + "개 차이로 이겼습니다!");
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
  board_view.updateScore(board.score);
  board_view.setPlayerColor(["blue", "red"]);
  board_view.updateTurn(player);
  board.setStartPlayer(start_player);
}

function ready() {
  console.log(!isConnected(), !board.isEnd(), ready_count[0]);
  if (!isConnected() || !board.isEnd() || ready_count[0]) return;
  console.log(ready_count);
  ready_count[0] = true;
  board_view.updateReady(ready_count);
  send({ event: Event.READY });
  if (ready_count[0] + ready_count[1] == 2) {
    toss();
  }
}

register((event) => {
  const data = JSON.parse(event.data);
  switch (data.event) {
    case Event.READY:
      if (!board.isEnd() || ready_count[1]) break;
      ready_count[1] = true;
      board_view.updateReady(ready_count);
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
        board_view.updateTurn(player);
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

board_view.reset();

document.getElementById("leave").addEventListener("click", leaveRoom);
document.getElementById("ready").addEventListener("click", ready);
document.getElementById("pass").addEventListener("click", passTurn);
document.getElementById("room").addEventListener("click", create_room);
document.getElementById("join").addEventListener("click", join_room);

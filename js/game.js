const Stone = {
  EMPTY: 0,
  PLAYER1: 1,
  PLAYER2: 2,
  NEUTRAL: 3,
  PLAYER1_EYE: 4,
  PLAEYR2_EYE: 5,
  getStone: function (player) {
    return player + 1;
  },
  getEye: function (player) {
    return player + 4;
  },
};

export const GameResult = {
  PASSED: 0,
  PLACED: 1,
  CALCED: 2,
  KILLED: 3,
};

export const Player = {
  Player1: 0,
  Player2: 1,
  next: function (player) {
    if (player == Player.Player1) return Player.Player2;
    else return Player.Player1;
  },
};

Object.freeze(Stone);
Object.freeze(GameResult);
Object.freeze(Player);

export class Point {
  constructor(x, y, boardSize) {
    this.x = x;
    this.y = y;
    this.size = boardSize;
  }

  static fromIndex(idx, boardSize) {
    return new Point(Math.floor(idx / boardSize), idx % boardSize, boardSize);
  }

  getIndex() {
    return this.x * this.size + this.y;
  }

  isPlaceable() {
    return this.x >= 0 && this.x < this.size && this.y >= 0 && this.y < this.size;
  }

  neighbor(board) {
    return [
      [this.x - 1, this.y],
      [this.x + 1, this.y],
      [this.x, this.y + 1],
      [this.x, this.y - 1],
    ]
      .map((point) => new Point(point[0], point[1], this.size))
      .filter((point) => point.isPlaceable());
  }
}

class GoString {
  constructor(stone, liberty) {
    this.stone = new Set(stone);
    this.liberty = new Set(liberty);
  }

  removeLiberty(pos) {
    this.liberty.delete(pos);
  }

  isDead() {
    return this.liberty.size == 0;
  }
}

export class Board {
  constructor(size) {
    this.size = size;
    this.numOfCell = size * size;
    this.board = Array.from({ length: this.numOfCell }, () => Stone.EMPTY);
    this.go_string = new Set();
    this.score = [0, 0];
    this.end = false;
    this.passCount = false;

    this.board[Math.floor(this.numOfCell / 2)] = Stone.NEUTRAL;
  }

  isEnd() {
    return this.end;
  }

  isPlaceable(point) {
    const INDEX = point.getIndex();
    return point.isPlaceable() && this.board[INDEX] == Stone.EMPTY;
  }

  placeStone(point, player) {
    const STONE_IDX = point.getIndex();
    this.board[STONE_IDX] = Stone.getStone(player);
    var [removal, eyes] = this.calculateBoard(point, player);
    this.score[player] += eyes.length;

    if (removal.length != 0) {
      this.end = true;
      return {
        result: GameResult.KILLED,
        winner: player,
        score: removal.length,
        remove: removal,
        eyes: eyes,
      };
    } else {
      this.passCount = false;
      return {
        result: GameResult.PLACED,
        pass: false,
        eyes: eyes,
      };
    }
  }

  pass() {
    if (this.passCount) {
      this.end = true;
      return {
        result: GameResult.CALCED,
        winner: this.score[Player.Player1] < this.score[Player.Player2] + 3 ? Player.Player2 : Player.Player1,
        score: Math.abs(this.score[1] - this.score[0] + 3),
      };
    } else {
      this.passCount = true;
      return {
        result: GameResult.PASSED,
      };
    }
  }

  calculateBoard(point, player) {
    const POINT_IDX = point.getIndex();

    var merge = [];
    var liberty = [];

    var attack = [];
    var removal = [];

    var eye = [];

    for (var p of point.neighbor(this)) {
      const IDX = p.getIndex();
      if (this.board[IDX] == Stone.EMPTY) {
        liberty.push(IDX);
        var house = this.calculateEye(p, player);
        for (var pos of house) {
          const POS_IDX = pos.getIndex();
          this.board[POS_IDX] = Stone.getEye(player);
          eye.push(POS_IDX);
        }
      } else if (this.board[IDX] == Stone.getStone(player)) {
        for (var entry of this.go_string) {
          if (entry.stone.has(IDX)) {
            merge.push(entry);
            entry.liberty.delete(POINT_IDX);
          }
        }
      } else if (this.board[IDX] == Stone.getStone(Player.next(player))) {
        for (var entry of this.go_string) {
          if (entry.stone.has(IDX)) {
            attack.push(entry);
            entry.liberty.delete(POINT_IDX);
          }
        }
      }
    }

    for (const s of attack) {
      if (s.isDead()) {
        removal.push(...s.stone);
      }
    }

    var stone = [point.getIndex()];
    for (const s of merge) {
      stone.push(...s.stone);
      liberty.push(...s.liberty);
      this.go_string.delete(s);
    }
    const merged = new GoString(stone, liberty);
    this.go_string.add(merged);

    return [removal, eye];
  }

  calculateEye(start, player) {
    var mark = Array.from({ length: this.numOfCell }, () => false);
    var candidate = [start];
    var hit = [false, false, false, false];
    var house = [];
    while (candidate.length != 0) {
      const pos = candidate.pop();
      const POS_IDX = pos.getIndex();
      if (mark[POS_IDX]) continue;
      mark[POS_IDX] = true;
      if (this.board[POS_IDX] == Stone.EMPTY) {
        for (const n of pos.neighbor(this)) {
          const NEI_IDX = n.getIndex();
          if (!mark[NEI_IDX]) {
            candidate.push(n);
          }
        }
        hit[0] = hit[0] | (pos.x == 0);
        hit[1] = hit[1] | (pos.x == this.size - 1);
        hit[2] = hit[2] | (pos.y == 0);
        hit[3] = hit[3] | (pos.y == this.size - 1);
        if (hit.reduce((sum, value) => sum + value, 0) == 4) {
          return [];
        }
        house.push(pos);
      } else if (this.board[POS_IDX] == Stone.getStone(Player.next(player))) {
        return [];
      }
    }
    return house;
  }
}

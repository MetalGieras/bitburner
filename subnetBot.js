/** @param {NS} ns **/
export async function main(ns) {
  ns.tail(); ns.resizeTail(700, 900);
  ns.print("Player bot started.");

  const maxRetries = 100;  // Set a maximum number of retries to prevent infinite loops
  let retryCount = 0;

  while (true) {
    let result, x, y;
    let board = ns.go.getBoardState();
    if (!validateBoardState(board, ns)) {
      ns.print("Error: Invalid board state.");
      return;
    }
    let validMoves = ns.go.analysis.getValidMoves();

    if (!validMoves || validMoves.length === 0 || !Array.isArray(validMoves[0])) {
      ns.print("Error: validMoves is undefined or not properly initialized. Retrying...");
      await ns.sleep(1000);
      continue;
    }

    ns.print("Board and valid moves successfully initialized.");
    ns.print("Valid Moves: " + JSON.stringify(validMoves));

    const hasValidMove = validMoves.some(row => row.some(move => move === true));
    if (!hasValidMove) {
      ns.print("No valid moves available. Passing turn.");
      result = await ns.go.passTurn();
      if (result?.type === "gameOver") {
        ns.print("Game over. Exiting player bot.");
        return;
      }
      await ns.go.opponentNextTurn();
      await ns.sleep(200);
      retryCount++;
      if (retryCount >= maxRetries) {
        ns.print("Max retries reached. Exiting player bot.");
        return;
      }
      continue;
    }

    retryCount = 0;  // Reset retry count when a valid move is found

    do {
      const bestMove = getBestMove(board, validMoves, ns);

      if (!bestMove || bestMove.length < 2) {
        ns.print("Error: Could not determine a valid move. Retrying...");
        await ns.sleep(1000);
        break;
      }

      x = bestMove[0];
      y = bestMove[1];

      ns.print(`Making move at (${x}, ${y})`);

      if (x === undefined || y === undefined) {
        ns.print("No valid move found. Passing turn.");
        result = await ns.go.passTurn();
      } else {
        result = await ns.go.makeMove(x, y);
      }

      if (result?.type === "gameOver") {
        ns.print("Game over detected. Exiting player bot.");
        return;
      }
      await ns.go.opponentNextTurn();
      await ns.sleep(200);
      board = ns.go.getBoardState();
      if (!validateBoardState(board, ns)) {
        ns.print("Error: Invalid board state after move.");
        return;
      }
      validMoves = ns.go.analysis.getValidMoves();
    } while (result?.type !== "gameOver");

    if (result?.type === "gameOver") {
      ns.print("Game over detected in loop. Exiting player bot.");
      return;
    }
  }
}

function validateBoardState(board, ns) {
  const isValid = Array.isArray(board) && board.every(row => typeof row === 'string' && row.length > 0);
  ns.print("Debug: Validating board state: " + JSON.stringify(board) + " isValid: " + isValid);
  return isValid;
}

function getBestMove(board, validMoves, ns) {
  const strategies = [analyzeCaptureMoves, analyzeExpansionMoves, analyzeDefensiveMoves, getRandomMove];
  for (const strategy of strategies) {
    const moves = strategy(board, validMoves, ns);
    if (moves.length > 0) return moves[Math.floor(Math.random() * moves.length)];
  }
  return [undefined, undefined];
}

function getRandomMove(board, validMoves) {
  const moveOptions = [];
  const size = board.length;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (validMoves[x]?.[y]) moveOptions.push([x, y]);
    }
  }
  return moveOptions[Math.floor(Math.random() * moveOptions.length)] || [undefined, undefined];
}

function analyzeCaptureMoves(board, validMoves, ns) {
  const captureMoves = [];
  const size = board.length;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (validMoves[x]?.[y] && isCaptureMove(board, x, y, ns)) captureMoves.push([x, y]);
    }
  }
  return captureMoves;
}

function isCaptureMove(board, x, y, ns) {
  const opponent = 'O';
  const size = board.length;

  ns.print("Debug: Checking capture move on board: " + JSON.stringify(board));
  if (!validateBoardState(board, ns)) {
    ns.print("Error: Invalid board state in isCaptureMove.");
    return false;
  }

  const isValidCoordinate = (x, y) => x >= 0 && x < size && y >= 0 && y < size;

  const libertiesCheck = (x, y) => {
    if (!isValidCoordinate(x, y)) return false;
    if (ns.go.analysis.getLiberties(x, y) === 1) {
      return true;
    }
    return false;
  };

  const result = (
    (board[x - 1]?.[y] === opponent && libertiesCheck(x - 1, y)) ||
    (board[x + 1]?.[y] === opponent && libertiesCheck(x + 1, y)) ||
    (board[x]?.[y - 1] === opponent && libertiesCheck(x, y - 1)) ||
    (board[x]?.[y + 1] === opponent && libertiesCheck(x, y + 1))
  );

  ns.print("Debug: Result of isCaptureMove: " + result);
  return result;
}

function analyzeExpansionMoves(board, validMoves) {
  const expansionMoves = [];
  const size = board.length;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (validMoves[x]?.[y] && (x % 2 === 1 || y % 2 === 1) && isAdjacentToOurPieces(board, x, y)) {
        expansionMoves.push([x, y]);
      }
    }
  }
  return expansionMoves;
}

function analyzeDefensiveMoves(board, validMoves, ns) {
  const defensiveMoves = [];
  const size = board.length;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (validMoves[x]?.[y] && isDefensiveMove(board, x, y, ns)) defensiveMoves.push([x, y]);
    }
  }
  return defensiveMoves;
}

function isDefensiveMove(board, x, y, ns) {
  const ourPiece = 'X';
  const size = board.length;

  ns.print("Debug: Checking defensive move on board: " + JSON.stringify(board));
  if (!validateBoardState(board, ns)) {
    ns.print("Error: Invalid board state in isDefensiveMove.");
    return false;
  }

  const isValidCoordinate = (x, y) => x >= 0 && x < size && y >= 0 && y < size;

  const libertiesCheck = (x, y) => {
    if (!isValidCoordinate(x, y)) return false;
    if (ns.go.analysis.getLiberties(x, y) === 1) {
      return true;
    }
    return false;
  };

  const result = (
    (board[x - 1]?.[y] === ourPiece && libertiesCheck(x - 1, y)) ||
    (board[x + 1]?.[y] === ourPiece && libertiesCheck(x + 1, y)) ||
    (board[x]?.[y - 1] === ourPiece && libertiesCheck(x, y - 1)) ||
    (board[x]?.[y + 1] === ourPiece && libertiesCheck(x, y + 1))
  );

  ns.print("Debug: Result of isDefensiveMove: " + result);
  return result;
}

function isAdjacentToOurPieces(board, x, y) {
  const ourPiece = 'X';
  const size = board.length;

  const isValidCoordinate = (x, y) => x >= 0 && x < size && y >= 0 && y < size;

  return (
    (isValidCoordinate(x - 1, y) && board[x - 1]?.[y] === ourPiece) ||
    (isValidCoordinate(x + 1, y) && board[x + 1]?.[y] === ourPiece) ||
    (isValidCoordinate(x, y - 1) && board[x]?.[y - 1] === ourPiece) ||
    (isValidCoordinate(x, y + 1) && board[x]?.[y + 1] === ourPiece)
  );
}

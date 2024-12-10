/** @param {NS} ns **/
export async function main(ns) {
    const maxLoops = 500;
    let loopCount = 0;

    ns.tail();
    ns.resizeTail(600, 700);

    while (loopCount < maxLoops) {
        ns.print(`Starting loop ${loopCount + 1} of ${maxLoops}`);
        let boardInitialized = await initializeBoard(ns);

        if (!boardInitialized) {
            ns.print("Critical Error: Unable to initialize board.");
            return;
        }

        await playGame(ns);
        loopCount++;
    }

    ns.print("Completed 500 loops. Restarting...");
    ns.spawn(ns.getScriptName());
}

async function initializeBoard(ns) {
    ns.print("Attempting to initialize the board...");
    let board = ns.go.getBoardState();
    if (board && validateBoardState(board, ns)) {
        ns.print("Board is already initialized: " + JSON.stringify(board));
        return true;
    }
    await ns.go.resetBoardState('Netburners', 5);
    await ns.sleep(1000);

    board = ns.go.getBoardState();
    ns.print("Debug: Board State after reset: " + JSON.stringify(board));
    if (!board || !validateBoardState(board, ns)) {
        ns.print("Error: Board is still not properly initialized.");
        return false;
    }
    ns.print("Board initialized: " + JSON.stringify(board));
    return true;
}

function validateBoardState(board, ns) {
    const isValid = Array.isArray(board) && board.every(row => typeof row === 'string' && row.length > 0);
    ns.print("Debug: Validating board state: " + JSON.stringify(board) + " isValid: " + isValid);
    return isValid;
}

async function playGame(ns) {
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

        do {
            const bestMove = getBestMove(board, validMoves, ns);

            if (!bestMove || bestMove.length < 2) {
                ns.print("Error: Could not determine a valid move. Retrying...");
                await ns.sleep(1000);
                break;
            }

            x = bestMove[0];
            y = bestMove[1];

            if (x === undefined || y === undefined) {
                result = await ns.go.passTurn();
            } else {
                result = await ns.go.makeMove(x, y);
            }

            if (result?.type === "gameOver") break;
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
            await ns.go.resetBoardState('Netburners', 5);
            ns.print("Board has been reset. Starting a new game...");
            await ns.sleep(1000);
            break;
        }
    }
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

    // Ensure coordinates are within bounds before accessing
    const isValidCoordinate = (x, y) => x >= 0 && x < size && y >= 0 && y < size;

    if (isValidCoordinate(x - 1, y)) ns.print("Debug: board[x - 1]?.[y] = " + board[x - 1]?.[y]);
    if (isValidCoordinate(x + 1, y)) ns.print("Debug: board[x + 1]?.[y] = " + board[x + 1]?.[y]);
    if (isValidCoordinate(x, y - 1)) ns.print("Debug: board[x]?.[y - 1] = " + board[x]?.[y - 1]);
    if (isValidCoordinate(x, y + 1)) ns.print("Debug: board[x]?.[y + 1] = " + board[x]?.[y + 1]);

    // Additional debug checks for board state validity
    if (!validateBoardState(board, ns)) {
        ns.print("Error: Invalid board state detected before calling getLiberties.");
        return false;
    }

    const result = (
        (isValidCoordinate(x - 1, y) && board[x - 1]?.[y] === opponent && ns.go.analysis.getLiberties(x - 1, y) === 1) ||
        (isValidCoordinate(x + 1, y) && board[x + 1]?.[y] === opponent && ns.go.analysis.getLiberties(x + 1, y) === 1) ||
        (isValidCoordinate(x, y - 1) && board[x]?.[y - 1] === opponent && ns.go.analysis.getLiberties(x, y - 1) === 1) ||
        (isValidCoordinate(x, y + 1) && board[x]?.[y + 1] === opponent && ns.go.analysis.getLiberties(x, y + 1) === 1)
    );

    ns.print("Debug: Result of isCaptureMove: " + result);
    return result;
}

function isDefensiveMove(board, x, y, ns) {
    const ourPiece = 'X';
    const size = board.length;

    ns.print("Debug: Checking defensive move on board: " + JSON.stringify(board));
    if (!validateBoardState(board, ns)) {
        ns.print("Error: Invalid board state in isDefensiveMove.");
        return false;
    }

    // Ensure coordinates are within bounds before accessing
    const isValidCoordinate = (x, y) => x >= 0 && x < size && y >= 0 && y < size;

    if (isValidCoordinate(x - 1, y)) ns.print("Debug: board[x - 1]?.[y] = " + board[x - 1]?.[y]);
    if (isValidCoordinate(x + 1, y)) ns.print("Debug: board[x + 1]?.[y] = " + board[x + 1]?.[y]);
    if (isValidCoordinate(x, y - 1)) ns.print("Debug: board[x]?.[y - 1] = " + board[x]?.[y - 1]);
    if (isValidCoordinate(x, y + 1)) ns.print("Debug: board[x]?.[y + 1] = " + board[x]?.[y + 1]);

    // Additional debug checks for board state validity
    if (!validateBoardState(board, ns)) {
        ns.print("Error: Invalid board state detected before calling getLiberties.");
        return false;
    }

    const result = (
        (isValidCoordinate(x - 1, y) && board[x - 1]?.[y] === ourPiece && ns.go.analysis.getLiberties(x - 1, y) === 1) ||
        (isValidCoordinate(x + 1, y) && board[x + 1]?.[y] === ourPiece && ns.go.analysis.getLiberties(x + 1, y) === 1) ||
        (isValidCoordinate(x, y - 1) && board[x]?.[y - 1] === ourPiece && ns.go.analysis.getLiberties(x, y - 1) === 1) ||
        (isValidCoordinate(x, y + 1) && board[x]?.[y + 1] === ourPiece && ns.go.analysis.getLiberties(x, y + 1) === 1)
    );

    ns.print("Debug: Result of isDefensiveMove: " + result);
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

function isAdjacentToOurPieces(board, x, y) {
    const ourPiece = 'X';
    return (
        board[x - 1]?.[y] === ourPiece ||
        board[x + 1]?.[y] === ourPiece ||
        board[x]?.[y - 1] === ourPiece ||
        board[x]?.[y + 1] === ourPiece
    );
}

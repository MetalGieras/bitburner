/** @param {NS} ns **/
export async function main(ns) {
  ns.tail(); ns.resizeTail(700, 900);
  while (true) {
    ns.print("Checking the current game state...");

    if (await isGameOver(ns)) {
      ns.print("Game is over. Initializing a new game...");
      await ns.go.resetBoardState('Netburners', 5);
      await ns.sleep(1000); // Wait for the game to initialize
    } else {
      ns.print("Game is not over. Checking the board state...");
      let board = ns.go.getBoardState();
      if (!validateBoardState(board, ns)) {
        ns.print("Error: Invalid board state. Initializing a new game...");
        await ns.go.resetBoardState('Netburners', 5);
        await ns.sleep(1000); // Wait for the game to initialize
      }
    }

    ns.print("Starting player bot...");
    if (ns.fileExists('subnetBot.js', 'home')) {
      ns.exec('subnetBot.js', ns.getHostname());
    } else {
      ns.print("Error: subnetBot.js not found on home. Ensure the script exists and try again.");
    }
  }

  async function isGameOver(ns) {
    try {
      await ns.go.passTurn();
    } catch (error) {
      ns.print("Caught error when passing turn: " + (error.message || "No error message available"));
      if (error.message && (error.message.includes("game is over") || error.message.includes("undefined"))) {
        return true;
      }
    }
    return false;
  }

  function validateBoardState(board, ns) {
    const isValid = Array.isArray(board) && board.every(row => typeof row === 'string' && row.length > 0);
    ns.print("Debug: Validating board state: " + JSON.stringify(board) + " isValid: " + isValid);
    return isValid;
  }
}

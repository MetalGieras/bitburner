/** @param {NS} ns **/
export async function main(ns) {
  var maxSharePer = 1.00;
  var stockBuyPer = 0.60;
  var stockVolPer = 0.05;
  var keepPercentage = 0.15; // Percentage of the portfolio to keep as liquid funds
  var minSharePer = 5;
  var profit = 0;
  var portfolioValue = 0;
  var recentBuys = [];
  var recentSales = [];
  var previousTransactions = {}; // Track previous transactions

  ns.disableLog('disableLog');
  ns.disableLog('sleep');
  ns.disableLog('stock.buyStock');
  ns.disableLog('stock.sellStock');
  ns.disableLog('getServerMoneyAvailable');
  ns.tail();
  ns.resizeTail(600, 900);

  while (true) {
    profit = 0; // Reset profit for this cycle
    portfolioValue = 0; // Reset portfolio value for this cycle
    ns.clearLog(); // Clear the log for a fresh update

    var stocks = ns.stock.getSymbols().sort(function (a, b) {
      return ns.stock.getForecast(b) - ns.stock.getForecast(a);
    });

    for (const stock of stocks) {
      var position = ns.stock.getPosition(stock);
      if (position[0]) {
        sellPositions(stock, position);
      }
      buyPositions(stock, position);
      portfolioValue += position[0] * ns.stock.getPrice(stock); // Update portfolio value
    }

    // Print total values at the top
    ns.print('Total portfolio value: $' + ns.formatNumber(portfolioValue, 3));
    ns.print('Total profit/loss: $' + ns.formatNumber(profit, 3));
    ns.print('');

    // Print recent buys
    ns.print('Recent Buys:');
    for (let i = 0; i < recentBuys.length; i++) {
      ns.print(recentBuys[i]);
    }

    // Print recent sales
    ns.print('');
    ns.print('Recent Sales:');
    for (let i = 0; i < recentSales.length; i++) {
      ns.print(recentSales[i]);
    }

    await ns.sleep(6000);
  }

  function buyPositions(stock, position) {
    var maxShares = (ns.stock.getMaxShares(stock) * maxSharePer) - position[0];
    var askPrice = ns.stock.getAskPrice(stock);
    var forecast = ns.stock.getForecast(stock);
    var volPer = ns.stock.getVolatility(stock);
    var playerMoney = ns.getServerMoneyAvailable('home');
    var stockShares = ns.stock.getMaxShares(stock)
    var liquidFunds = Math.floor((portfolioValue + playerMoney) * keepPercentage);
    //var liquidFunds = portfolioValue * keepPercentage;
    var brokerFee = 100000;
    var transFees = liquidFunds + brokerFee;

    if (forecast >= stockBuyPer && volPer <= stockVolPer) {
      if (playerMoney - liquidFunds > ns.stock.getPurchaseCost(stock, minSharePer, "Long")) {
        var shares = Math.min((playerMoney - transFees) / askPrice, maxShares);
        ns.stock.buyStock(stock, shares);
        profit -= ns.stock.getPurchaseCost(stock, minSharePer, "Long");
        previousTransactions[stock] = { price: askPrice, shares: (previousTransactions[stock]?.shares || 0) + shares };
      }
      recentBuys.unshift('Bought: ' + ns.formatNumber(position[0], 3) + '/' + ns.formatNumber(stockShares, 3) + ' of ' + stock + ' for $' + ns.formatNumber(ns.stock.getPurchaseCost(stock, minSharePer, "Long"), 3));
      if (recentBuys.length > 10) recentBuys.pop(); // Keep the recent buys array to 10 elements

    }
  }

  function sellPositions(stock, position) {
    var forecast = ns.stock.getForecast(stock);
    if (forecast < 0.5) {
      ns.stock.sellStock(stock, position[0]);
      var saleGain = ns.stock.getSaleGain(stock, position[0], "Long");
      if (previousTransactions[stock]) {
        var previous = previousTransactions[stock];
        //profit += (saleGain - (previous.price * previous.shares));
        profit += (saleGain);
        previousTransactions[stock].shares -= position[0];
        if (previousTransactions[stock].shares <= 0) delete previousTransactions[stock];
      } else {
        profit += saleGain;
      }
      recentSales.unshift('Sold: ' + ns.formatNumber(position[0], 3) + '/' + ns.formatNumber(ns.stock.getMaxShares(stock)) + ' of ' + stock + ' for $' + ns.formatNumber(saleGain, 3));
      if (recentSales.length > 10) recentSales.pop(); // Keep the recent sales array to 10 elements
    }
  }
}

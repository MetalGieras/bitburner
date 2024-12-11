/** @param {NS} ns */
export async function main(ns) {

  ns.disableLog('disableLog');
  ns.disableLog('scan');
  ns.disableLog('getServerRequiredHackingLevel');
  ns.disableLog('getServerBaseSecurityLevel');
  ns.disableLog('getServerMoneyAvailable');
  ns.disableLog('getServerMaxMoney');
  ns.disableLog('getServerMaxRam');

  ns.tail(); ns.resizeTail(700, 900);

  var hacklvl = ns.getHackingLevel();
  var target = '';
  var bestTargetVal = 0;
  var bestTargetMax = 0;

  function getAllHosts(ns) {
    getAllHosts.cache ||= {};
    const scanned = getAllHosts.cache;
    const toScan = ['home'];
    while (toScan.length > 0) {
      const host = toScan.shift();
      scanned[host] = true;
      for (const nextHost of ns.scan(host)) {
        if (!(nextHost in scanned)) {
          toScan.push(nextHost);
        }
      }
    }
    const allHosts = Object.keys(scanned);
    return allHosts;
  }

  function attainTarget(ns) {
    for (const host of getAllHosts(ns)) {
      if (ns.getServerRequiredHackingLevel(host) <= hacklvl) {
        if (ns.getServerMaxRam(host) == 0) {
          if (ns.getServerMoneyAvailable(host) > bestTargetVal) {
            if (ns.getServerMoneyAvailable(host) != 0 && host != 'home') {
              bestTargetVal = (ns.getServerMoneyAvailable(host) / ns.getServerMaxMoney(host));
              if (bestTargetVal > bestTargetMax) {
                bestTargetMax = bestTargetVal;
                target = host;
              }
            }
          }
        }
      }
    }
    return target;
  }

  attainTarget(ns);

  var moneyThresh = Math.floor(ns.getServerMaxMoney(target) * 0.90);
  var securityThresh = Math.floor(ns.getServerBaseSecurityLevel(target) * 0.5);
  if (securityThresh < 1) { securityThresh = 1; }
  while (true) {
    if (ns.getServerSecurityLevel(target) > securityThresh) {
      await ns.weaken(target);
    }
    else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
      await ns.grow(target);
    }
    else {
      await ns.hack(target);
    }
  }
}

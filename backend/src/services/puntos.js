const { exigir } = require("./validaciones");
function canje(puntos, saldo, pendiente) {
  exigir(Number.isSafeInteger(puntos) && puntos >= 0 && puntos % 100 === 0,
    "Canjea puntos en bloques de 100 (Q10)");
  exigir(puntos <= saldo, "Saldo de puntos insuficiente", 409);
  exigir(puntos * 10 <= Math.round(pendiente * 100), "Los puntos exceden el saldo por pagar", 409);
  return puntos / 10;
}
const ganar = (dinero) => Math.floor(Math.round(dinero * 100) / 10000) * 10;
module.exports = { canje, ganar };

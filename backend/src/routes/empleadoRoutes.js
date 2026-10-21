const router = require('express').Router();
const { verificarToken } = require('../middlewares/authMiddleware');
const { conectar, filas } = require('../services/db');
router.get('/mi-carnet', verificarToken, async (req, res) => {
  let c;
  try {
    c = await conectar();
    res.set('Cache-Control','no-store');
    const id = req.usuario.ID_USUARIO;
    const [empleado] = await filas(c, 'SELECT id_usuario,nombre_completo,nombre_usuario,correo,sueldo,horario,puesto FROM usuarios WHERE id_usuario=:id', { id });
    const [resumen] = await filas(c, `SELECT COUNT(*) ventas,COALESCE(SUM(v.total),0) total FROM ventas v JOIN pedidos p ON p.id_pedido=v.id_pedido
      WHERE p.id_usuario=:id AND p.estado='PAGADO' AND EXISTS(SELECT 1 FROM pagos g WHERE g.id_venta=v.id_venta GROUP BY g.id_venta HAVING MAX(g.fecha)>=DATE_TRUNC('month',CURRENT_DATE))`, { id });
    const ventas = await filas(c, `SELECT v.id_venta,v.cliente_nombre,v.total,p.estado,v.fecha FROM ventas v JOIN pedidos p ON p.id_pedido=v.id_pedido WHERE p.id_usuario=:id ORDER BY v.id_venta DESC LIMIT 10`, { id });
    res.json({ empleado, resumen, ventas });
  } catch { res.status(500).json({ mensaje:'No se pudo consultar el carnet' }); }
  finally { if(c) await c.close(); }
});
module.exports = router;

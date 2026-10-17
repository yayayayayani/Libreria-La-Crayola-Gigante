// El estado incluye +502 también mientras el usuario escribe un número parcial.
// Solo quitar el 502 sin signo cuando sea un prefijo inequívoco, no parte del número local.
const local = (valor) =>
  String(valor || "")
    .trim()
    .replace(/^(?:\+502[\s-]*|502[\s-]+|502(?=\d{8}$))/, "");
const formato = (valor) => (valor.length > 4 ? `${valor.slice(0, 4)}-${valor.slice(4)}` : valor);
export default function Telefono({ valor, onValor }) {
  const cambiar = (input, texto) => {
    input.setCustomValidity("");
    const numero = texto.replace(/\D/g, "").slice(0, 8);
    onValor(numero ? `+502 ${formato(numero)}` : "");
  };
  return (
    <label>
      Teléfono
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>+502</span>
        <input
          aria-label="Teléfono"
          type="tel"
          inputMode="numeric"
          placeholder="1234-1234"
          maxLength={9}
          pattern="[0-9]{4}\-[0-9]{4}"
          title="Ingresa 8 dígitos de un teléfono de Guatemala"
          value={formato(local(valor).replace(/-/g, ""))}
          onChange={(e) => cambiar(e.target, e.target.value)}
          onPaste={(e) => {
            const texto = e.clipboardData.getData("text").trim();
            if (!texto.startsWith("+") && !/^502[\s-]?\d{4}[\s-]?\d{4}$/.test(texto)) return;
            e.preventDefault();
            if (!/^\+?502[\s-]?\d{4}[\s-]?\d{4}$/.test(texto)) {
              e.currentTarget.setCustomValidity(
                "Solo se aceptan teléfonos de Guatemala (+502) con 8 dígitos",
              );
              e.currentTarget.reportValidity();
              return;
            }
            cambiar(e.currentTarget, local(texto));
          }}
        />
      </div>
      <small>Guatemala · 8 dígitos. El prefijo y el guion son automáticos.</small>
    </label>
  );
}

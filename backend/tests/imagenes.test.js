const { test } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { prepararImagen, MAX_BYTES } = require("../src/services/imagenes");

test("imagen válida se convierte a WebP y limita sus dimensiones", async () => {
  const original = await sharp({
    create: { width: 1400, height: 800, channels: 3, background: "#d2ae45" },
  })
    .png()
    .toBuffer();
  const foto = await prepararImagen(`data:image/png;base64,${original.toString("base64")}`);
  const meta = await sharp(Buffer.from(foto, "base64")).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1000);
  assert.ok(meta.height <= 1000);
});
test("rechaza SVG, URLs y archivos que solo aparentan ser imágenes", async () => {
  for (const foto of [
    "https://example.invalid/a.png",
    "data:image/svg+xml;base64,PHN2Zy8+",
    "data:image/png;base64,aG9sYQ==",
    false,
    {},
  ]) {
    await assert.rejects(prepararImagen(foto), { status: 400 });
  }
});
test("rechaza archivos demasiado grandes antes de decodificar", async () => {
  await assert.rejects(
    prepararImagen("data:image/png;base64," + "A".repeat(Math.ceil(MAX_BYTES / 3) * 4 + 101)),
    { status: 400 },
  );
});
test("rechaza imágenes de más de 16 megapíxeles", async () => {
  const bytes = await sharp({
    create: { width: 4100, height: 4000, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  await assert.rejects(prepararImagen(`data:image/png;base64,${bytes.toString("base64")}`), {
    status: 400,
  });
});
test("omitir conserva y null elimina una fotografía", async () => {
  assert.equal(await prepararImagen(undefined), undefined);
  assert.equal(await prepararImagen(null), null);
});

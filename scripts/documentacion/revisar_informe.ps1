$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$file=Join-Path $root 'docs/Sprint_3_Analisis_de_Sistemas.docx'
$out=Join-Path $root '.tools/revision-informe-sprint3'
New-Item -ItemType Directory -Force -Path $out | Out-Null
Add-Type -AssemblyName System.Drawing
$word=New-Object -ComObject Word.Application
$word.Visible=$false
$word.DisplayAlerts=0
try {
 $doc=$word.Documents.Open($file)
 try {
  $doc.Fields.Update() | Out-Null
  for($i=1;$i -le $doc.TablesOfContents.Count;$i++){$doc.TablesOfContents.Item($i).Update()}
  $doc.Repaginate()
  $doc.Save()
  $pages=$doc.ActiveWindow.ActivePane.Pages
  $n=$pages.Count
  foreach($p in (@(1,2,3,5,8,12,18,24,30,36,42,48,54,60,$n) | Sort-Object -Unique)){
   if($p -gt $n){continue}
   $emf=Join-Path $out ('pagina-'+$p+'.emf')
   [IO.File]::WriteAllBytes($emf,$pages.Item($p).EnhMetaFileBits)
   $img=[Drawing.Image]::FromFile($emf)
   try{$img.Save([IO.Path]::ChangeExtension($emf,'.png'),[Drawing.Imaging.ImageFormat]::Png)}finally{$img.Dispose()}
  }
  [pscustomobject]@{archivo=$file;paginas=$n;tablas=$doc.Tables.Count;figuras=$doc.InlineShapes.Count;indices=$doc.TablesOfContents.Count} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'revision.json')
  Get-Content (Join-Path $out 'revision.json')
 }finally{$doc.Close(0)}
}finally{$word.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)}

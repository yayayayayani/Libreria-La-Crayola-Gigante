$ErrorActionPreference = 'Stop'
$documentDirectory = Join-Path $PSScriptRoot 'Word'
$wordApplication = New-Object -ComObject Word.Application
$wordApplication.Visible = $false
$wordApplication.DisplayAlerts = 0
$documentReport = @()
try {
    foreach ($documentFile in Get-ChildItem -LiteralPath $documentDirectory -Filter '*.docx' | Where-Object { -not $_.Name.StartsWith('~$') }) {
        $openedDocument = $wordApplication.Documents.Open($documentFile.FullName, $false, $false)
        try {
            $openedDocument.Fields.Update() | Out-Null
            $openedDocument.Repaginate()
            foreach ($contents in $openedDocument.TablesOfContents) { $contents.Update() }
            $openedDocument.Save()
            $documentReport += [pscustomobject]@{
                archivo = $documentFile.Name
                paginas = $openedDocument.ComputeStatistics(2)
                tablas = $openedDocument.Tables.Count
                indice = $openedDocument.TablesOfContents.Count
                estado = 'Abierto, paginado e indice actualizado por Microsoft Word'
            }
            Write-Output ('Validado: ' + $documentFile.Name)
        } finally { $openedDocument.Close(0) }
    }
} finally {
    $wordApplication.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wordApplication) | Out-Null
}
$documentReport | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'REVISION_WORD.json') -Encoding UTF8
$documentReport | Format-Table archivo,paginas,indice -AutoSize

Attribute VB_Name = "ExportAioCsv"
Option Explicit

' Export Quality AIO ListObjects to aio-csv next to this workbook.
' Import into Quality AIO.xlsm only — do not import FromQuality into a quality workbook.
' The HTA reads these CSVs more reliably than opening the .xlsm.
'
' Table114 Master Database  -> MasterDatabase.csv  (includes Type when present:
'   BUBBLE, FOAM, LAM, PLANK)
' Table7   Master Sheet     -> MasterSheet.csv     (foam MSPECs)
' Table86  Master Sheet     -> RtsSpecs.csv        (RTS / LAM specs)
' Table97  Master Sheet     -> P1Specs.csv         (P1 / PLANK specs)
' Table18  User List        -> UserList.csv

Public Sub ExportAioCsv()
    Dim dest As String
    dest = ThisWorkbook.Path & Application.PathSeparator & "aio-csv"
    EnsureFolder dest
    ExportNamedTable SheetByName("Master Database"), "Table114", dest & Application.PathSeparator & "MasterDatabase.csv"
    ExportNamedTable SheetByName("Master Sheet"), "Table7", dest & Application.PathSeparator & "MasterSheet.csv"
    ExportNamedTable SheetByName("Master Sheet"), "Table86", dest & Application.PathSeparator & "RtsSpecs.csv"
    ExportNamedTable SheetByName("Master Sheet"), "Table97", dest & Application.PathSeparator & "P1Specs.csv"
    ExportNamedTable SheetByName("User List"), "Table18", dest & Application.PathSeparator & "UserList.csv"
    MsgBox "Exported lookup CSVs to:" & vbCrLf & dest & vbCrLf & _
           "MasterDatabase.csv (Table114)" & vbCrLf & _
           "MasterSheet.csv (Table7 foam)" & vbCrLf & _
           "RtsSpecs.csv (Table86)" & vbCrLf & _
           "P1Specs.csv (Table97)" & vbCrLf & _
           "UserList.csv (Table18)", vbInformation
End Sub

Private Function SheetByName(ByVal sheetName As String) As Worksheet
    On Error Resume Next
    Set SheetByName = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0
    If SheetByName Is Nothing Then Err.Raise vbObjectError + 1, , "Missing sheet: " & sheetName
End Function

Private Sub EnsureFolder(ByVal path As String)
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    If Not fso.FolderExists(path) Then fso.CreateFolder path
End Sub

Private Function FindListObject(ByVal ws As Worksheet, ByVal tableName As String) As ListObject
    Dim lo As ListObject
    For Each lo In ws.ListObjects
        If StrComp(lo.Name, tableName, vbTextCompare) = 0 Then
            Set FindListObject = lo
            Exit Function
        End If
    Next lo
End Function

Private Sub ExportNamedTable(ByVal ws As Worksheet, ByVal tableName As String, ByVal filePath As String)
    Dim lo As ListObject
    Set lo = FindListObject(ws, tableName)
    If lo Is Nothing Then
        Err.Raise vbObjectError + 2, , "Missing table " & tableName & " on sheet " & ws.Name
    End If
    ExportRangeCsv lo.Range, filePath
End Sub

Private Sub ExportRangeCsv(ByVal rng As Range, ByVal filePath As String)
    Dim r As Long, c As Long, lastR As Long, lastC As Long
    Dim parts() As String, line As String
    Dim fso As Object, ts As Object
    lastR = rng.Rows.Count
    lastC = rng.Columns.Count
    If lastR < 1 Or lastC < 1 Then Exit Sub
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set ts = fso.CreateTextFile(filePath, True, False)
    For r = 1 To lastR
        ReDim parts(1 To lastC)
        For c = 1 To lastC
            parts(c) = CsvEscape(rng.Cells(r, c).Value)
        Next c
        line = Join(parts, ",")
        ts.WriteLine line
    Next r
    ts.Close
End Sub

Private Function CsvEscape(ByVal v As Variant) As String
    Dim s As String
    If IsError(v) Then
        CsvEscape = ""
        Exit Function
    End If
    If IsEmpty(v) Or IsNull(v) Then
        CsvEscape = ""
        Exit Function
    End If
    s = CStr(v)
    If InStr(s, ",") > 0 Or InStr(s, """") > 0 Or InStr(s, vbCr) > 0 Or InStr(s, vbLf) > 0 Then
        CsvEscape = """" & Replace(s, """", """""") & """"
    Else
        CsvEscape = s
    End If
End Function

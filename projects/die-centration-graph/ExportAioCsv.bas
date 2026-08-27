Attribute VB_Name = "ExportAioCsv"
Option Explicit

' Export Quality AIO lookup sheets to aio-csv next to this workbook.
' Import into Quality AIO.xlsm only — do not import FromQuality into a quality workbook.
' The HTA reads these CSVs more reliably than opening the .xlsm.

Public Sub ExportAioCsv()
    Dim dest As String
    dest = ThisWorkbook.Path & Application.PathSeparator & "aio-csv"
    EnsureFolder dest
    ExportSheetCsv SheetByName("Master Database"), dest & Application.PathSeparator & "MasterDatabase.csv"
    ExportSheetCsv SheetByName("Master Sheet"), dest & Application.PathSeparator & "MasterSheet.csv"
    ExportSheetCsv SheetByName("User List"), dest & Application.PathSeparator & "UserList.csv"
    MsgBox "Exported lookup CSVs to:" & vbCrLf & dest, vbInformation
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

Private Sub ExportSheetCsv(ByVal ws As Worksheet, ByVal filePath As String)
    Dim lastR As Long, lastC As Long, r As Long, c As Long
    Dim parts() As String, line As String
    Dim fso As Object, ts As Object
    lastR = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    lastC = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
    If lastR < 1 Or lastC < 1 Then Exit Sub
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set ts = fso.CreateTextFile(filePath, True, False)
    For r = 1 To lastR
        ReDim parts(1 To lastC)
        For c = 1 To lastC
            parts(c) = CsvEscape(ws.Cells(r, c).Value)
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

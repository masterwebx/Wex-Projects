Attribute VB_Name = "CopyForGraphFromS4"
Option Explicit

' Import into Personal.xlsb or a launcher workbook — NOT into S4.xlsm.
' S4.xlsm still needs its own CopyForGraph.bas. This copies that file, opens the
' copy hidden, runs Copy for Graph there, then closes so the live S4 stays shut.
'
' Button: CopyForGraphFromS4.CopyForGraphFromS4

Private Const SOURCE_XLSM As String = "G:\Shipping\100% Inspection Sheets\Production Folder\1 - Quality\Files\S4.xlsm"

Public Sub CopyForGraphFromS4()
    RunCopyFromWorkbookCopy SOURCE_XLSM, "s4", "CopyForGraph.CopyForGraph", "CopyForGraph.bas"
End Sub

Private Sub RunCopyFromWorkbookCopy(ByVal src As String, ByVal tag As String, ByVal primaryMacro As String, ByVal importHint As String)
    Dim dest As String
    Dim wb As Workbook
    Dim prevSU As Boolean
    Dim prevEA As Boolean
    Dim prevDA As Boolean
    Dim prevCur As XlMousePointer
    Dim runErr As Long
    Dim runDesc As String
    
    On Error GoTo ErrHandler
    
    If LenB(Dir$(src, vbNormal)) = 0 Then
        MsgBox "Could not find workbook:" & vbCrLf & src, vbCritical, "Copy for Graph"
        Exit Sub
    End If
    
    dest = TempCopyPath(src, tag)
    On Error Resume Next
    Kill dest
    On Error GoTo ErrHandler
    FileCopy src, dest
    
    prevSU = Application.ScreenUpdating
    prevEA = Application.EnableEvents
    prevDA = Application.DisplayAlerts
    prevCur = Application.Cursor
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.DisplayAlerts = False
    Application.Cursor = xlWait
    Application.StatusBar = "Opening a silent copy of " & Mid$(src, InStrRev(src, "\") + 1) & "..."
    
    Set wb = Workbooks.Open(Filename:=dest, UpdateLinks:=0, ReadOnly:=True, AddToMru:=False, IgnoreReadOnlyRecommended:=True)
    HideWorkbookWindows wb
    
    Application.EnableEvents = True
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    
    On Error Resume Next
    Application.Run "'" & Replace(wb.Name, "'", "''") & "'!" & primaryMacro
    runErr = Err.Number
    runDesc = Err.Description
    If runErr <> 0 Then
        Err.Clear
        Application.Run "'" & Replace(wb.Name, "'", "''") & "'!CopyForGraph"
        runErr = Err.Number
        runDesc = Err.Description
    End If
    On Error GoTo ErrHandler
    
    CloseCopy wb, dest
    RestoreApp prevSU, prevEA, prevDA, prevCur
    Set wb = Nothing
    
    If runErr <> 0 Then
        MsgBox "Opened a copy, but Copy for Graph is not in that workbook." & vbCrLf & _
            "Import " & importHint & " into the live file, then try again." & vbCrLf & vbCrLf & runDesc, _
            vbCritical, "Copy for Graph"
        Exit Sub
    End If
    
    Application.StatusBar = "Copied for graph from silent workbook copy"
    Exit Sub
    
ErrHandler:
    runDesc = Err.Description
    On Error Resume Next
    CloseCopy wb, dest
    RestoreApp prevSU, prevEA, prevDA, prevCur
    Application.StatusBar = False
    MsgBox "Copy for graph failed: " & runDesc, vbCritical, "Copy for Graph"
End Sub

Private Function TempCopyPath(ByVal src As String, ByVal tag As String) As String
    Dim folder As String
    Dim i As Long
    i = InStrRev(src, "\")
    If i > 0 Then folder = Left$(src, i) Else folder = Environ$("TEMP") & "\"
    TempCopyPath = folder & "_diegraph_" & tag & "_copy_" & Format$(Now, "yyyymmdd_hhnnss") & ".xlsm"
End Function

Private Sub HideWorkbookWindows(ByVal wb As Workbook)
    Dim w As Window
    If wb Is Nothing Then Exit Sub
    On Error Resume Next
    For Each w In wb.Windows
        w.Visible = False
    Next w
End Sub

Private Sub CloseCopy(ByVal wb As Workbook, ByVal dest As String)
    On Error Resume Next
    Application.DisplayAlerts = False
    Application.EnableEvents = False
    If Not wb Is Nothing Then wb.Close SaveChanges:=False
    If LenB(dest) > 0 Then Kill dest
End Sub

Private Sub RestoreApp(ByVal prevSU As Boolean, ByVal prevEA As Boolean, ByVal prevDA As Boolean, ByVal prevCur As XlMousePointer)
    On Error Resume Next
    Application.ScreenUpdating = prevSU
    Application.EnableEvents = prevEA
    Application.DisplayAlerts = prevDA
    Application.Cursor = prevCur
    Application.StatusBar = False
End Sub

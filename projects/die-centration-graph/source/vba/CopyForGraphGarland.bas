Attribute VB_Name = "CopyForGraphGarland"
Option Explicit

' Import this module into the Garland Bubble quality workbook only.
' Do not import into Visalia S4.xlsm, S1 S3.xlsm, Bubble.xlsm, P1.xlsm,
' or RTS.xlsm, and do not import CopyForGraphFromQuality here.
'
' Button name: Copy for Graph  (macro CopyForGraphGarland.CopyForGraph)
' Writes Data!Table1 as DIEGRAPH2.txt in the Wex Quality folder, then
' opens qualitydesk.hta so the HTA can import and delete the file.

#If Mac Then
    ' DataObject fallback only
#ElseIf VBA7 Then
    Private Declare PtrSafe Function OpenClipboard Lib "user32" (ByVal hwnd As LongPtr) As Long
    Private Declare PtrSafe Function EmptyClipboard Lib "user32" () As Long
    Private Declare PtrSafe Function CloseClipboard Lib "user32" () As Long
    Private Declare PtrSafe Function SetClipboardData Lib "user32" (ByVal wFormat As Long, ByVal hMem As LongPtr) As LongPtr
    Private Declare PtrSafe Function GlobalAlloc Lib "kernel32" (ByVal wFlags As Long, ByVal dwBytes As LongPtr) As LongPtr
    Private Declare PtrSafe Function GlobalLock Lib "kernel32" (ByVal hMem As LongPtr) As LongPtr
    Private Declare PtrSafe Function GlobalUnlock Lib "kernel32" (ByVal hMem As LongPtr) As Long
    Private Declare PtrSafe Sub CopyMemory Lib "kernel32" Alias "RtlMoveMemory" (ByVal Destination As LongPtr, ByVal Source As LongPtr, ByVal Length As LongPtr)
#Else
    Private Declare Function OpenClipboard Lib "user32" (ByVal hwnd As Long) As Long
    Private Declare Function EmptyClipboard Lib "user32" () As Long
    Private Declare Function CloseClipboard Lib "user32" () As Long
    Private Declare Function SetClipboardData Lib "user32" (ByVal wFormat As Long, ByVal hMem As Long) As Long
    Private Declare Function GlobalAlloc Lib "kernel32" (ByVal wFlags As Long, ByVal dwBytes As Long) As Long
    Private Declare Function GlobalLock Lib "kernel32" (ByVal hMem As Long) As Long
    Private Declare Function GlobalUnlock Lib "kernel32" (ByVal hMem As Long) As Long
    Private Declare Sub CopyMemory Lib "kernel32" Alias "RtlMoveMemory" (ByVal Destination As Long, ByVal Source As Long, ByVal Length As Long)
#End If

Private Const CF_UNICODETEXT As Long = 13
Private Const GMEM_MOVEABLE As Long = &H2
Private Const WEX_QUALITY As String = "G:\Shipping\100% Inspection Sheets\Production Folder\1 - Quality\Wex Quality"
Private Const HANDOFF_NAME As String = "DIEGRAPH2.txt"
Private Const HTA_NAME As String = "qualitydesk.hta"

Public Sub CopyForGraph()
    Dim payload As String
    Dim tsvTable As String
    
    On Error GoTo ErrHandler
    
    Application.Cursor = xlWait
    Application.StatusBar = "Copying Table1..."
    
    tsvTable = ListObjectToTsv(Table1ListObject())
    If LenB(tsvTable) = 0 Then
        Application.Cursor = xlDefault
        Application.StatusBar = False
        MsgBox "Could not find Table1 on the Data sheet.", vbCritical, "Copy for Graph"
        Exit Sub
    End If
    
    payload = "DIEGRAPH2" & vbCrLf
    payload = payload & "[CURRENT]" & vbCrLf
    payload = payload & "source=GARLAND" & vbCrLf
    payload = payload & "[TABLESGARLAND]" & vbCrLf
    payload = payload & tsvTable & vbCrLf
    
    WriteHandoffAndOpenHta payload
    
    Application.StatusBar = "Saved DIEGRAPH2.txt and opened Quality Desk"
    Application.Cursor = xlDefault
    Exit Sub
    
ErrHandler:
    Application.Cursor = xlDefault
    Application.StatusBar = False
    MsgBox "Copy for graph failed: " & Err.Description, vbCritical, "Copy for Graph"
End Sub

Private Function FileExists(ByVal p As String) As Boolean
    On Error Resume Next
    FileExists = (LenB(Trim$(p)) > 0 And LenB(Dir$(p, vbNormal)) > 0)
End Function

Private Function FolderExists(ByVal p As String) As Boolean
    Dim fso As Object
    On Error Resume Next
    Set fso = CreateObject("Scripting.FileSystemObject")
    If Not fso Is Nothing Then
        FolderExists = fso.FolderExists(p)
        Exit Function
    End If
    FolderExists = (LenB(Trim$(p)) > 0 And LenB(Dir$(p, vbDirectory)) > 0)
End Function

Private Function HandoffFolder() As String
    If FolderExists(WEX_QUALITY) Then
        HandoffFolder = WEX_QUALITY
        Exit Function
    End If
    If LenB(ThisWorkbook.Path) > 0 Then HandoffFolder = ThisWorkbook.Path
End Function

Private Function HtaPath() As String
    Dim folder As String
    Dim p As String
    folder = HandoffFolder()
    If LenB(folder) = 0 Then Exit Function
    p = folder & Application.PathSeparator & HTA_NAME
    If FileExists(p) Then
        HtaPath = p
        Exit Function
    End If
    p = folder & Application.PathSeparator & "quality-desk.hta"
    If FileExists(p) Then HtaPath = p
End Function

Private Sub WriteTextFile(ByVal p As String, ByVal s As String)
    Dim stm As Object
    Dim fso As Object
    Dim ts As Object
    On Error GoTo Fallback
    Set stm = CreateObject("ADODB.Stream")
    stm.Type = 2
    stm.Charset = "utf-8"
    stm.Open
    stm.WriteText s
    stm.SaveToFile p, 2
    stm.Close
    Exit Sub
Fallback:
    On Error Resume Next
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set ts = fso.CreateTextFile(p, True)
    If Not ts Is Nothing Then
        ts.Write s
        ts.Close
    End If
End Sub

Private Sub WriteHandoffAndOpenHta(ByVal payload As String)
    Dim folder As String
    Dim p As String
    Dim hta As String
    Dim sh As Object
    folder = HandoffFolder()
    If LenB(folder) = 0 Then
        MsgBox "Could not find the Wex Quality folder:" & vbCrLf & WEX_QUALITY, vbCritical, "Copy for Graph"
        Exit Sub
    End If
    p = folder & Application.PathSeparator & HANDOFF_NAME
    WriteTextFile p, payload
    hta = HtaPath()
    If LenB(hta) = 0 Then
        MsgBox "Saved " & p & vbCrLf & vbCrLf & "Could not find qualitydesk.hta. Open Quality Desk to import.", vbInformation, "Copy for Graph"
        Exit Sub
    End If
    On Error GoTo Fallback
    Set sh = CreateObject("WScript.Shell")
    sh.Run """" & hta & """", 3, False
    Exit Sub
Fallback:
    On Error Resume Next
    ThisWorkbook.FollowHyperlink Address:=hta, NewWindow:=True
End Sub

Private Function SheetByName(ByVal sheetName As String) As Worksheet
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0
    Set SheetByName = ws
End Function

Private Function Table1ListObject() As ListObject
    Dim ws As Worksheet
    Dim lo As ListObject
    Set ws = SheetByName("Data")
    If ws Is Nothing Then Exit Function
    On Error Resume Next
    Set lo = ws.ListObjects("Table1")
    On Error GoTo 0
    If lo Is Nothing Then
        For Each lo In ws.ListObjects
            If StrComp(lo.Name, "Table1", vbTextCompare) = 0 Or StrComp(lo.DisplayName, "Table1", vbTextCompare) = 0 Then
                Set Table1ListObject = lo
                Exit Function
            End If
        Next lo
    End If
    Set Table1ListObject = lo
End Function

Private Function ListObjectToTsv(ByVal lo As ListObject) As String
    Dim rng As Range
    If lo Is Nothing Then Exit Function
    On Error Resume Next
    Set rng = lo.Range
    On Error GoTo 0
    If rng Is Nothing Then Exit Function
    ListObjectToTsv = RangeToTsv(rng)
End Function

Private Function RangeToTsv(ByVal rng As Range) As String
    Dim data As Variant
    Dim r As Long, c As Long
    Dim nR As Long, nC As Long
    Dim lines() As String
    Dim parts() As String
    
    If rng Is Nothing Then Exit Function
    If rng.Cells.CountLarge = 1 Then
        RangeToTsv = TsvEscape(rng.Value2)
        Exit Function
    End If
    
    data = rng.Value2
    nR = UBound(data, 1)
    nC = UBound(data, 2)
    ReDim lines(1 To nR)
    ReDim parts(1 To nC)
    For r = 1 To nR
        For c = 1 To nC
            parts(c) = TsvEscape(data(r, c))
        Next c
        lines(r) = Join(parts, vbTab)
        If r Mod 2000 = 0 Then Application.StatusBar = "Copying Table1... " & CStr(r) & " / " & CStr(nR)
    Next r
    RangeToTsv = Join(lines, vbCrLf)
End Function

' Never use CLng or VBA.Round. CLng overflows above ~2.1 billion.
' Round uses Currency internally and overflows on huge values such as
' a RollLength of 1.5E+14 or a 13-digit barcode pasted into Comments.
Private Function TsvEscape(ByVal v As Variant) As String
    Dim s As String
    On Error GoTo Fallback
    If IsError(v) Then Exit Function
    If IsNull(v) Or IsEmpty(v) Then Exit Function
    Select Case VarType(v)
        Case vbBoolean
            TsvEscape = IIf(v, "TRUE", "FALSE")
        Case vbByte, vbInteger, vbLong, 20  ' 20 = vbLongLong when available
            TsvEscape = CStr(v)
        Case vbSingle, vbDouble, vbCurrency, vbDecimal
            TsvEscape = LTrim$(Str$(CDbl(v)))
        Case Else
            s = CStr(v)
            If Left$(s, 1) = "#" Then Exit Function
            s = Replace(s, vbCr, " ")
            s = Replace(s, vbLf, " ")
            s = Replace(s, vbTab, " ")
            TsvEscape = Trim$(s)
    End Select
    Exit Function
Fallback:
    TsvEscape = ""
End Function

Private Sub PutTextOnClipboard(ByVal s As String)
    Dim clip As Object
#If Mac Then
    Set clip = CreateObject("New:{1C3B4210-F441-11CE-B9EA-00AA006B1A69}")
    clip.SetText s
    clip.PutInClipboard
#Else
    On Error GoTo Fallback
    ' 32-bit Long overflows when (Len + 1) * 2 exceeds 2,147,483,647.
    If CDbl(Len(s)) > 1000000000# Then GoTo Fallback
    If Not PutUnicodeTextWin32(s) Then GoTo Fallback
    Exit Sub
Fallback:
    Set clip = CreateObject("New:{1C3B4210-F441-11CE-B9EA-00AA006B1A69}")
    clip.SetText s
    clip.PutInClipboard
#End If
End Sub

#If Mac Then
#ElseIf VBA7 Then
Private Function PutUnicodeTextWin32(ByVal s As String) As Boolean
    Dim hMem As LongPtr
    Dim pMem As LongPtr
    Dim nBytes As LongPtr
    nBytes = (Len(s) + 1) * 2
    hMem = GlobalAlloc(GMEM_MOVEABLE, nBytes)
    If hMem = 0 Then Exit Function
    pMem = GlobalLock(hMem)
    If pMem = 0 Then Exit Function
    CopyMemory pMem, StrPtr(s), nBytes
    GlobalUnlock hMem
    If OpenClipboard(0) = 0 Then Exit Function
    EmptyClipboard
    If SetClipboardData(CF_UNICODETEXT, hMem) = 0 Then
        CloseClipboard
        Exit Function
    End If
    CloseClipboard
    PutUnicodeTextWin32 = True
End Function
#Else
Private Function PutUnicodeTextWin32(ByVal s As String) As Boolean
    Dim hMem As Long
    Dim pMem As Long
    Dim nBytes As Long
    nBytes = (Len(s) + 1) * 2
    hMem = GlobalAlloc(GMEM_MOVEABLE, nBytes)
    If hMem = 0 Then Exit Function
    pMem = GlobalLock(hMem)
    If pMem = 0 Then Exit Function
    CopyMemory pMem, StrPtr(s), nBytes
    GlobalUnlock hMem
    If OpenClipboard(0) = 0 Then Exit Function
    EmptyClipboard
    If SetClipboardData(CF_UNICODETEXT, hMem) = 0 Then
        CloseClipboard
        Exit Function
    End If
    CloseClipboard
    PutUnicodeTextWin32 = True
End Function
#End If

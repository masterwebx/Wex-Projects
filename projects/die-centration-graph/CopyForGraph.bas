Attribute VB_Name = "CopyForGraph"
Option Explicit

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

' Button name: Copy for Graph
' Copies current S4 values (if any), lookup specs (Master Sheet Table7),
' and the full Data S4 TableS4 table as DIEGRAPH2 text for the HTML graph.
Public Sub CopyForGraph()
    Dim wsS4 As Worksheet
    Dim payload As String
    Dim hasPoints As Boolean
    Dim tsvLookup As String
    Dim tsvTable As String
    
    On Error GoTo ErrHandler
    
    Set wsS4 = SheetByName("S4")
    If wsS4 Is Nothing Then Set wsS4 = ActiveSheet
    
    If LenB(Trim$(CStr(Nz(wsS4.Range("B3").Value)))) = 0 Then
        MsgBox "Item # must be filled in", vbExclamation, "Copy for Graph"
        Exit Sub
    End If
    
    Application.Cursor = xlWait
    Application.StatusBar = "Copying for graph..."
    
    payload = CurrentSection(wsS4, hasPoints)
    
    Application.StatusBar = "Copying lookup table..."
    tsvLookup = ListObjectToTsv(LookupListObject())
    payload = payload & "[LOOKUP]" & vbCrLf
    If LenB(tsvLookup) > 0 Then
        payload = payload & tsvLookup & vbCrLf
    End If
    
    Application.StatusBar = "Copying TableS4..."
    tsvTable = ListObjectToTsv(TableS4ListObject())
    payload = payload & "[TABLES4]" & vbCrLf
    If LenB(tsvTable) > 0 Then
        payload = payload & tsvTable & vbCrLf
    End If
    
    PutTextOnClipboard payload
    
    Application.StatusBar = "Copied for graph (current + lookup + TableS4)"
    Application.Cursor = xlDefault
    Exit Sub
    
ErrHandler:
    Application.Cursor = xlDefault
    Application.StatusBar = False
    MsgBox "Copy for graph failed: " & Err.Description, vbCritical, "Copy for Graph"
End Sub

Private Function SheetByName(ByVal sheetName As String) As Worksheet
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0
    Set SheetByName = ws
End Function

Private Function TableS4ListObject() As ListObject
    Dim ws As Worksheet
    Dim lo As ListObject
    Set ws = SheetByName("Data S4")
    If ws Is Nothing Then Exit Function
    On Error Resume Next
    Set lo = ws.ListObjects("TableS4")
    On Error GoTo 0
    If lo Is Nothing Then
        For Each lo In ws.ListObjects
            If StrComp(lo.Name, "TableS4", vbTextCompare) = 0 Or StrComp(lo.DisplayName, "TableS4", vbTextCompare) = 0 Then
                Set TableS4ListObject = lo
                Exit Function
            End If
        Next lo
    End If
    Set TableS4ListObject = lo
End Function

Private Function LookupListObject() As ListObject
    Dim ws As Worksheet
    Dim lo As ListObject
    Dim hdr As Range
    Set ws = SheetByName("Master Sheet")
    If ws Is Nothing Then Exit Function
    On Error Resume Next
    Set lo = ws.ListObjects("Table7")
    On Error GoTo 0
    If Not lo Is Nothing Then
        Set LookupListObject = lo
        Exit Function
    End If
    For Each lo In ws.ListObjects
        On Error Resume Next
        Set hdr = lo.HeaderRowRange
        On Error GoTo 0
        If Not hdr Is Nothing Then
            If HeaderHas(hdr, "MSPEC #") And HeaderHas(hdr, "Lower Control") Then
                Set LookupListObject = lo
                Exit Function
            End If
        End If
    Next lo
End Function

Private Function HeaderHas(ByVal hdr As Range, ByVal colName As String) As Boolean
    Dim c As Range
    For Each c In hdr.Cells
        If StrComp(Trim$(CStr(Nz(c.Value))), colName, vbTextCompare) = 0 Then
            HeaderHas = True
            Exit Function
        End If
    Next c
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
    Next r
    RangeToTsv = Join(lines, vbCrLf)
End Function

Private Function TsvEscape(ByVal v As Variant) As String
    Dim s As String
    If IsError(v) Then Exit Function
    If IsNull(v) Or IsEmpty(v) Then Exit Function
    Select Case VarType(v)
        Case vbBoolean
            TsvEscape = IIf(v, "TRUE", "FALSE")
        Case vbByte, vbInteger, vbLong, 20  ' 20 = vbLongLong when available
            TsvEscape = CStr(v)
        Case vbSingle, vbDouble, vbCurrency, vbDecimal, vbDate
            TsvEscape = LTrim$(Str$(CDbl(v)))
        Case Else
            s = CStr(v)
            s = Replace(s, vbCr, " ")
            s = Replace(s, vbLf, " ")
            s = Replace(s, vbTab, " ")
            TsvEscape = Trim$(s)
    End Select
End Function

Private Sub PutTextOnClipboard(ByVal s As String)
    Dim clip As Object
#If Mac Then
    Set clip = CreateObject("New:{1C3B4210-F441-11CE-B9EA-00AA006B1A69}")
    clip.SetText s
    clip.PutInClipboard
#Else
    On Error GoTo Fallback
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

Private Function CurrentSection(ByVal wsS4 As Worksheet, ByRef hasPoints As Boolean) As String
    Dim i As Long
    Dim pointLine As String
    Dim tLines As String
    Dim head As String
    
    hasPoints = False
    tLines = ""
    For i = 2 To 14
        pointLine = CellNum(wsS4.Range("J" & i))
        If LenB(pointLine) > 0 Then hasPoints = True
        tLines = tLines & pointLine & vbCrLf
    Next i
    
    head = "DIEGRAPH2" & vbCrLf
    head = head & "[CURRENT]" & vbCrLf
    head = head & "item=" & CellText(wsS4.Range("B3")) & vbCrLf
    head = head & "mspec=" & CellText(wsS4.Range("D4")) & vbCrLf
    head = head & "min=" & CellNum(wsS4.Range("E6")) & vbCrLf
    head = head & "target=" & CellNum(wsS4.Range("F6")) & vbCrLf
    head = head & "max=" & CellNum(wsS4.Range("G6")) & vbCrLf
    head = head & "range=" & CellNum(wsS4.Range("G7")) & vbCrLf
    If hasPoints Then
        CurrentSection = head & tLines
    Else
        CurrentSection = head
    End If
End Function

Private Function Nz(ByVal v As Variant) As Variant
    If IsError(v) Then
        Nz = ""
    ElseIf IsNull(v) Then
        Nz = ""
    Else
        Nz = v
    End If
End Function

Private Function CellNum(ByVal cell As Range) As String
    Dim v As Variant
    v = cell.Value
    If IsError(v) Then Exit Function
    If IsEmpty(v) Or Trim$(CStr(v)) = "" Then Exit Function
    If IsNumeric(v) Then
        CellNum = LTrim$(Str$(CDbl(v)))
    Else
        CellNum = Trim$(CStr(v))
    End If
End Function

Private Function CellText(ByVal cell As Range) As String
    Dim v As Variant
    v = cell.Value
    If IsError(v) Then Exit Function
    If IsEmpty(v) Then Exit Function
    CellText = Trim$(CStr(v))
End Function

Attribute VB_Name = "CopyForGraphS1S3"
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
Private Const GRAPH_HTML As String = "G:\Shipping\100% Inspection Sheets\Production Folder\1 - Quality\centration.html"

' Import this module into the S1 S3 quality check workbook only.
' The S4 book uses CopyForGraph.bas — do not put both in the same file.
' Button name: Copy for Graph  (macro CopyForGraphS1S3.CopyForGraph)
' Copies current S1 S3 values, lookup specs from the same Master Sheet
' S1 S3 VLOOKUPs (Quality AIO / linked workbook, not the stale local copy),
' and the full Data S1 S3 TableS1S3 table as DIEGRAPH2 text for the HTML graph.
' History is tagged [TABLES4] so the same graph parser can ingest S4 and S1 S3.
' Internal CopyForGraphS1S3.bas is optional if you use CopyForGraphFromS1S3.bas from Personal.xlsb.
Public Sub CopyForGraph()
    Dim wsForm As Worksheet
    Dim payload As String
    Dim hasPoints As Boolean
    Dim tsvLookup As String
    Dim tsvTable As String
    
    On Error GoTo ErrHandler
    
    Set wsForm = SheetByName("S1 S3")
    If wsForm Is Nothing Then Set wsForm = ActiveSheet
    
    Application.Cursor = xlWait
    Application.StatusBar = "Copying for graph..."
    
    payload = CurrentSection(wsForm, hasPoints)
    
    Application.StatusBar = "Copying Quality AIO Master Sheet..."
    tsvLookup = LookupTableTsv()
    payload = payload & "[LOOKUP]" & vbCrLf
    If LenB(tsvLookup) > 0 Then
        payload = payload & tsvLookup & vbCrLf
    End If
    
    Application.StatusBar = "Copying TableS1S3..."
    tsvTable = ListObjectToTsv(TableS1S3ListObject())
    payload = payload & "[TABLES4]" & vbCrLf
    If LenB(tsvTable) > 0 Then
        payload = payload & tsvTable & vbCrLf
    End If
    
    PutTextOnClipboard payload
    OpenGraphHtml
    
    Application.StatusBar = "Copied for graph (current + lookup + TableS1S3)"
    Application.Cursor = xlDefault
    Exit Sub
    
ErrHandler:
    Application.Cursor = xlDefault
    Application.StatusBar = False
    MsgBox "Copy for graph failed: " & Err.Description, vbCritical, "Copy for Graph"
End Sub

Private Function GraphHtmlPath() As String
    Dim p As String
    p = GRAPH_HTML
    If FileExists(p) Then
        GraphHtmlPath = p
        Exit Function
    End If
    p = ThisWorkbook.Path & Application.PathSeparator & "centration.html"
    If FileExists(p) Then GraphHtmlPath = p
End Function

Private Function FileExists(ByVal p As String) As Boolean
    On Error Resume Next
    FileExists = (LenB(Trim$(p)) > 0 And LenB(Dir$(p, vbNormal)) > 0)
End Function

Private Sub OpenGraphHtml()
    Dim p As String
    Dim sh As Object
    p = GraphHtmlPath()
    If LenB(p) = 0 Then
        MsgBox "Copied for graph. Could not find:" & vbCrLf & GRAPH_HTML & vbCrLf & vbCrLf & "Open the graph and paste (Ctrl+V).", vbInformation, "Copy for Graph"
        Exit Sub
    End If
    On Error GoTo Fallback
    Set sh = CreateObject("WScript.Shell")
    sh.Run """" & p & """", 1, False
    Exit Sub
Fallback:
    On Error Resume Next
    ThisWorkbook.FollowHyperlink Address:=p, NewWindow:=True
End Sub

Private Function SheetByName(ByVal sheetName As String) As Worksheet
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0
    Set SheetByName = ws
End Function

Private Function TableS1S3ListObject() As ListObject
    Dim ws As Worksheet
    Dim lo As ListObject
    Set ws = SheetByName("Data S1 S3")
    If ws Is Nothing Then Exit Function
    On Error Resume Next
    Set lo = ws.ListObjects("TableS1S3")
    On Error GoTo 0
    If lo Is Nothing Then
        For Each lo In ws.ListObjects
            If StrComp(lo.Name, "TableS1S3", vbTextCompare) = 0 Or StrComp(lo.DisplayName, "TableS1S3", vbTextCompare) = 0 Then
                Set TableS1S3ListObject = lo
                Exit Function
            End If
        Next lo
    End If
    Set TableS1S3ListObject = lo
End Function

Private Function LookupTableTsv() As String
    Dim ws As Worksheet
    Dim lo As ListObject
    Dim tsv As String
    
    ' 1) Quality AIO (or whichever workbook S1 S3 VLOOKUPs) if it is already open
    Set ws = LinkedMasterSheetIfOpen()
    If Not ws Is Nothing Then
        Set lo = MspecListObject(ws)
        If Not lo Is Nothing Then
            LookupTableTsv = ListObjectToTsv(lo)
            If LenB(LookupTableTsv) > 0 Then Exit Function
        End If
    End If
    
    ' 2) Same [n]Master Sheet cache S1 S3 uses, so specs match E6/G6 even if AIO is closed
    tsv = LinkedMasterSheetToTsv()
    If LenB(tsv) > 0 Then
        LookupTableTsv = tsv
        Exit Function
    End If
    
    ' 3) Local Master Sheet Table7 (Quality AIO itself, or last-resort stale copy)
    Set lo = MspecListObject(SheetByName("Master Sheet"))
    LookupTableTsv = ListObjectToTsv(lo)
End Function

Private Function MspecListObject(ByVal ws As Worksheet) As ListObject
    Dim lo As ListObject
    Dim hdr As Range
    If ws Is Nothing Then Exit Function
    On Error Resume Next
    Set lo = ws.ListObjects("Table7")
    On Error GoTo 0
    If Not lo Is Nothing Then
        Set MspecListObject = lo
        Exit Function
    End If
    For Each lo In ws.ListObjects
        On Error Resume Next
        Set hdr = lo.HeaderRowRange
        On Error GoTo 0
        If Not hdr Is Nothing Then
            If HeaderHas(hdr, "MSPEC #") And HeaderHas(hdr, "Lower Control") And HeaderHas(hdr, "Upper Control") Then
                Set MspecListObject = lo
                Exit Function
            End If
        End If
    Next lo
End Function

Private Function LinkedMasterSheetIfOpen() As Worksheet
    Dim wb As Workbook
    Dim ws As Worksheet
    Dim links As Variant
    Dim i As Long
    Dim p As String
    Dim fname As String
    
    On Error Resume Next
    links = ThisWorkbook.LinkSources(xlExcelLinks)
    On Error GoTo 0
    If Not IsArray(links) Then Exit Function
    
    For i = LBound(links) To UBound(links)
        p = CStr(links(i))
        fname = LinkFileName(p)
        For Each wb In Application.Workbooks
            If WorkbookMatchesLink(wb, p, fname) Then
                On Error Resume Next
                Set ws = wb.Worksheets("Master Sheet")
                On Error GoTo 0
                If Not ws Is Nothing Then
                    Set LinkedMasterSheetIfOpen = ws
                    Exit Function
                End If
            End If
        Next wb
    Next i
End Function

Private Function WorkbookMatchesLink(ByVal wb As Workbook, ByVal linkPath As String, ByVal fname As String) As Boolean
    If wb Is Nothing Then Exit Function
    If StrComp(wb.Name, ThisWorkbook.Name, vbTextCompare) = 0 Then Exit Function
    If LenB(fname) > 0 Then
        If StrComp(wb.Name, fname, vbTextCompare) = 0 Then
            WorkbookMatchesLink = True
            Exit Function
        End If
    End If
    If InStr(1, linkPath, wb.Name, vbTextCompare) > 0 Then WorkbookMatchesLink = True
End Function

Private Function LinkFileName(ByVal p As String) As String
    Dim s As String
    Dim i As Long
    s = Replace(Replace(p, "%20", " "), "/", "\")
    i = InStrRev(s, "\")
    If i > 0 Then s = Mid$(s, i + 1)
    LinkFileName = s
End Function

' S1 S3 E6 is VLOOKUP(D4,'[1]Master Sheet'!A:D,4,FALSE) — copy that same sheet.
Private Function MasterSheetBookRef() As String
    Dim f As String
    Dim ws As Worksheet
    Dim i As Long
    Dim j As Long
    
    Set ws = SheetByName("S1 S3")
    If ws Is Nothing Then
        MasterSheetBookRef = "'[1]Master Sheet'"
        Exit Function
    End If
    f = CStr(ws.Range("E6").Formula)
    i = InStr(1, f, "Master Sheet", vbTextCompare)
    If i = 0 Then
        MasterSheetBookRef = "'Master Sheet'"
        Exit Function
    End If
    j = i
    Do While j > 1 And Mid$(f, j, 1) <> "'"
        j = j - 1
    Loop
    If Mid$(f, j, 1) = "'" Then
        MasterSheetBookRef = Mid$(f, j, i + 12 - j)
    Else
        MasterSheetBookRef = "'Master Sheet'"
    End If
End Function

Private Function LinkedMasterSheetToTsv() As String
    Dim ref As String
    Dim r As Long
    Dim c As Long
    Dim nC As Long
    Dim nLines As Long
    Dim v As Variant
    Dim lines() As String
    Dim parts() As String
    Dim evalWs As Worksheet
    
    ref = MasterSheetBookRef()
    If InStr(1, ref, "[", vbBinaryCompare) = 0 Then Exit Function
    
    Set evalWs = SheetByName("S1 S3")
    If evalWs Is Nothing Then Set evalWs = ActiveSheet
    
    nC = 0
    For c = 1 To 22
        v = EvalLinkedIndex(evalWs, ref, 1, c)
        If IsBlankLink(v) Then Exit For
        nC = c
    Next c
    If nC < 6 Then Exit Function
    
    ReDim lines(1 To 200)
    For r = 1 To 200
        v = EvalLinkedIndex(evalWs, ref, r, 1)
        If r > 1 Then
            If IsBlankLink(v) Then Exit For
            If Not IsNumeric(v) Then Exit For
        End If
        ReDim parts(1 To nC)
        For c = 1 To nC
            If c = 1 And r > 1 Then
                parts(c) = TsvEscape(v)
            Else
                parts(c) = TsvEscape(EvalLinkedIndex(evalWs, ref, r, c))
            End If
        Next c
        nLines = nLines + 1
        lines(nLines) = Join(parts, vbTab)
    Next r
    If nLines < 2 Then Exit Function
    ReDim Preserve lines(1 To nLines)
    LinkedMasterSheetToTsv = Join(lines, vbCrLf)
End Function

Private Function EvalLinkedIndex(ByVal ws As Worksheet, ByVal bookRef As String, ByVal r As Long, ByVal c As Long) As Variant
    Dim expr As String
    expr = "INDEX(" & bookRef & "!A:V," & r & "," & c & ")"
    On Error Resume Next
    If Not ws Is Nothing Then
        EvalLinkedIndex = ws.Evaluate(expr)
    Else
        EvalLinkedIndex = Application.Evaluate(expr)
    End If
End Function

Private Function IsBlankLink(ByVal v As Variant) As Boolean
    If IsError(v) Then
        IsBlankLink = True
    ElseIf IsNull(v) Or IsEmpty(v) Then
        IsBlankLink = True
    ElseIf LenB(Trim$(CStr(v))) = 0 Then
        IsBlankLink = True
    End If
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
        Case vbSingle, vbDouble, vbCurrency, vbDecimal
            If Abs(CDbl(v) - Round(CDbl(v), 0)) < 0.0000001 Then
                TsvEscape = CStr(CLng(Round(CDbl(v), 0)))
            Else
                TsvEscape = LTrim$(Str$(CDbl(v)))
            End If
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

Private Function CurrentSection(ByVal wsForm As Worksheet, ByRef hasPoints As Boolean) As String
    Dim i As Long
    Dim pointLine As String
    Dim tLines As String
    Dim head As String
    
    hasPoints = False
    tLines = ""
    For i = 2 To 14
        pointLine = CellNum(wsForm.Range("J" & i))
        If LenB(pointLine) > 0 Then hasPoints = True
        tLines = tLines & pointLine & vbCrLf
    Next i
    
    head = "DIEGRAPH2" & vbCrLf
    head = head & "[CURRENT]" & vbCrLf
    head = head & "source=S1S3" & vbCrLf
    head = head & "item=" & CellText(wsForm.Range("B3")) & vbCrLf
    head = head & "mspec=" & CellText(wsForm.Range("D4")) & vbCrLf
    head = head & "line=" & CellText(wsForm.Range("B2")) & vbCrLf
    head = head & "min=" & CellNum(wsForm.Range("E6")) & vbCrLf
    head = head & "target=" & CellNum(wsForm.Range("F6")) & vbCrLf
    head = head & "max=" & CellNum(wsForm.Range("G6")) & vbCrLf
    head = head & "range=" & CellNum(wsForm.Range("G7")) & vbCrLf
    head = head & "densMin=" & CellNum(wsForm.Range("E9")) & vbCrLf
    head = head & "densTarget=" & CellNum(wsForm.Range("F9")) & vbCrLf
    head = head & "densMax=" & CellNum(wsForm.Range("G9")) & vbCrLf
    head = head & "cellMin=" & CellNum(wsForm.Range("G10")) & vbCrLf
    head = head & "widthMin=" & CellNum(wsForm.Range("E11")) & vbCrLf
    head = head & "widthTarget=" & CellText(wsForm.Range("F11")) & vbCrLf
    head = head & "width=" & CellNum(wsForm.Range("B5")) & vbCrLf
    head = head & "widthPf=" & CellText(wsForm.Range("C5")) & vbCrLf
    head = head & "cellMd=" & CellNum(wsForm.Range("B10")) & vbCrLf
    head = head & "cellMdPf=" & CellText(wsForm.Range("C10")) & vbCrLf
    head = head & "cellCd=" & CellNum(wsForm.Range("B11")) & vbCrLf
    head = head & "cellCdPf=" & CellText(wsForm.Range("C11")) & vbCrLf
    head = head & "density=" & CellNum(wsForm.Range("B14")) & vbCrLf
    head = head & "densityPf=" & CellText(wsForm.Range("C14")) & vbCrLf
    head = head & "avg=" & CellNum(wsForm.Range("B12")) & vbCrLf
    head = head & "avgPf=" & CellText(wsForm.Range("C12")) & vbCrLf
    head = head & "tRange=" & CellNum(wsForm.Range("B13")) & vbCrLf
    head = head & "tRangePf=" & CellText(wsForm.Range("C13")) & vbCrLf
    head = head & "weight=" & CellNum(wsForm.Range("L2")) & vbCrLf
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

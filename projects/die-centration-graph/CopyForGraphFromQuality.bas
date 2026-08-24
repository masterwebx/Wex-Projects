Attribute VB_Name = "CopyForGraphFromQuality"
Option Explicit

' Import into Personal.xlsb or a launcher workbook — NOT into S4.xlsm,
' S1 S3.xlsm, Bubble.xlsm, P1.xlsm, or RTS.xlsm.
' One paste from the quality Files folder: copies S4.xlsm, S1 S3.xlsm,
' Bubble.xlsm, P1.xlsm, and RTS.xlsm into %TEMP%, opens those copies
' hidden (macros disabled), builds one DIEGRAPH2 payload with all
' history tables, then closes and deletes the temp copies. Never
' writes into the quality Files folder (Permission denied on G:).
' If a book is already open, uses that workbook and does not close
' it. No macro inside the quality workbooks is used.
'
' Button: CopyForGraphFromQuality.CopyForGraphFromQuality
' [CURRENT] comes from the active foam sheet (S4 or S1 S3) when one
' is in front. [TABLES4] / [TABLES1S3] are Extrusion Foam history.
' [TABLESBUBBLE] is Extrusion Bubble, [TABLESP1] is P1, [TABLESRTS]
' is RTS. CopyForGraphFromS4 and CopyForGraphFromS1S3 remain as
' aliases. If you previously imported CopyForGraphFromS4.bas and
' CopyForGraphFromS1S3.bas, remove those modules first so the public
' Sub names are not duplicated.



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

Private Const SOURCE_S4 As String = "G:\Shipping\100% Inspection Sheets\Production Folder\1 - Quality\Files\S4.xlsm"
Private Const SOURCE_S1S3 As String = "G:\Shipping\100% Inspection Sheets\Production Folder\1 - Quality\Files\S1 S3.xlsm"
Private Const SOURCE_BUBBLE As String = "G:\Shipping\100% Inspection Sheets\Production Folder\1 - Quality\Files\Bubble.xlsm"
Private Const SOURCE_P1 As String = "G:\Shipping\100% Inspection Sheets\Production Folder\1 - Quality\Files\P1.xlsm"
Private Const SOURCE_RTS As String = "G:\Shipping\100% Inspection Sheets\Production Folder\1 - Quality\Files\RTS.xlsm"

Private dataWb As Workbook
Private openedByLauncher As Boolean
Private copyPathToDelete As String
Private sourceKind As String
Private wbS4 As Workbook
Private wbS1 As Workbook
Private wbBubble As Workbook
Private wbP1 As Workbook
Private wbRts As Workbook
Private openedS4 As Boolean
Private openedS1 As Boolean
Private openedBubble As Boolean
Private openedP1 As Boolean
Private openedRts As Boolean
Private pathS4 As String
Private pathS1 As String
Private pathBubble As String
Private pathP1 As String
Private pathRts As String

Public Sub CopyForGraphFromQuality()
    CopyForGraphFromBothBooks
End Sub

Public Sub CopyForGraphFromS4()
    CopyForGraphFromBothBooks
End Sub

Public Sub CopyForGraphFromS1S3()
    CopyForGraphFromBothBooks
End Sub

Private Sub CopyForGraphFromBothBooks()
    Dim prevSU As Boolean
    Dim prevEA As Boolean
    Dim prevDA As Boolean
    Dim prevCur As XlMousePointer
    Dim prevSec As MsoAutomationSecurity
    Dim errMsg As String
    
    On Error GoTo ErrHandler
    
    openedByLauncher = False
    copyPathToDelete = vbNullString
    Set dataWb = Nothing
    Set wbS4 = Nothing
    Set wbS1 = Nothing
    Set wbBubble = Nothing
    Set wbP1 = Nothing
    Set wbRts = Nothing
    openedS4 = False
    openedS1 = False
    openedBubble = False
    openedP1 = False
    openedRts = False
    pathS4 = vbNullString
    pathS1 = vbNullString
    pathBubble = vbNullString
    pathP1 = vbNullString
    pathRts = vbNullString
    sourceKind = vbNullString
    
    prevSU = Application.ScreenUpdating
    prevEA = Application.EnableEvents
    prevDA = Application.DisplayAlerts
    prevCur = Application.Cursor
    prevSec = Application.AutomationSecurity
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.DisplayAlerts = False
    Application.Cursor = xlWait
    
    AcquireSource "S4"
    AcquireSource "S1S3"
    AcquireSource "BUBBLE"
    AcquireSource "P1"
    AcquireSource "RTS"
    
    If wbS4 Is Nothing And wbS1 Is Nothing And wbBubble Is Nothing And wbP1 Is Nothing And wbRts Is Nothing Then
        RestoreApp prevSU, prevEA, prevDA, prevCur, prevSec
        Application.Cursor = xlDefault
        Application.StatusBar = False
        MsgBox "Could not find any quality workbooks:" & vbCrLf & SOURCE_S4 & vbCrLf & SOURCE_S1S3 & vbCrLf & SOURCE_BUBBLE & vbCrLf & SOURCE_P1 & vbCrLf & SOURCE_RTS, vbCritical, "Copy for Graph"
        Exit Sub
    End If
    
    Application.EnableEvents = True
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    Application.AutomationSecurity = prevSec
    
    CopyForGraphFromOpenCopies
    
    ReleaseAll
    RestoreApp prevSU, prevEA, prevDA, prevCur, prevSec
    Application.StatusBar = "Copied for graph from quality sheets"
    Exit Sub
    
ErrHandler:
    errMsg = Err.Description
    On Error Resume Next
    ReleaseAll
    RestoreApp prevSU, prevEA, prevDA, prevCur, prevSec
    Application.Cursor = xlDefault
    Application.StatusBar = False
    MsgBox "Copy for graph failed: " & errMsg, vbCritical, "Copy for Graph"
End Sub

Private Function AcquireSource(ByVal kind As String) As Workbook
    Dim src As String
    Dim dest As String
    Dim wb As Workbook
    Dim opened As Boolean
    Dim copyPath As String
    
    src = SourcePathForKind(kind)
    Set wb = OpenWorkbookByKind(kind)
    If wb Is Nothing Then
        If FileExists(src) Then
            dest = TempCopyPath(LCase$(kind))
            Application.AutomationSecurity = msoAutomationSecurityForceDisable
            If CopyWorkbookFile(src, dest) Then
                copyPath = dest
                Application.StatusBar = "Opening a silent copy of " & SourceFileName(src) & "..."
                Set wb = Workbooks.Open(Filename:=dest, UpdateLinks:=0, ReadOnly:=True, AddToMru:=False, IgnoreReadOnlyRecommended:=True)
                opened = True
                HideWorkbookWindows wb
            Else
                Application.StatusBar = "Opening " & SourceFileName(src) & " read-only..."
                Set wb = Workbooks.Open(Filename:=src, UpdateLinks:=0, ReadOnly:=True, AddToMru:=False, IgnoreReadOnlyRecommended:=True)
                opened = True
                HideWorkbookWindows wb
            End If
        End If
    Else
        Application.StatusBar = "Using already-open " & wb.Name
    End If
    
    Select Case UCase$(kind)
        Case "S1S3"
            Set wbS1 = wb
            openedS1 = opened
            pathS1 = copyPath
        Case "BUBBLE"
            Set wbBubble = wb
            openedBubble = opened
            pathBubble = copyPath
        Case "P1"
            Set wbP1 = wb
            openedP1 = opened
            pathP1 = copyPath
        Case "RTS"
            Set wbRts = wb
            openedRts = opened
            pathRts = copyPath
        Case Else
            Set wbS4 = wb
            openedS4 = opened
            pathS4 = copyPath
    End Select
    If opened Then
        openedByLauncher = True
        If LenB(copyPathToDelete) = 0 Then copyPathToDelete = copyPath
    End If
    Set AcquireSource = wb
End Function

Private Sub UseBook(ByVal wb As Workbook, ByVal kind As String)
    Set dataWb = wb
    sourceKind = kind
End Sub

Private Function BookForKind(ByVal kind As String) As Workbook
    Select Case UCase$(kind)
        Case "S1S3"
            Set BookForKind = wbS1
        Case "BUBBLE"
            Set BookForKind = wbBubble
        Case "P1"
            Set BookForKind = wbP1
        Case "RTS"
            Set BookForKind = wbRts
        Case Else
            Set BookForKind = wbS4
    End Select
End Function

Private Function PreferredCurrentKind() As String
    Dim kind As String
    On Error Resume Next
    kind = DetectKindFromWorkbook(Application.ActiveWorkbook)
    On Error GoTo 0
    If StrComp(kind, "S1S3", vbTextCompare) = 0 And Not wbS1 Is Nothing Then
        PreferredCurrentKind = "S1S3"
        Exit Function
    End If
    If StrComp(kind, "S4", vbTextCompare) = 0 And Not wbS4 Is Nothing Then
        PreferredCurrentKind = "S4"
        Exit Function
    End If
    If Not wbS4 Is Nothing Then
        PreferredCurrentKind = "S4"
    ElseIf Not wbS1 Is Nothing Then
        PreferredCurrentKind = "S1S3"
    End If
End Function

Private Function SourcePathForKind(ByVal kind As String) As String
    Select Case UCase$(kind)
        Case "S1S3"
            SourcePathForKind = SOURCE_S1S3
        Case "BUBBLE"
            SourcePathForKind = SOURCE_BUBBLE
        Case "P1"
            SourcePathForKind = SOURCE_P1
        Case "RTS"
            SourcePathForKind = SOURCE_RTS
        Case Else
            SourcePathForKind = SOURCE_S4
    End Select
End Function

Private Function IsS1S3() As Boolean
    IsS1S3 = (StrComp(sourceKind, "S1S3", vbTextCompare) = 0)
End Function

Private Function FormSheetName() As String
    If IsS1S3() Then
        FormSheetName = "S1 S3"
    Else
        FormSheetName = "S4"
    End If
End Function

Private Function DetectKindFromWorkbook(ByVal wb As Workbook) As String
    Dim hasS4 As Boolean
    Dim hasS1 As Boolean
    Dim sheetName As String
    
    If IsIgnoredWorkbook(wb) Then Exit Function
    
    If WorkbookHasSheet(wb, "Bubble") And WorkbookHasSheet(wb, "Data Bubble") Then
        DetectKindFromWorkbook = "BUBBLE"
        Exit Function
    End If
    If WorkbookHasSheet(wb, "P1") And WorkbookHasSheet(wb, "Data P1") Then
        DetectKindFromWorkbook = "P1"
        Exit Function
    End If
    If WorkbookHasSheet(wb, "RTS") And WorkbookHasSheet(wb, "Data RTS") Then
        DetectKindFromWorkbook = "RTS"
        Exit Function
    End If
    
    hasS4 = WorkbookHasSheet(wb, "S4") And WorkbookHasSheet(wb, "Data S4")
    hasS1 = WorkbookHasSheet(wb, "S1 S3") And WorkbookHasSheet(wb, "Data S1 S3")
    If hasS4 And Not hasS1 Then
        DetectKindFromWorkbook = "S4"
        Exit Function
    End If
    If hasS1 And Not hasS4 Then
        DetectKindFromWorkbook = "S1S3"
        Exit Function
    End If
    If hasS4 And hasS1 Then
        On Error Resume Next
        sheetName = wb.ActiveSheet.Name
        On Error GoTo 0
        If StrComp(sheetName, "S1 S3", vbTextCompare) = 0 Or StrComp(sheetName, "Data S1 S3", vbTextCompare) = 0 Then
            DetectKindFromWorkbook = "S1S3"
        Else
            DetectKindFromWorkbook = "S4"
        End If
        Exit Function
    End If
    If StrComp(wb.Name, "S4.xlsm", vbTextCompare) = 0 Then
        DetectKindFromWorkbook = "S4"
        Exit Function
    End If
    If StrComp(wb.Name, "S1 S3.xlsm", vbTextCompare) = 0 Then
        DetectKindFromWorkbook = "S1S3"
        Exit Function
    End If
    If StrComp(wb.Name, "Bubble.xlsm", vbTextCompare) = 0 Then
        DetectKindFromWorkbook = "BUBBLE"
        Exit Function
    End If
    If StrComp(wb.Name, "P1.xlsm", vbTextCompare) = 0 Then
        DetectKindFromWorkbook = "P1"
        Exit Function
    End If
    If StrComp(wb.Name, "RTS.xlsm", vbTextCompare) = 0 Then
        DetectKindFromWorkbook = "RTS"
    End If
End Function

Private Function WorkbookHasSheet(ByVal wb As Workbook, ByVal sheetName As String) As Boolean
    Dim ws As Worksheet
    If wb Is Nothing Then Exit Function
    On Error Resume Next
    Set ws = wb.Worksheets(sheetName)
    On Error GoTo 0
    WorkbookHasSheet = Not ws Is Nothing
End Function

Private Function IsIgnoredWorkbook(ByVal wb As Workbook) As Boolean
    Dim n As String
    If wb Is Nothing Then
        IsIgnoredWorkbook = True
        Exit Function
    End If
    n = wb.Name
    If StrComp(n, ThisWorkbook.Name, vbTextCompare) = 0 Then
        IsIgnoredWorkbook = True
        Exit Function
    End If
    If InStr(1, n, "PERSONAL", vbTextCompare) > 0 Then
        IsIgnoredWorkbook = True
        Exit Function
    End If
    If StrComp(Left$(n, 9), "diegraph_", vbTextCompare) = 0 Then
        IsIgnoredWorkbook = True
    End If
End Function

Private Function OpenWorkbookByKind(ByVal kind As String) As Workbook
    Dim wb As Workbook
    Set OpenWorkbookByKind = AlreadyOpenWorkbook(SourcePathForKind(kind))
    If Not OpenWorkbookByKind Is Nothing Then Exit Function
    For Each wb In Application.Workbooks
        If StrComp(DetectKindFromWorkbook(wb), kind, vbTextCompare) = 0 Then
            Set OpenWorkbookByKind = wb
            Exit Function
        End If
    Next wb
End Function

Private Function WorkbookPath(ByVal wb As Workbook) As String
    On Error Resume Next
    If wb Is Nothing Then Exit Function
    WorkbookPath = wb.FullName
    If LenB(WorkbookPath) = 0 Then WorkbookPath = wb.Name
End Function

Private Function NewerFile(ByVal a As String, ByVal b As String) As Boolean
    NewerFile = (FileTime(a) > FileTime(b))
End Function

Private Function FileTime(ByVal p As String) As Double
    On Error Resume Next
    If FileExists(p) Then FileTime = CDbl(FileDateTime(p))
End Function

Private Sub CopyForGraphFromOpenCopies()
    Dim wsForm As Worksheet
    Dim payload As String
    Dim hasPoints As Boolean
    Dim tsvLookup As String
    Dim tsvS4 As String
    Dim tsvS1 As String
    Dim tsvBubble As String
    Dim tsvP1 As String
    Dim tsvRts As String
    Dim preferred As String
    
    On Error GoTo CopyErr
    
    preferred = PreferredCurrentKind()
    UseBook BookForKind(preferred), preferred
    
    Set wsForm = SheetByName(FormSheetName())
    If wsForm Is Nothing Then
        If Not TargetWorkbook Is Nothing Then Set wsForm = TargetWorkbook.Worksheets(1)
    End If
    
    Application.Cursor = xlWait
    Application.StatusBar = "Copying for graph..."
    
    If Not wsForm Is Nothing Then
        payload = CurrentSection(wsForm, hasPoints)
    Else
        payload = "DIEGRAPH2" & vbCrLf & "[CURRENT]" & vbCrLf
    End If
    
    Application.StatusBar = "Copying Quality AIO Master Sheet..."
    tsvLookup = LookupTableTsv()
    payload = payload & "[LOOKUP]" & vbCrLf
    If LenB(tsvLookup) > 0 Then
        payload = payload & tsvLookup & vbCrLf
    End If
    
    If Not wbS4 Is Nothing Then
        UseBook wbS4, "S4"
        Application.StatusBar = "Copying TableS4..."
        tsvS4 = ListObjectToTsv(HistoryListObject())
    End If
    If Not wbS1 Is Nothing Then
        UseBook wbS1, "S1S3"
        Application.StatusBar = "Copying TableS1S3..."
        tsvS1 = ListObjectToTsv(HistoryListObject())
    End If
    If Not wbBubble Is Nothing Then
        UseBook wbBubble, "BUBBLE"
        Application.StatusBar = "Copying TableBubble..."
        tsvBubble = ListObjectToTsv(HistoryListObject())
    End If
    If Not wbP1 Is Nothing Then
        UseBook wbP1, "P1"
        Application.StatusBar = "Copying TableP1..."
        tsvP1 = ListObjectToTsv(HistoryListObject())
    End If
    If Not wbRts Is Nothing Then
        UseBook wbRts, "RTS"
        Application.StatusBar = "Copying TableRTS..."
        tsvRts = ListObjectToTsv(HistoryListObject())
    End If
    
    payload = payload & "[TABLES4]" & vbCrLf
    If LenB(tsvS4) > 0 Then payload = payload & tsvS4 & vbCrLf
    payload = payload & "[TABLES1S3]" & vbCrLf
    If LenB(tsvS1) > 0 Then payload = payload & tsvS1 & vbCrLf
    payload = payload & "[TABLESBUBBLE]" & vbCrLf
    If LenB(tsvBubble) > 0 Then payload = payload & tsvBubble & vbCrLf
    payload = payload & "[TABLESP1]" & vbCrLf
    If LenB(tsvP1) > 0 Then payload = payload & tsvP1 & vbCrLf
    payload = payload & "[TABLESRTS]" & vbCrLf
    If LenB(tsvRts) > 0 Then payload = payload & tsvRts & vbCrLf
    
    PutTextOnClipboard payload
    OpenGraphHtml
    
    Application.StatusBar = "Copied for graph (current + lookup + all quality tables)"
    Application.Cursor = xlDefault
    Exit Sub
    
CopyErr:
    Application.Cursor = xlDefault
    Application.StatusBar = False
    MsgBox "Copy for graph failed: " & Err.Description, vbCritical, "Copy for Graph"
End Sub

Private Function TargetWorkbook() As Workbook
    If Not dataWb Is Nothing Then
        Set TargetWorkbook = dataWb
    Else
        Set TargetWorkbook = ThisWorkbook
    End If
End Function

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
    Set ws = TargetWorkbook.Worksheets(sheetName)
    On Error GoTo 0
    Set SheetByName = ws
End Function

Private Function HistoryListObject() As ListObject
    Dim ws As Worksheet
    Dim lo As ListObject
    Dim sheetName As String
    Dim tableName As String
    
    Select Case UCase$(sourceKind)
        Case "S1S3"
            sheetName = "Data S1 S3"
            tableName = "TableS1S3"
        Case "BUBBLE"
            sheetName = "Data Bubble"
            tableName = "TableBubble"
        Case "P1"
            sheetName = "Data P1"
            tableName = "TableP1"
        Case "RTS"
            sheetName = "Data RTS"
            tableName = "TableRTS"
        Case Else
            sheetName = "Data S4"
            tableName = "TableS4"
    End Select
    
    Set ws = SheetByName(sheetName)
    If ws Is Nothing Then Exit Function
    On Error Resume Next
    Set lo = ws.ListObjects(tableName)
    On Error GoTo 0
    If lo Is Nothing Then
        For Each lo In ws.ListObjects
            If StrComp(lo.Name, tableName, vbTextCompare) = 0 Or StrComp(lo.DisplayName, tableName, vbTextCompare) = 0 Then
                Set HistoryListObject = lo
                Exit Function
            End If
        Next lo
    End If
    Set HistoryListObject = lo
End Function

Private Function LookupTableTsv() As String
    Dim ws As Worksheet
    Dim tsv As String
    Dim aioWb As Workbook
    Dim openedAio As Boolean
    
    ' VLOOKUPs read Quality AIO Master Sheet (density is K/L/M). The local
    ' Master Sheet copy is stale and usually has empty density columns.
    Set aioWb = FindOrOpenQualityAio(openedAio)
    If Not aioWb Is Nothing Then
        On Error Resume Next
        Set ws = aioWb.Worksheets("Master Sheet")
        On Error GoTo 0
        tsv = MasterSheetRangeToTsv(ws)
        If LookupTsvHasDensity(tsv) Then
            LookupTableTsv = tsv
            GoTo DoneLookup
        End If
        If LenB(tsv) > 0 Then LookupTableTsv = tsv
    End If
    
    Set ws = BestOpenMasterSheet()
    tsv = MasterSheetRangeToTsv(ws)
    If LookupTsvHasDensity(tsv) Then
        LookupTableTsv = tsv
        GoTo DoneLookup
    End If
    If LenB(LookupTableTsv) = 0 And LenB(tsv) > 0 Then LookupTableTsv = tsv
    
    tsv = LinkedMasterSheetToTsv()
    If LookupTsvHasDensity(tsv) Then
        LookupTableTsv = tsv
        GoTo DoneLookup
    End If
    If LenB(LookupTableTsv) = 0 And LenB(tsv) > 0 Then LookupTableTsv = tsv
    
    If LenB(LookupTableTsv) = 0 Then
        LookupTableTsv = MasterSheetRangeToTsv(SheetByName("Master Sheet"))
    End If
    
DoneLookup:
    If openedAio Then
        On Error Resume Next
        aioWb.Close SaveChanges:=False
        On Error GoTo 0
    End If
End Function

Private Function IsAioWorkbookName(ByVal n As String) As Boolean
    IsAioWorkbookName = (InStr(1, n, "Quality AIO", vbTextCompare) > 0)
End Function

Private Function HostLinkSources() As Variant
    On Error Resume Next
    If Not TargetWorkbook Is Nothing Then
        HostLinkSources = TargetWorkbook.LinkSources(xlExcelLinks)
    End If
    If IsEmpty(HostLinkSources) Then HostLinkSources = ThisWorkbook.LinkSources(xlExcelLinks)
End Function

Private Function FindOrOpenQualityAio(ByRef opened As Boolean) As Workbook
    Dim wb As Workbook
    Dim links As Variant
    Dim i As Long
    Dim p As String
    Dim fname As String
    
    opened = False
    For Each wb In Application.Workbooks
        If IsAioWorkbookName(wb.Name) Then
            Set FindOrOpenQualityAio = wb
            Exit Function
        End If
    Next wb
    
    links = HostLinkSources()
    If Not IsArray(links) Then Exit Function
    
    For i = LBound(links) To UBound(links)
        p = CStr(links(i))
        fname = LinkFileName(p)
        If IsAioWorkbookName(fname) Or InStr(1, p, "Quality AIO", vbTextCompare) > 0 Or InStr(1, p, "Quality%20AIO", vbTextCompare) > 0 Then
            For Each wb In Application.Workbooks
                If WorkbookMatchesLink(wb, p, fname) Then
                    Set FindOrOpenQualityAio = wb
                    Exit Function
                End If
            Next wb
            On Error Resume Next
            Set wb = Workbooks.Open(Filename:=p, UpdateLinks:=0, ReadOnly:=True, IgnoreReadOnlyRecommended:=True, AddToMru:=False)
            On Error GoTo 0
            If Not wb Is Nothing Then
                opened = True
                Set FindOrOpenQualityAio = wb
                Exit Function
            End If
        End If
    Next i
End Function

Private Function BestOpenMasterSheet() As Worksheet
    Dim wb As Workbook
    Dim ws As Worksheet
    Dim best As Worksheet
    Dim bestScore As Long
    Dim score As Long
    
    bestScore = -1
    For Each wb In Application.Workbooks
        If StrComp(wb.Name, ThisWorkbook.Name, vbTextCompare) = 0 Then GoTo NextBest
        If Not dataWb Is Nothing Then
            If StrComp(wb.Name, dataWb.Name, vbTextCompare) = 0 Then GoTo NextBest
        End If
        On Error Resume Next
        Set ws = wb.Worksheets("Master Sheet")
        On Error GoTo 0
        If Not ws Is Nothing Then
            If Not MspecListObject(ws) Is Nothing Then
                score = ScoreMasterSheet(ws)
                If score > bestScore Then
                    bestScore = score
                    Set best = ws
                End If
            End If
        End If
        Set ws = Nothing
NextBest:
    Next wb
    Set BestOpenMasterSheet = best
End Function

Private Function ScoreMasterSheet(ByVal ws As Worksheet) As Long
    Dim lo As ListObject
    Dim hdr As Range
    Dim densCol As Long
    Dim r As Long
    Dim n As Long
    
    If ws Is Nothing Then Exit Function
    If IsAioWorkbookName(ws.Parent.Name) Then ScoreMasterSheet = 10000
    Set lo = MspecListObject(ws)
    If lo Is Nothing Then Exit Function
    Set hdr = lo.HeaderRowRange
    For n = 1 To hdr.Columns.Count
        If StrComp(Trim$(CStr(Nz(hdr.Cells(1, n).Value))), "Density Target", vbTextCompare) = 0 Then
            densCol = n
            Exit For
        End If
    Next n
    If densCol = 0 Or lo.DataBodyRange Is Nothing Then Exit Function
    For r = 1 To Application.Min(lo.DataBodyRange.Rows.Count, 120)
        If Not IsBlankLink(lo.DataBodyRange.Cells(r, densCol).Value) Then
            ScoreMasterSheet = ScoreMasterSheet + 1
        End If
    Next r
End Function

Private Function LookupTsvHasDensity(ByVal tsv As String) As Boolean
    Dim lines() As String
    Dim heads() As String
    Dim parts() As String
    Dim i As Long
    Dim densIdx As Long
    Dim n As Long
    Dim v As Double
    
    If LenB(tsv) = 0 Then Exit Function
    lines = Split(tsv, vbCrLf)
    If UBound(lines) < 1 Then Exit Function
    heads = Split(lines(0), vbTab)
    densIdx = -1
    For i = LBound(heads) To UBound(heads)
        If StrComp(Trim$(heads(i)), "Density Target", vbTextCompare) = 0 Then
            densIdx = i
            Exit For
        End If
    Next i
    If densIdx < 0 Then Exit Function
    For i = 1 To UBound(lines)
        If LenB(lines(i)) = 0 Then GoTo NextDensLine
        parts = Split(lines(i), vbTab)
        If UBound(parts) >= densIdx Then
            If LenB(Trim$(parts(densIdx))) > 0 And IsNumeric(parts(densIdx)) Then
                v = CDbl(parts(densIdx))
                If v > 0 And Abs(v - 1) > 0.02 Then n = n + 1
            End If
        End If
NextDensLine:
    Next i
    LookupTsvHasDensity = (n >= 8)
End Function

Private Function FindMspecHeaderRow(ByVal ws As Worksheet) As Long
    Dim r As Long
    If ws Is Nothing Then Exit Function
    For r = 1 To 12
        If StrComp(Trim$(CStr(Nz(ws.Cells(r, 1).Value))), "MSPEC #", vbTextCompare) = 0 Then
            FindMspecHeaderRow = r
            Exit Function
        End If
    Next r
End Function

Private Function MasterSheetRangeToTsv(ByVal ws As Worksheet) As String
    Dim lo As ListObject
    Dim hdrRow As Long
    Dim firstCol As Long
    Dim lastCol As Long
    Dim lastRow As Long
    Dim c As Long
    Dim nC As Long
    
    If ws Is Nothing Then Exit Function
    Set lo = MspecListObject(ws)
    If Not lo Is Nothing Then
        hdrRow = lo.HeaderRowRange.Row
        firstCol = lo.Range.Column
        lastCol = lo.Range.Column + lo.Range.Columns.Count - 1
        lastRow = lo.Range.Row + lo.Range.Rows.Count - 1
    Else
        hdrRow = FindMspecHeaderRow(ws)
        If hdrRow = 0 Then Exit Function
        firstCol = 1
        lastCol = 17
        On Error Resume Next
        lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
        On Error GoTo 0
    End If
    
    nC = 0
    For c = 1 To 60
        If Not IsBlankLink(ws.Cells(hdrRow, c).Value) Then nC = c
    Next c
    If nC > lastCol Then lastCol = nC
    If lastCol > 60 Then lastCol = 60
    If lastRow <= hdrRow Or lastCol < 6 Then Exit Function
    MasterSheetRangeToTsv = RangeToTsv(ws.Range(ws.Cells(hdrRow, firstCol), ws.Cells(lastRow, lastCol)))
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

Private Function WorkbookMatchesLink(ByVal wb As Workbook, ByVal linkPath As String, ByVal fname As String) As Boolean
    If wb Is Nothing Then Exit Function
    If StrComp(wb.Name, ThisWorkbook.Name, vbTextCompare) = 0 Then Exit Function
    If Not dataWb Is Nothing Then If StrComp(wb.Name, dataWb.Name, vbTextCompare) = 0 Then Exit Function
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

' Form E6 is VLOOKUP(D4,'[1]Master Sheet'!A:D,4,FALSE) — copy that same sheet.
Private Function MasterSheetBookRef() As String
    Dim f As String
    Dim ws As Worksheet
    Dim i As Long
    Dim j As Long
    
    Set ws = SheetByName(FormSheetName())
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
    Dim blankRun As Long
    Dim v As Variant
    Dim lines() As String
    Dim parts() As String
    Dim evalWs As Worksheet
    
    ref = MasterSheetBookRef()
    If InStr(1, ref, "[", vbBinaryCompare) = 0 Then Exit Function
    
    Set evalWs = SheetByName(FormSheetName())
    If evalWs Is Nothing Then Set evalWs = TargetWorkbook.Worksheets(1)
    
    nC = 0
    For c = 1 To 60
        v = EvalLinkedIndex(evalWs, ref, 1, c)
        If Not IsBlankLink(v) Then nC = c
    Next c
    If nC < 6 Then Exit Function
    
    ReDim lines(1 To 2000)
    For r = 1 To 2000
        v = EvalLinkedIndex(evalWs, ref, r, 1)
        If r > 1 Then
            If IsBlankLink(v) Then
                blankRun = blankRun + 1
                If blankRun >= 25 Then Exit For
                GoTo NextLinkedRow
            End If
            If Not IsNumeric(v) Then
                blankRun = blankRun + 1
                If blankRun >= 25 Then Exit For
                GoTo NextLinkedRow
            End If
            blankRun = 0
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
NextLinkedRow:
    Next r
    If nLines < 2 Then Exit Function
    ReDim Preserve lines(1 To nLines)
    LinkedMasterSheetToTsv = Join(lines, vbCrLf)
End Function

Private Function EvalLinkedIndex(ByVal ws As Worksheet, ByVal bookRef As String, ByVal r As Long, ByVal c As Long) As Variant
    Dim expr As String
    expr = "INDEX(" & bookRef & "!A:BH," & r & "," & c & ")"
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
    If IsS1S3() Then
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
    Else
        head = head & "source=S4" & vbCrLf
        head = head & "item=" & CellText(wsForm.Range("B3")) & vbCrLf
        head = head & "mspec=" & CellText(wsForm.Range("D4")) & vbCrLf
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
        head = head & "cellMd=" & CellNum(wsForm.Range("B8")) & vbCrLf
        head = head & "cellMdPf=" & CellText(wsForm.Range("C8")) & vbCrLf
        head = head & "cellCd=" & CellNum(wsForm.Range("B9")) & vbCrLf
        head = head & "cellCdPf=" & CellText(wsForm.Range("C9")) & vbCrLf
        head = head & "density=" & CellNum(wsForm.Range("B12")) & vbCrLf
        head = head & "densityPf=" & CellText(wsForm.Range("C12")) & vbCrLf
        head = head & "avg=" & CellNum(wsForm.Range("B10")) & vbCrLf
        head = head & "avgPf=" & CellText(wsForm.Range("C10")) & vbCrLf
        head = head & "tRange=" & CellNum(wsForm.Range("B11")) & vbCrLf
        head = head & "tRangePf=" & CellText(wsForm.Range("C11")) & vbCrLf
    End If
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

Private Function TempCopyPath(ByVal tag As String) As String
    Dim folder As String
    folder = Environ$("TEMP")
    If LenB(folder) = 0 Then folder = Environ$("TMP")
    If LenB(folder) = 0 Then folder = ThisWorkbook.Path
    If LenB(folder) = 0 Then folder = CurDir$
    If Right$(folder, 1) <> "\" Then folder = folder & "\"
    TempCopyPath = folder & "diegraph_" & tag & "_copy_" & Format$(Now, "yyyymmdd_hhnnss") & "_" & CStr(Int(Timer * 100) Mod 100000) & ".xlsm"
End Function

Private Function SourceFileName(ByVal src As String) As String
    Dim i As Long
    i = InStrRev(Replace(src, "/", "\"), "\")
    If i > 0 Then
        SourceFileName = Mid$(src, i + 1)
    Else
        SourceFileName = src
    End If
End Function

Private Function AlreadyOpenWorkbook(ByVal src As String) As Workbook
    Dim wb As Workbook
    Dim srcName As String
    srcName = SourceFileName(src)
    For Each wb In Application.Workbooks
        If IsIgnoredWorkbook(wb) Then GoTo NextWb
        If StrComp(wb.FullName, src, vbTextCompare) = 0 Then
            Set AlreadyOpenWorkbook = wb
            Exit Function
        End If
        If LenB(srcName) > 0 Then
            If StrComp(wb.Name, srcName, vbTextCompare) = 0 Then
                Set AlreadyOpenWorkbook = wb
                Exit Function
            End If
        End If
NextWb:
    Next wb
End Function

Private Function CopyWorkbookFile(ByVal src As String, ByVal dest As String) As Boolean
    Dim fso As Object
    Dim stm As Object
    
    On Error Resume Next
    If FileExists(dest) Then Kill dest
    Err.Clear
    
    FileCopy src, dest
    If Err.Number = 0 And FileExists(dest) Then
        CopyWorkbookFile = True
        Exit Function
    End If
    Err.Clear
    
    Set fso = CreateObject("Scripting.FileSystemObject")
    If Not fso Is Nothing Then
        fso.CopyFile src, dest, True
        If Err.Number = 0 And FileExists(dest) Then
            CopyWorkbookFile = True
            Exit Function
        End If
        Err.Clear
    End If
    
    Set stm = CreateObject("ADODB.Stream")
    If Not stm Is Nothing Then
        stm.Type = 1
        stm.Open
        stm.LoadFromFile src
        If Err.Number = 0 Then
            stm.SaveToFile dest, 2
        End If
        stm.Close
        If Err.Number = 0 And FileExists(dest) Then
            CopyWorkbookFile = True
            Exit Function
        End If
    End If
End Function

Private Sub HideWorkbookWindows(ByVal wb As Workbook)
    Dim w As Window
    If wb Is Nothing Then Exit Sub
    On Error Resume Next
    For Each w In wb.Windows
        w.Visible = False
    Next w
End Sub

Private Sub ReleaseAll()
    On Error Resume Next
    Application.DisplayAlerts = False
    Application.EnableEvents = False
    ReleaseOne wbS4, openedS4, pathS4
    ReleaseOne wbS1, openedS1, pathS1
    ReleaseOne wbBubble, openedBubble, pathBubble
    ReleaseOne wbP1, openedP1, pathP1
    ReleaseOne wbRts, openedRts, pathRts
    Set dataWb = Nothing
    Set wbS4 = Nothing
    Set wbS1 = Nothing
    Set wbBubble = Nothing
    Set wbP1 = Nothing
    Set wbRts = Nothing
    openedS4 = False
    openedS1 = False
    openedBubble = False
    openedP1 = False
    openedRts = False
    pathS4 = vbNullString
    pathS1 = vbNullString
    pathBubble = vbNullString
    pathP1 = vbNullString
    pathRts = vbNullString
    openedByLauncher = False
    copyPathToDelete = vbNullString
End Sub

Private Sub ReleaseOne(ByVal wb As Workbook, ByVal opened As Boolean, ByVal dest As String)
    On Error Resume Next
    If opened Then
        If Not wb Is Nothing Then wb.Close SaveChanges:=False
        DeleteFileWithRetry dest
    End If
End Sub

Private Sub ReleaseDataWorkbook()
    ReleaseAll
End Sub

Private Sub DeleteFileWithRetry(ByVal dest As String)
    Dim i As Long
    Dim t As Double
    If LenB(dest) = 0 Then Exit Sub
    On Error Resume Next
    For i = 1 To 6
        Kill dest
        If Not FileExists(dest) Then Exit Sub
        t = Timer
        Do While Timer < t + 0.25
            DoEvents
        Loop
    Next i
End Sub

Private Sub RestoreApp(ByVal prevSU As Boolean, ByVal prevEA As Boolean, ByVal prevDA As Boolean, ByVal prevCur As XlMousePointer, ByVal prevSec As MsoAutomationSecurity)
    On Error Resume Next
    Application.AutomationSecurity = prevSec
    Application.ScreenUpdating = prevSU
    Application.EnableEvents = prevEA
    Application.DisplayAlerts = prevDA
    Application.Cursor = prevCur
End Sub
